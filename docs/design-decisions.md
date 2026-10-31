# Design decisions

Format: decision, requirements it satisfies, rationale, consequences. Every decision must reference at least one ID from [../requirements](../requirements/README.md).

## D1. Import into SQLite instead of reading the source files directly
- **Requirements**: DAT-003, NFR-003, NFR-005
- **Why**: files are large (~770 MB each, 20+ files expected). Filtering and search need indexes. Import is a one-off cost (~33 s for 130k ads).
- **Consequence**: the DB is larger than the source (~1 GB per quarter-sized file) and is a derived copy; the source files are not needed after import.

## D2. Flat `ads` table with promoted columns + raw JSON blob
- **Requirements**: SRC-001, SRC-002, SRC-008, NFR-003
- **Why**: list and filter queries only need a handful of fields; promoting them to indexed columns keeps queries fast. The full record is stored (null/empty-pruned) as JSON in `raw` and only parsed when an ad is opened.
- **Consequence**: new filter dimensions need a schema change and re-import (see constraints).

## D3. Contentless FTS5 table keyed by `ads.rowid`
- **Requirements**: SRC-003, SRC-011, NFR-003
- **Why**: avoids storing description text twice. Ad text is retrieved from `raw`.
- **Consequence**: no snippets/highlighting from FTS; deletions rely on `contentless_delete=1` (SQLite ≥ 3.43).

## D4. Deduplicate on ad id (`INSERT OR IGNORE`)
- **Requirements**: DAT-002, DAT-007
- **Why**: allows re-importing files and overlapping files (an ad can appear in several periods) safely.
- **Consequence**: the first imported copy wins; per-source counts reflect ads actually inserted for that source. Updated versions of an ad are not merged.

## D5. Import in a worker thread, line splitting on `\n` only
- **Requirements**: DAT-004, DAT-005, DAT-006, DAT-008, NFR-004
- **Why**: keeps the UI responsive. Node's `readline` also splits on U+2028/U+2029, which occur inside ad texts and corrupted 61 records, so a custom splitter is used.
- **Consequence**: JSON array files (`[...]`) are streamed element by element (`arrayItems()`), so memory stays flat for any file size; the format is detected from the first non-blank character. A single line or array element above 64 MB is rejected with an error. The worker has a 3 GB heap limit and the main process reports an unexpected worker exit as an import error instead of leaving the UI waiting.

## D6. Facet counts computed in a separate worker, excluding the facet's own filter
- **Requirements**: SRC-009, NFR-003, NFR-004, NFR-005
- **Why**: counts need full-group scans (~280 ms at 130k rows) and must not block the main thread; excluding the own filter keeps alternatives visible.
- **Consequence**: counts may lag the list by a short moment. Covering indexes on `(field_id, group_id, occ_id, field, grp, occ)` and `(region, muni)` speed this up. For many millions of rows a pre-aggregated summary table would be the next step.

## D7. Hierarchical filters (occupation, location) are multi-select lists of nodes, OR-combined
- **Requirements**: SRC-001, SRC-002, SRC-010, SRC-014
- **Why**: users need several nodes per filter. Occupation selections live in `sel` as `{k, id, label, fi, gi}`, location selections in `loc` as `{k, id, label, ri}` (kind, own id, ancestor ids), so chips and de-duplication need no lookups. Selecting a narrower node removes its wider ancestors (the wider pick would otherwise still match everything); selecting a wider node removes its now-redundant descendants; other branches stay.
- **Consequence**: query is `field_id IN (..) OR group_id IN (..) OR occ_id IN (..)` and `region IN (..) OR (muni = ? AND region = ?)`. Clicking a selected node deselects only it. Filters saved by earlier versions (`field/group/occ/region/muni`) are migrated on load. A future multi-layer filter should reuse the same pattern.

## D8. No framework; single `app.js`
- **Requirements**: UI-001, NFR-001, NFR-007
- **Why**: small surface, no build pipeline, fast start.
- **Consequence**: DOM is built with template strings; every dynamic value must pass through `esc()`. If the UI grows substantially, split into modules or adopt a framework.

## D9. Keep the list view mounted while viewing an ad
- **Requirements**: SRC-013, LST-008, UI-005
- **Why**: satisfies "filter remembered when jumping into an ad and back": scroll position, loaded pages and filters are preserved without re-querying.
- **Consequence**: DOM grows with loaded pages; acceptable for thousands of rows. Scroll offset is saved/restored manually because hidden elements lose it.

## D10. History API for navigation
- **Requirements**: NAV-004, NAV-005, NAV-006, NAV-007, NAV-008
- **Why**: Backspace and mouse back/forward behave like a browser. A depth counter (`idx`) prevents navigating out of the app.
- **Consequence**: back from the first view is a no-op.

## D11. Ad description rendered from plain text with heuristics
- **Requirements**: AD-001, AD-003, AD-009
- **Why**: `text_formatted` was empty in sampled data, and source text is untrusted, so rendering HTML was avoided. Headings (short lines, ALL-CAPS runs, lines ending in `:`/`?`) and bullet lists (consecutive short lines) are inferred.
- **Consequence**: formatting is best-effort and can misclassify some texts.

## D12. Colour semantics for tags
- **Requirements**: LST-002, UI-003, UI-004
- Location = teal, field = blue, group = purple, occupation = pink, other attributes = neutral grey. Consistent between list, ad view and filter chips so meaning is recognisable at a glance.

## D13. Security posture
- **Requirements**: NFR-006, AD-007, AD-009
- Renderer is sandboxed, with context isolation and a CSP that blocks inline scripts. `style-src 'unsafe-inline'` is allowed because the UI uses inline `style` attributes. External links are opened in the OS browser and only for `http(s)` URLs. Imported file paths are checked for extension in the main process. Employer logos are loaded from remote HTTPS URLs (the only network access) and fall back to an initial letter if unavailable.

## D14. Package with electron-builder, whitelisting `src/**`
- **Requirements**: NFR-009
- **Why**: widely used, configured in `package.json` (`build`), produces AppImage/NSIS/dmg without extra project files. Only `src/**` and `package.json` are packaged so that data files (`*.jsonl`, ~770 MB each) in the project folder are never bundled; `node:sqlite` needs no native rebuild.
- **Consequence**: new dev dependency; no code signing, auto-update or custom icon yet. Output goes to `dist/` (git-ignored).

## D15. Facets return all options with filtered counts; unfiltered lists cached
- **Requirements**: SRC-015, SRC-009, NFR-003
- **Why**: options must stay visible (grayed at count 0) so the filter panel does not jump around. The stats worker runs the unfiltered group-by once per dimension (cached, invalidated via `PRAGMA data_version`), runs the filtered group-by only when relevant filters are active, and merges counts onto the full list. (Caching part superseded by D23: unfiltered counts now come from summary tables.)
- **Consequence**: payload always contains every option (~2.5k occupations, ~300 municipalities at one quarter; more with all years). Cold start of the cache costs ~300 ms; filtered updates ~60 ms. During imports the cache is rebuilt often.

## D16. Free-text entries as chips inside the search input
- **Requirements**: SRC-016, SRC-003, SRC-008
- **Why**: several keywords should be combinable and individually removable. Enter commits the typed text to `terms`; the text still being typed is not a filter (SRC-021: a query per keystroke gave flickering results and wasted queries at scale). Each entry is turned into its own FTS expression (prefix match, `"phrases"`).
- **Consequence**: Backspace in an empty-at-caret input removes the last entry; the native search-clear button is hidden. Terms are persisted with the other filters.

## D17. Layout state (menu collapse, filter width and collapse) kept in the renderer
- **Requirements**: UI-007, UI-008, UI-009
- **Why**: pure presentation state; stored in `localStorage` (`menuCollapsed`, `filtersCollapsed`, `filterW`) and applied through a body/view class and the `--filter-w` CSS variable, so no IPC or framework is needed. The resize handle uses pointer events with pointer capture; the filter width is clamped to 310 px (previous fixed width) up to min(720 px, 60% of the window).
- **Consequence**: the collapsed menu hides text only via CSS; nav items carry `title` tooltips for accessibility. The menu is collapsed by default (`menuCollapsed` unset); an explicit choice is stored as `1`/`0`.

## D18. Ads-over-time chart: server-side binning, hand-built SVG
- **Requirements**: SRC-017, SRC-009, NFR-003
- **Why**: the chart must follow every active filter and adapt its resolution to the period. `timeline()` in `db.js` groups matching ads by year/month/week/day (SQL `substr` / `date(..,'weekday 0','-6 days')`), fills empty bins and returns the unit and bounds; it is part of the facets result, so it runs in the stats worker and costs no extra IPC. The renderer draws an SVG with no charting library (no new dependency); axis labels are chosen by priority (first bin, then year/month landmarks, then fillers such as months, week numbers or days) and dropped when they would overlap. (Now its own request and, for unfiltered/date-only cases, served from `sum_day`: D23.)
- **Consequence**: the chart is recomputed on every filter change (cheap without a date filter, ~0.8 s at 130k ads with a date filter because it runs a second grouped query; see constraints). Its width follows the resizable sidebar through a `ResizeObserver`. Inline SVG inherits the global icon stroke style, so the chart resets `stroke`.

## D19. Free-text entries combined with AND or OR via `ftsMatch()`
- **Requirements**: SRC-018, SRC-016, SRC-021
- **Why**: each entry (committed term or text being typed) is turned into its own FTS expression (words AND-ed, prefix match, `"phrases"`), and the expressions are joined with explicit `AND` or `OR` according to `termMode`. Keeping entries as units makes OR predictable: `"a b" OR c` means (a and b) or c.
- **Consequence**: words typed together in one entry are always AND-ed; to OR two words, enter them separately. The mode is stored in the filter object (`termMode`, default `and`).

## D20. Tolerate every source generation: synthetic ids, first array element, streamed arrays
- **Requirements**: DAT-012, DAT-005, DAT-007
- **Why**: the real files differ by era (see data-model.md). Ads from 2006–2016 have `id: null`, so `toRow()` derives `h-<sha1>` from headline, dates, employer, address, vacancies and the first 4000 characters of the text; the same ad then dedupes on re-import (about 1% of 2006 ads collapse as true duplicates). From 2023 occupation field/group/occupation and employment type are arrays; the first element of each is stored in the flat columns (they are parallel lists), so only the first occupation of a multi-occupation ad is filterable. `.json` array files (2018, 2019) are streamed (D5).
- **Consequence**: ads with several occupations are found only under the first one; the full raw record keeps all of them and the ad view uses the first for the breadcrumb. Making all occupations filterable would need a link table (`ad_occ`) and a re-import. 2006–2017 ads have no occupation, location or employment type, so those filters only cover 2018 onwards.

## D21. Data folder pinned to `AMS Viewer`
- **Requirements**: DAT-003
- **Why**: Electron derives the `userData` folder from `package.json`; adding `productName` (for packaging, D14) silently moved `npm start` from `ams-viewer` to `AMS Viewer` and split the imported data across two databases. `main.js` now sets the folder explicitly, matching the folder that holds the user's imports.
- **Consequence**: the path no longer depends on package metadata and is the same for development and packaged builds. The old `~/.config/ams-viewer` folder (only `2026-Q3`, 1.1 GB) is an unused leftover that the user can delete.

## D22. Database reads only in workers; staged startup behind a splash window
- **Requirements**: UI-014, NFR-004, NFR-005, SRC-013
- **Why**: with 11M ads the first window took about 6 minutes (cold facet counts, an unfiltered `COUNT(*)` and a stale saved keyword filter, all in or ahead of the first paint) and synchronous queries in the main process made the OS flag the window as not responding. Now the main process runs no queries. Two read workers share `read-worker.js`: `list` (rows, single ad, summary) and `stats` (facets, counts, source removal), so slow statistics never delay the list; queued requests of the same kind are superseded by newer ones. Startup shows a splash window while the summary and first page load (about 3 s on 11M ads); facets and the chart load afterwards (a placeholder is shown). The unfiltered total comes from the per-source counts instead of `COUNT(*)`. Filters are kept only for the session (`sessionStorage`) so a stale filter cannot make the next start slow (SRC-013 changed).
- **Consequence**: filtered counts and facets can still take a long time on big data (T6 / `docs/full-scale-performance-plan.md`); a running obsolete query is not cancelled. `PRAGMA busy_timeout` is now set before the WAL pragma, because several connections opening at once on a database needing WAL recovery failed with `SQLITE_BUSY`.

## D23. Summary tables for filter options, counts and the chart
- **Requirements**: NFR-010, NFR-005, SRC-015, SRC-017
- **Why**: grouping 11M ads per request made filter options, the count and the chart take minutes, even for a filter matching one ad. Tables `sum_occ` (field/group/occupation), `sum_loc` (region/municipality), `sum_year`, `sum_emp`, `sum_hours` and `sum_day` hold precomputed counts. The importer updates them per batch inside the same transaction (`accAdd`/`accFlush`), and source removal subtracts. On first start with existing data a one-time background pass over `ads` builds them (progress shown in the UI; `meta.summary_version` marks it complete); `ix_emp`/`ix_hours` are created after it. Unfiltered facets, the universe of options, date-only counts, the unfiltered total and min/max date come from the tables; filtered facets group only the matching rows. Facets, count, timeline and build/removal each run in their own worker lane (`read-worker.js`), so one slow request never blocks another. The timeline is a separate request (no longer part of facets).
- **Consequence**: any new code path that inserts or deletes ads must update the summary tables. Import and source removal are refused while the one-time build runs. Roughly 10-50 MB extra storage.

## D24. Planned favorite-list selection and inline creation
- **Requirements**: LST-009, LST-010, LST-011, LST-012, LST-013
- **Status**: planned; no app implementation or storage/schema decision yet (T11).
- **Decision**: provide a default "Favorites" list and user-created, custom-named lists that can be deleted. An ad's star action opens a list-selection popover. Its last entry is a plus (+) control that becomes a name input with an "Add" button on the right. Submitting creates the list and adds the pending ad to it.
- **Why**: users can organize ads into named collections and create a destination without abandoning the current favorite action.
- **Consequence**: the popover workflow must retain the originating ad while creating a list. Persistence, list browsing/management, default-list deletion policy and membership-removal behavior remain open in T11; they are not decided by this interaction plan.

## D25. Compact counts and explicit pending facet values
- **Requirements**: UI-015, SRC-009, SRC-015
- **Decision**: format large counts with the built-in `Intl.NumberFormat` compact notation, at most one decimal place and lowercase `k` for thousands. Keep exact grouped counts on hover. Apply this to filter options, result/sidebar totals, chart labels and totals, source statistics and import counters; chart hover remains exact.
- **Why**: million-scale counts must fit narrow filter rows without hiding labels. Old facet counts can disagree with newly loaded results while slower statistics requests are still running.
- **Consequence**: filter changes immediately invalidate older facet requests, replace counts with `...` and remove stale zero styling until fresh counts arrive. A failed request leaves counts unknown rather than showing stale values. Own-filter exclusion remains unchanged (D6). Filtered merge keys use the same missing-value normalization as summary tables, and repeated groups/tree leaves are summed instead of overwritten. No schema change, rebuild or new dependency is needed.

## D26. Top-level Settings and persistent global typography
- **Requirements**: UI-012, UI-016, NAV-009
- **Decision**: add Settings as a sidebar destination using the existing History API and hidden-view navigation. Its Appearance section initially contains a slider-style monospace switch backed by a native checkbox with switch semantics and keyboard support. Use monospace for all main-window text by default, including headings and ad descriptions, as selected by the user; off restores the existing proportional stack.
- **Why**: typography is an application preference, not a search filter or ad action. A separate page leaves room for future settings without adding controls to the browsing workflow. Light/dark mode is not implemented by this change; UI-002 still applies.
- **Consequence**: save validated boolean preferences in a renderer-local `localStorage` settings object, separate from session filters. Apply immediately through `--font-app`, choosing `--font-mono` or `--font-ui`; system fonts work offline with no asset, dependency, schema or IPC changes. Wider date tiles and wrapping tags/search controls accommodate monospace. The startup splash retains its own typography.

## D27. Collapsible widgets; timeline stays with time filters
- **Requirements**: UI-007, UI-011, UI-013, SRC-017, SRC-019
- **Decision**: keep the ads-over-time chart in the filter column, immediately above Published, as requested on 2026-10-16. The planned right statistics bar hosts the map and employers, not the timeline; T2 no longer depends on T8. All six current widgets use native title buttons with chevrons, `aria-expanded`, `aria-controls` and hidden content bodies. The shared helper discovers `data-widget` sections in either bar.
- **Why**: the timeline belongs with time filtering. Collapsing unused controls saves vertical space without losing selections. At minimum width, flex shrinking previously reduced occupation/location sections to zero height, leaving their titles and search inputs overlapping other content.
- **Consequence**: store independent widget keys in `localStorage.collapsedWidgets`, defaulting to expanded and ignoring invalid storage. Collapsing never changes filters, tree expansion, tree search or saved dimensions; Clear all does not reset layout. Collapsed filter titles show the number of active selections (Published counts its populated date bounds). Sections do not shrink and the filter column scrolls. Hidden charts retain the latest timeline data but skip rendering at zero width; the existing `ResizeObserver` redraws on expansion or resizing. No dependency, IPC or schema change.

## D28. Search within displayed ad content
- **Requirements**: AD-009, AD-011
- **Decision**: provide a compact find field on the ad view. Search displayed ad text case-insensitively, highlight all matches using DOM-created elements, and cycle the active match with previous/next controls and Enter/Shift+Enter.
- **Why**: users need to locate a phrase in a long ad without changing the list's global filters or altering stored source text.
- **Consequence**: matching is renderer-only and includes displayed ad details; no IPC, database, dependency or schema change. Match highlighting is applied after safe rendering and removed when the query changes or the ad is reloaded.

## D29. Contextual slash search shortcut
- **Requirements**: NAV-008, AD-011
- **Decision**: outside editable controls, `/` focuses in-ad find when an ad is displayed; in every other view it retains the existing list-search navigation and focus.
- **Why**: searching from an ad should find text in that ad without abandoning its context.
- **Consequence**: focusing in-ad find does not change history, ad content or global filters. Editable inputs retain literal slash entry. No dependency, IPC or schema change.

## D30. Independent collapse-all actions for hierarchical filters
- **Requirements**: UI-017
- **Decision**: place a small native text button labelled "collapse all" with a tree-specific accessible name directly below each occupation/location search field, inside the widget body. Remove every saved expansion key belonging to that tree, including hidden descendants, and clear its tree-search text before redrawing from existing facet data.
- **Why**: users need to close deeply expanded branches in one action; active tree-search text otherwise automatically reopens matching branches. The initial header icon was ambiguous beside title-based widget collapse; text and placement below search distinguish the two actions.
- **Consequence**: selections, the other tree's search/expansions and widget visibility remain unchanged. Persist through the existing expansion storage; do not reload results or fetch facets. No dependency, IPC or schema change.

## D31. Contextual keyboard-shortcut help modal
- **Requirements**: NAV-010, NAV-011, UI-001
- **Decision**: pressing `?` outside editable controls opens a native modal dialog with global shortcuts and a section for the active view. Entries describe current bindings, including contextual `/`, search/result keys and ad-find keys. Escape and the close button dismiss it; focus returns to the opener, and background navigation is ignored while open.
- **Why**: users need discoverable shortcuts without losing the current view or confusing actions whose target changes by context.
- **Consequence**: native dialog behavior contains focus; the modal adds no dependency, IPC or schema change and does not alter unrelated shortcuts. Shortcut descriptions must stay aligned with renderer handlers.

## D32. Right-align in-ad find controls
- **Requirements**: AD-011
- **Decision**: place the find controls at the right edge of the breadcrumb bar, allowing the input to shrink when the ad pane is narrow.
- **Why**: keep find out of the breadcrumb's way without letting the controls overflow the ad view.
- **Consequence**: CSS-only layout change; no dependency, IPC or schema change.

## D33. Consistent application message and confirmation dialogs
- **Requirements**: UI-018, DAT-009
- **Decision**: share the keyboard-shortcut dialog's shell and backdrop through `.app-dialog`. Replace renderer `confirm`/`alert` calls with an asynchronous native `<dialog>` helper for messages and confirmations. Source removal initially focuses Cancel, requires explicit Remove, and explains that the original file remains untouched. Escape cancels; ordinary messages offer OK only.
- **Why**: system popups break visual consistency and make destructive actions less clear. An asynchronous modal preserves the renderer event loop and native focus containment.
- **Consequence**: text is assigned with `textContent`, never interpreted as HTML. Dialog dismissal restores focus; global keyboard/mouse navigation and shortcut help are blocked during confirmation or messages. Returned and rejected removal errors use the same dialog. No dependency, IPC, schema or native file-picker change.

## D34. Shared divider-based vertical resizing for filter widgets
- **Requirements**: UI-010, UI-011
- **Decision**: broaden T1 from hierarchical trees to every filter widget. The existing bottom divider becomes a pointer-captured drag target with a 12 px hit area, teal hover/focus feedback and a resize tooltip. Each divider sizes the body above it, including the last widget; subsequent widgets move down rather than sharing a fixed height budget. Collapsed widgets hide their handles.
- **Why**: the visible divider is the natural resize target; a common helper avoids tree-specific behavior and preserves independent widget collapse.
- **Consequence**: retain natural heights until resized, then clamp body height to 80 px through max(80 px, window height minus 160 px). Overflow scrolls; trees fill the remaining body beneath their search and collapse controls instead of retaining the 240 px cap. Save independent heights in `localStorage.widgetHeights` when dragging ends (including cancellation/capture loss) or on keyboard resizing. Viewport changes clamp displayed heights without overwriting the saved preference. Collapse and Clear all retain dimensions. Focusable horizontal separators support Up/Down in 20 px steps and Home/End for bounds. No dependency, IPC or schema change.

## D35. Matching statistics widgets and independent responsive columns
- **Requirements**: UI-008, UI-011, UI-013, UI-019, UI-020
- **Decision**: add a 280 px statistics column to the right of results. Geography and Top employers initially contain unavailable states; their data remains T5/T9. Reuse the filter widgets' `data-widget` title buttons, styles, collapse persistence and bottom-divider resizing (D27/D34), with independent `geography` and `employers` keys. Keep the timeline in the filter column.
- **Why**: both columns should feel like the same inspection workspace, with independent widget heights and visibility, without coupling the layout task to map or employer-query implementation.
- **Consequence**: native icon buttons in the results toolbar toggle each column, with updated tooltips, accessible names and `aria-expanded`. Preserve existing `filtersCollapsed` and add `statisticsCollapsed`. Below 1200 px, hide statistics initially without changing the saved preference; users can explicitly open it. If both columns cannot leave 420 px for results, the most recently opened column wins (filters by default), temporarily hiding the other without saving that automatic change. Clamp filter width to the remaining menu/results space while retaining its preferred width for wider windows. Menu changes and viewport changes recompute layout. The toolbar wraps rather than squeezing search or stretching sort controls. Statistics bodies start at 200 px and use the same resizing bounds as filters. No dependency, database query, IPC or schema change.

## D36. Remembered statistics sidebar width
- **Requirements**: UI-021, UI-020
- **Decision**: make the statistics column resizable through a 5 px left divider matching the filter divider. Dragging left expands it; pointer capture, pointer-identity checks and cancellation/capture-loss cleanup keep dragging bounded. The focusable vertical separator exposes its current range and supports Left/Right in 20 px steps (left expands), Home for minimum and End for maximum.
- **Why**: the statistics column needs the same width flexibility as filters, not only independently resizable widget heights.
- **Consequence**: retain 280 px as minimum and initial width; cap at 720 px, 60% of the viewport, and the space remaining after menu, divider and 420 px results. Persist the preferred width independently in `localStorage.statisticsW` after dragging or keyboard resizing; collapse and automatic viewport/menu clamping never overwrite it. Responsive column fitting includes both divider widths and the actual statistics width; actively resizing statistics gives that column priority. No dependency, database query, IPC or schema change.

## D37. Bounded chronological probes and reusable facet groupings
- **Requirements**: NFR-003, NFR-005, NFR-010
- **Decision**: for non-keyword chronological filters with offset plus page size at most 8,192, find the 8,192nd date-index entry within the date range, then traverse that bounded range in result order and stop when the page is full. Fall back to the original planner-selected query if the page is incomplete or the boundary date is null. Date-only, keyword, relevance and deep-page queries retain their existing paths.
- **Why**: on the 11,252,350-ad database without planner statistics, the region-index plan read and sorted 1.81 million Stockholm matches to return 60 ads (66.6 s); bounded date traversal returned the same leading IDs in 5 ms. A Stockholm/healthcare combination improved from 3.95 s to 31 ms. These are observed runs, not cold-cache guarantees.
- **Decision**: batch uncached facet dimensions with identical effective predicates through one materialized CTE containing only facet keys. Keep up to 32 dimension/predicate count maps per connection in LRU order. Invalidate them on `PRAGMA data_version` changes (other connections) or `total_changes()` changes (the same connection); discard all cached maps after query failure. Read option universes afresh from summary tables. Cache no raw ad payloads.
- **Why**: broad filters otherwise revisit large ad rows for several groupings. Region facets measured 13.3 s before batching and 6.9 s after; a subsequently combined region/field query measured 37.3 s before and 6.3 s after, with shared cached dimensions. Returning to either filter measured 12-13 ms. All five combined-filter facets matched independent reference SQL, including own-filter exclusion.
- **Consequence**: no schema, dependency, filter semantics or IPC result-shape change. Materialized keys can spill to SQLite temporary storage; first-use broad aggregates remain slow. Active obsolete SQL is not interrupted, and counts/timelines and sparse/deep list fallback queries can still contend for disk/cache. Worker diagnostics report queue wait separately from execution; IPC `[perf]` logs remain end-to-end. NFR-005/NFR-010 remain in progress pending broader latency and rapid-interaction verification.

## D38. Planned named datasets and dataset-management workflow
- **Requirements**: DAT-017, DAT-018, DAT-019, DAT-020, DAT-021, DAT-022, DAT-023, DAT-024
- **Decision**: support named datasets backed by separate databases so users can switch between broad and focused collections. The initial dataset is named exactly "default"; deleting every dataset recreates an empty active "default". Dataset names cannot be blank.
- **Decision**: rename Data sources to "Datasets" while retaining its overall design and source-management functionality for the active dataset. Use the dataset name as the page heading with adjacent Edit and Swap dataset controls. Edit exposes Save and Discard for the name and optional multiline description; clicking the heading additionally selects the name text. Creation starts in edit mode with the name field focused and its text selected.
- **Decision**: Swap dataset opens a compact selectable list showing each dataset's name, first description line when present, imported-file count and ad count. The final option is "+ add new dataset" and starts the creation editor.
- **Why**: smaller independent collections reduce the scope of browsing and filtering without discarding a larger collection, while familiar source-management controls remain available.
- **Consequence**: D39 implements storage and worker lifecycle; D40–D42 complete metadata editing, chooser, confirmation and renderer state behavior.

## D39. Per-dataset databases and safe lifecycle
- **Requirements**: DAT-003, DAT-017, DAT-018, DAT-021, DAT-022
- **Decision**: store catalog at `<userData>/datasets.json`; each record has a generated stable ID, editable name, multiline description and initialized flag. Store databases under `<userData>/datasets/`: `default.db` for the required `default` dataset and `<generated-id>.db` for others. Persist active ID in the catalog. Names never form paths.
- **Decision**: migrate legacy `ads.db` by renaming it and any `-wal`/`-shm` sidecars into `datasets/default.db`, without copying or re-importing. A small migration marker lets startup resume partial file moves; conflicting DBs are never overwritten. Before catalog commit, interrupted deletion restores staged files for still-registered datasets.
- **Decision**: trim names, reject blank names and reject duplicates case-insensitively. Allow deleting `default` when another dataset remains; deleting the active dataset selects the oldest remaining dataset. Deleting the final dataset creates and activates a fresh empty `default`.
- **Decision**: reject dataset changes/deletion while import or summary build runs. Drain all five read-worker lanes, close their SQLite connections cleanly, and restart them on the selected DB before persisting activation. Stage DB/WAL/SHM files before catalog deletion, with rollback and startup recovery on failure. Original import files are never deleted.
- **Why**: independent SQLite files isolate ad IDs, source names, indexes and summary tables while opaque IDs prevent editable metadata from influencing filesystem paths. Moving the existing DB preserves large imports without copying tens of gigabytes.
- **Consequence**: worker APIs support listing, creation, metadata update, activation and deletion; dataset-management UI is completed by T16/T17. On first launch after upgrade, existing DB is moved from `ads.db`; user backup is recommended before upgrade. A staged file left by a committed deletion can be cleaned on next startup. D42 records confirmation and dataset-dependent renderer refresh.

## D40. Dataset metadata editor and guarded exits
- **Requirements**: DAT-019, DAT-020, DAT-021, DAT-022, NAV-004, NAV-005, NAV-006, NAV-007, NAV-008, UI-001
- **Decision**: show the active dataset name as the Datasets page heading and its optional multiline description below it. Edit and heading-click open the same name/description editor; heading-click selects the name. New dataset creation starts with an empty selected name and is persisted only on Save.
- **Decision**: dirty metadata prompts Save / Discard / Cancel on view navigation, browser-history navigation, dataset switching and app close. Dataset switching UI must use the same guard. Discarding creation never adds an unnamed catalog entry.
- **Why**: dataset metadata must be editable without allowing accidental loss or partially-created datasets. Showing description outside edit mode gives context while retaining existing source-management layout.
- **Consequence**: app close uses a narrow main/preload/renderer IPC handshake so the renderer can finish the choice before Electron closes the window. T17/D42 connects Swap to the chooser and preserves the dirty-editor guard. No schema or dependency change.

## D41. Edit dataset metadata in its displayed typography
- **Requirements**: DAT-020, DAT-021, DAT-022, UI-001
- **Decision**: edit the dataset name directly inside its heading and the description directly below it, using `contenteditable="plaintext-only"`. Preserve display typography, colors and transparent backgrounds; use focus outlines rather than separate input/textarea controls. Save and Discard replace the adjacent heading actions while editing.
- **Decision**: heading-click selects the full name only when entering edit mode; subsequent clicks retain normal caret placement. Enter in the name moves focus to the description; Enter in the description inserts a line break. Save reads plain text, normalizes name line breaks to spaces and retains description line breaks. Existing validation and dirty-exit guards remain unchanged.
- **Why**: editing should show the same styled text as the saved view, without a duplicate title or a small native textbox. Plain-text editing avoids storing pasted HTML.
- **Consequence**: no dependency, schema or IPC changes. T17 creation reuses the same inline editor.

## D42. Dataset chooser, deletion and switching state
- **Requirements**: DAT-017, DAT-018, DAT-020, DAT-021, DAT-023, DAT-024
- **Decision**: use a compact native dialog with one keyboard-selectable row per dataset, first-line description preview, imported-file/ad counts, an individual delete action, and "+ add new dataset" last. Deletion requires explicit permanent-delete confirmation; original source files remain untouched.
- **Decision**: persist each dataset's last-known count summary in `datasets.json`. Refresh active stats at startup, activation, import completion and source removal. Backfill missing legacy snapshots through a temporary `read-worker` that reads only `sources` metadata; show loading/error states and never query SQLite on the main thread.
- **Decision**: successful switch or active-dataset deletion clears session filters, invalidates list/ad/facet requests, opens Datasets, and starts a fresh Search query. History entries carry dataset identity; traversal into a prior dataset is rejected. Failed activation leaves current view and filters intact. Dirty metadata uses T16's Save / Discard / Cancel guard before chooser opens.
- **Why**: dataset-specific state must not leak between isolated databases, and chooser counts must be cheap even when datasets are large.
- **Consequence**: no DB schema or dependency change. Catalog stats are backward-compatible optional metadata; old entries are filled once in workers. Dataset operations are briefly rejected while unknown summaries are being backfilled.

## D43. Top-employer statistics; defer Geography placeholder
- **Requirements**: SRC-020, SRC-019
- **Decision**: Group ads by exact stored `ads.employer` text, return top 30 with counts under every active filter, and show full-name tooltips. Use the summary table for unfiltered results and keep filtered grouping in the existing `facets()` read-worker request, cached by predicate. Do not merge spelling/case variants, use organization numbers, or make labels clickable. Remove the unavailable Geography shell while SRC-019/T5 remains planned.
- **Why**: SRC-020 asks for company names and frequencies, not a new filter dimension. An empty Geography shell suggests functionality that does not exist.
- **Consequence**: no ad-column, IPC or dependency change. D44 records the derived summary table. Filtered employer grouping scans matching ads; full-scale filtered latency remains unverified and belongs to T6.

## D44. Precompute unfiltered employer counts
- **Requirements**: SRC-020, NFR-005
- **Decision**: Add `sum_employer` to the derived summary tables and maintain it with the existing importer and source-removal accumulator. Bump summary version to 2 so existing databases rebuild all summaries once in the background; source ads do not need re-importing.
- **Why**: An unfiltered group-by on the existing 11.25M-ad database took 167,837 ms. Precomputed totals make the initial top-employer widget independent of an ads-table scan.
- **Consequence**: the first startup after this update runs the one-time summary rebuild and blocks import/removal until ready. Filtered employer grouping still scans matching ads; measure under T6 before further optimization.

## D45. Exact-name employer toggles in filtered statistics
- **Requirements**: SRC-022, SRC-020, SRC-010, SRC-013
- **Decision**: supersede D43's non-clickable labels with native toggle buttons (`aria-pressed`, Enter/Space) and removable native-button "Employer: …" chips. Store exact names in `F.employers`, OR-combine them with parameterized `COLLATE BINARY IN (...)` in shared `where()`, and AND-combine with other dimensions. Do not normalize case/spelling, trim names or add free-text terms.
- **Why**: employer selection must identify the stored company text without changing keyword semantics or discarding the user's search context.
- **Consequence**: use existing `setF` persistence and refresh flow for list, counts, timeline and facets; dataset switching and Clear all reset the array. Ad navigation and renderer session restoration retain it. Keep existing employer buttons while counts are pending and restore keyboard focus by exact name after refresh. Statistics still show only the filtered Top-30, including the employer predicate (not own-filter-excluded alternatives); unavailable selections remain removable via active chips. No schema, index, IPC or dependency change; full-scale filtered latency remains under T6.

## D46. Index exact employer selections in the build worker
- **Requirements**: SRC-022, SRC-020, SRC-009, SRC-017, NFR-004, NFR-005, NFR-010
- **Decision**: create `ix_employer ON ads(employer COLLATE BINARY, pub_date)` in `ensureSummary()` before its already-built early return. Check index existence first and report one-time indexing progress through the existing build worker. Do not add it to connection-opening schema SQL or change summary version 2.
- **Why**: the real 11.25M-ad database had no employer index; an exact-employer count planned `SCAN a`. Count, timeline, filtered facets and Top-30 statistics competed over full-table reads, with reported refresh latency of 22.5 seconds. The index narrows matching rows and covers employer counts and publication-date reads without changing exact-name semantics.
- **Consequence**: existing datasets gain the index automatically on startup/activation without re-import or summary rebuild. Index construction may take time and disk space; the existing build gate blocks imports/removals/dataset changes meanwhile. SQLite maintains the index on inserts/deletes. Full-scale migration duration and post-index native interaction remain unverified; a disposable 130k-ad fixture verified identical outputs and faster queries.

## D47. In-flow notification area for background work
- **Requirements**: UI-022, NFR-004, DAT-006, DAT-023
- **Decision**: main process sends one generic `task:event` channel (`key`, `running`/`done`/`error`, `text`, optional `pct` 0-100) and keeps running tasks for a `tasks:list` snapshot. The renderer shows a `#notices` stack as the first row of a body grid, so it pushes sidebar and views down on every view. Running tasks have a progress bar (indeterminate without `pct`), show only after 300 ms and disappear when done. Errors are keyed `<task>:error`, replace earlier errors with the same key, stack otherwise and stay until dismissed. Dataset-operation failures stay in the existing modal; only their progress is a notice. Renderer statistics refresh failures are also reported, except superseded `Dataset transition in progress` rejections.
- **Why**: summary and index builds, post-import statistics refresh and dataset switching ran without visible feedback, so blocked operations and slow refreshes were unexplained. A single keyed channel covers current and future background work without per-task IPC.
- **Consequence**: the delay hides quick tasks to avoid flashing. Notices are in the layout flow; `.view` no longer uses `100vh`. The Datasets import panel remains for detailed counts.

## D48. Repair stale promoted array-valued tags from stored ads
- **Requirements**: DAT-012, LST-001, LST-002, LST-003, NFR-004
- **Decision**: before the summary early return, the existing build worker scans for missing taxonomy IDs/labels, employment or hours whose raw source field is an array. Reuse `toRow()` normalization and fill only NULL columns in 500-row transactions; retain raw JSON, IDs, source metadata, FTS and existing non-null values. Mark completion with `meta.array_tags_version = '1'` per dataset.
- **Why**: the 2026 `Getdet AB` June ads retain array-valued taxonomy and employment in raw JSON but have NULL promoted columns from an older import. List tags and filters use promoted columns, while ad details use raw JSON. Fixing only rendering would leave filters and counts inconsistent; re-import skips existing IDs.
- **Consequence**: any changed batch deletes `summary_version` in the same transaction; the existing summary build restores consistent counts after repair. Interrupted batches roll back, committed batches are safe to revisit, and completion is marked only after scanning. Startup/activation reports progress and uses the existing import/removal/dataset-change gate. No source re-import, new dependency or ad-schema change. The one-time raw-JSON scan and optional summary rebuild can take minutes and need WAL disk space on large datasets; full-scale duration and native post-migration interaction remain unverified.

## D49. Confirmed manual reprocessing from stored ads
- **Requirements**: DAT-026, DAT-012, UI-018, UI-022, NFR-004
- **Decision**: add Reprocess dataset to Datasets, using the shared modal with Cancel focused and a warning about runtime, temporary disk space and blocked dataset mutations. Pass the confirmed dataset ID through IPC and reject mismatches or concurrent import/build/dataset operations. Reuse the build lane and `task:event` top progress notifications.
- **Why**: re-import skips stored IDs and summary startup skips completed builds, so neither reliably regenerates every derived value after normalization or indexing changes.
- **Consequence**: one SQLite transaction reads stored raw JSON in 500-row batches, reapplies `toRow()` to promoted columns, regenerates contentless FTS, all seven summary tables and source counts, creates missing deferred indexes, runs `REINDEX` and `ANALYZE`, and updates migration markers. IDs, rowids, raw JSON, source paths/import dates and dataset metadata remain unchanged. Failures roll back and restore the previous summary UI state; errors use both the shared modal and a dismissible top notification that survives progress cleanup. Completion refreshes catalog statistics and renderer results without clearing filters. WAL readers retain committed data while processing; no source files, new dependency or schema migration are needed. Full reprocessing is not cancellable in-app and may require substantial WAL and index-sort disk space; full-scale runtime and peak disk usage remain unmeasured.

## D50. Track pending filtered statistics with widget overlays
- **Requirements**: UI-023, UI-022, UI-005, SRC-009, SRC-017, SRC-020
- **Decision**: track the current count, facets and timeline requests in the renderer with per-kind identity tokens. Reuse D47's delayed, indeterminate top notice under `stats-refresh` while any current request remains pending. Show immediate dimmed "Refreshing statistics" overlays with the existing loader icon over Top employers and Ads over time, and set their bodies' `aria-busy`. Clear each widget independently in request finalizers; superseded finalizers cannot clear newer feedback. Failures retain the existing dismissible error notice.
- **Why**: independent worker lanes keep results responsive, but old statistics can otherwise look current during slow broad-filter calculations. One completed lane must not imply that all statistics have finished.
- **Consequence**: overlays share the widget body's grid area, outside replaced chart/employer HTML and the body's scrolling content, so collapse and resizing remain intact. Titles and dividers stay uncovered; pointer-transparent overlays preserve existing employer-toggle and chart interactions. Honor reduced-motion preferences. No IPC, database, dependency or query-performance change; existing summary-build notices cover one-time builds after refresh requests settle.

## D51. Versioned file themes with semantic colors and local font stacks
- **Requirements**: UI-002, UI-003, UI-004, UI-005, UI-016, UI-018, UI-024, UI-025, UI-026, UI-027, UI-028, UI-029
- **Decision**: implement T19 in five separately reviewed stages, starting with the normative [theme contract](theming.md). Complete versioned JSON files define semantic color tokens, dark/light native-control scheme and default/monospace local font stacks. Keep the existing font-mode switch independent. Preserve the current look as protected ams-dark and add protected ams-light; no arbitrary CSS, scripts, remote assets or layout settings.
- **Why**: a binary light/dark toggle cannot support portable user-authored palettes; existing hard-coded CSS/SVG/splash colors prevent complete themes. Semantic names make files understandable without reading selectors. Explicit font stacks extend customization without network font dependencies.
- **Consequence**: later stages introduce allowlisted validation, bundled JSON defaults, main-owned application-wide theme storage and narrow preload operations. Apply saved selection before first paint, including splash/window backgrounds. A separate Settings section opens self-themed preview panels with independent export/delete controls; select immediately without closing, reject duplicate/reserved names and confirm custom deletion. Deleting the active custom theme falls back to ams-dark. Invalid imports leave state unchanged; invalid startup selection recovers with a warning. Strict complete token sets require versioned compatibility handling. Both defaults, reference, validation and tests must change together when tokens change. No dependency, dataset schema or query change. Stage 1 is documentation only; runtime behavior remains unimplemented.
- **Stage 2 implementation**: main reads and validates bundled ams-dark once at module startup. The read-only synchronous `theme:current` IPC handler returns this in-memory snapshot, with no disk/database access in the handler. Both sandboxed preloads expose it; external shared/renderer scripts in each HTML head apply validated custom properties before styles load, without changing CSP or Electron sandboxing. Main and splash BrowserWindow backgrounds use the same snapshot. Existing CSS aliases preserve local selectors while mapping to named tokens; SVG uses theme properties directly. Font mode remains independent. Version-1 hex alpha values round old decimal opacity to the nearest 8-bit value; browser parity allows that quantization. No theme persistence, custom-file operations or user-facing selection yet.

## D52. Persist theme selection before broadcasting live updates
- **Requirements**: UI-002, UI-003, UI-005, UI-025, UI-028, UI-029, UI-022
- **Decision**: T19 stage 3 bundles ams-light under the same complete version-1 color/font contract and adds a main-owned `<userData>/themes.json` selection catalog (`{version:1, activeId}`). Load both built-ins and selection before creating splash or main; continue serving the snapshot through the existing read-only startup IPC. Restrict activation to known IDs from the main window. Serialize asynchronous activation writes and replace the catalog atomically using private temporary files, then change current state, native backgrounds and both renderers' custom properties. No temporary toggle or chooser is added.
- **Why**: renderer-only persistence cannot color the initial Electron/splash background, while applying before a successful save can leave the visible theme inconsistent with the next restart. Application-wide selection must remain independent of datasets and the existing monospace-mode preference.
- **Consequence**: missing catalog defaults silently to ams-dark. Invalid/oversized/unavailable selection recovers with a replayable dismissible warning and preserves the original file until a successful explicit selection. Failed saves preserve the active snapshot and report an error. Live updates do not reload views or mutate search/navigation/font settings. Catalog version is separate from theme schemaVersion; stage 4 must preserve compatibility when adding imported entries. Both built-ins use local font stacks; light surfaces use darker teal/blue/purple/pink accents, with tested text contrast. No dependencies, dataset writes, SQLite migrations or CSP changes. Native restart, live-update context, recovery and normal quit are verified on disposable data; full-dataset interaction and visual startup-flash observation remain unverified.

## D53. Own validated custom-theme copies and stage their removal
- **Requirements**: UI-024, UI-025, UI-027, UI-028, UI-029, UI-018, UI-022
- **Decision**: extend catalog version 1 with an optional custom metadata array while accepting the stage-3 two-field form unchanged. Copy strictly validated, bounded UTF-8 JSON into generated UUID paths under userData/themes; keep original imports untouched and never auto-apply imports. Reserve built-in and custom names case-insensitively. Return complete validated preview data or an unavailable error per entry. Main-window-only IPC uses native Open/Save paths, not renderer-supplied paths; independently reject built-in removal and exports inside userData/bundled source.
- **Why**: imported files must remain stable after their source moves, names must not become paths, and one damaged palette must not block startup or hide valid themes. Catalog/file mutations need a recoverable ordering rather than leaving half-deleted active themes after a failed write.
- **Consequence**: serialize import/export/activation/removal. Commit an imported copy before catalog metadata and roll it back if the catalog fails. Stage deletions as .json.removing, persist removal/fallback before updating windows, restore on rollback/startup when still registered and clean committed stages. Missing/corrupt custom files stay removable/listed; unknown orphan imports remain inert. Both catalog and theme files are capped at 64 KiB; reject non-regular/symlink files and a symlink storage directory. Revalidate custom files on activation/export. Atomic exports replace only the chosen external destination, preserving built-ins and managed storage. File operations reuse top progress/error notices; renderer helpers reuse in-app confirmations and prevent duplicate work. Chooser wiring stays stage 5; direct DevTools deletion bypasses renderer confirmation intentionally. No dependencies, database changes or CSP relaxation. Native startup/removal/restart verified with disposable data; actual native Open/Save interaction remains unverified.

## D54. Theme as an Appearance row with self-themed chooser panels
- **Requirements**: UI-002, UI-005, UI-016, UI-018, UI-026, UI-027, UI-028, UI-029
- **Decision**: T19 stage 5 places Theme first under Settings > Appearance, with its label left and active-name button right. This user-requested revision supersedes D51's separate Theme section. Settings content caps at 450 px, and the name button uses a 30 px minimum height with 3 px vertical padding, per the user's compact-layout revisions. The button opens a native modal whose panels use their own validated colors and current-mode font stack, name and swatches. Native selection buttons and separate download/trash siblings prevent nested actions; unused panel space also selects. Show a check plus pressed state; protect built-ins with disabled, explained trash controls. Unavailable entries cannot select/export but remain removable.
- **Why**: theme and typography belong together; the active-name button occupies the same right-hand control position as the monospace switch without pretending themes are binary. Self-themed previews make custom palettes inspectable before selection.
- **Consequence**: selection applies immediately and keeps the modal open. Reuse stage-4 confirmation/error/file-operation helpers, guard pending work, retain focus through refreshes and restore the Settings trigger on close. Native modal containment plus shortcut guards blocks background navigation. No new tokens, dependencies, storage format or database changes. Final stage verification is recorded in T19 and the theming reference.

## D55. Precompute organization-based employer identities
- **Requirements**: SRC-020, SRC-022, NFR-005, NFR-010, UI-022
- **Decision**: supersede D43/D45 exact-name identity for ads with `employer.organization_number`. Promote a trimmed string ID into `ads.employer_id`; preserve original names/raw ads. Missing IDs retain exact-name identity and never merge with identified organizations just because names match. Store per-ID/name variant counts in `sum_employer(org_id,v,n)` and precompute `employer_catalog(org_id,name_key,v,n)`: one row per organization or missing-ID exact name, with a deterministic binary-minimum existing name and combined total. Labels remain dataset-wide even under filters. Import/removal accumulators update only affected catalog identities in the same transaction; reprocessing regenerates both tables. An indexed catalog read serves unfiltered Top-30; filtered requests count stored identities and join catalog labels, without parsing JSON or deriving name mappings on each query.
- **Why**: `Kils Kommun` and `KILS KOMMUN` share organization ID `2120001751` and must appear/filter as one employer. Precomputation avoids paying identity/label normalization costs on every filter update; distinct IDs with the same name must remain distinct.
- **Consequence**: connection opening adds the nullable column under a serialized schema lock; the build worker backfills IDs from stored raw JSON in retryable 500-row transactions, migrates the old employer summary schema and builds `ix_employer_id(employer_id,pub_date)` plus summaries/catalog. `employer_identity_version = '1'` and summary version 2 gate readiness; existing progress/error notices cover the work. No re-import, dependency or FTS change. New renderer selections are `{id,label}` (`id:null` for name-only records); legacy session strings remain exact-name filters. OR/AND semantics, native buttons, chips and dataset/session lifecycle remain unchanged. 102 tests and a normally closed disposable native fixture pass; full-scale backfill time/disk cost, filtered latency and physical native keyboard remain unverified. Live data untouched during verification.

## D56. Generate and display third-party license notices
- **Requirements**: NFR-011, UI-030
- **Decision**: before `start`, `pack` or `dist`, generate a deterministic JSON manifest from non-development package-lock entries, including each installed production package's declared license and every root license/copying/notice text. Add Electron explicitly because it is a runtime despite being a dev dependency. Keep electron-builder and other build-only tools out. Verify Electron's Chromium notice exists and reuse the copy bundled by Electron rather than duplicating its ~20 MB file. Package the generated manifest as an extra resource; main-process IPC reads it with the platform's bundled Chromium notice. Settings presents package texts using text nodes and Chromium's generated project list in a sandboxed frame with scripts, remote assets and links disabled.
- **Why**: published binaries need a complete, inspectable license inventory tied to components actually used by the app. Existing Electron notices are the authoritative license source for its 779 bundled projects; copying them into another generated file would bloat the package without improving coverage.
- **Consequence**: no new dependencies or database changes. Missing metadata, license texts or Electron notices fail generation/load instead of producing an incomplete list. Linux packaging and macOS resource-path fixtures are verified; Windows/macOS binaries and native interaction with the full Chromium document remain unverified.

## D57. Read all third-party licenses in one dedicated view
- **Requirements**: UI-030, NFR-011
- **Decision**: supersede D56's inline Settings presentation and sandboxed frame. Settings retains a third-party licenses section with a "View third party licenses" button. It opens a separate history-backed view with an ad-style Back bar and one full-height page scroll area. Keep Settings selected in the sidebar and preserve list context. Load notices lazily on entering this view and retain the rendered content for the session.
- **Why**: full notices need the width and scrolling behavior of a reading view, not a narrow Settings column or nested scrolling document.
- **Consequence**: parse only the bundled Chromium report in an inert template, then copy each product heading and complete license text into newly created text nodes. Never attach source markup, scripts, styles, links or assets to the live document. Package notices use the same text-only presentation and existing theme/font tokens; no dependency, IPC, schema or packaging change. Native Electron interaction remains unverified.

## D58. Enrich legacy taxonomy and location from dataset-local records
- **Requirements**: DAT-015, DAT-016, DAT-012, DAT-009, NFR-004, NFR-005
- **Decision**: use only records already imported into the active named dataset as offline reference data. Match exact `occupation.legacy_ams_taxonomy_id` to a complete field/group/occupation tuple, and `workplace_address.municipality_code` to municipality and region labels. Apply each dimension only when all current reference records agree; fill only values absent from the source projection. If later import or source removal changes consensus, recompute affected ads and restore their source projections from immutable `raw` where a derived value is no longer valid. Persist reference contributions and index legacy keys per ad; do a one-time raw-JSON backfill for existing datasets in the build worker. Import, removal and manual reprocessing update mappings and affected summaries in their existing workers.
- **Why**: 2007–2017 source records have usable legacy occupation IDs and municipality codes, while later records provide modern taxonomy and geographic hierarchy. Dataset-local references preserve offline behavior and isolate named datasets. Consensus avoids arbitrary choices and makes results independent of import order; restoring from raw preserves original values when references conflict or disappear.
- **Consequence**: add indexed legacy-key columns and per-dataset mapping tables, with a resumable one-time migration and summary rebuild when projections change. Raw source records remain unchanged; municipality and region resolve independently, so a region conflict need not block an unambiguous municipality. Backfill and reconciliation run off the main process. Per-import cost scales with newly inserted references and affected legacy-key rows rather than rescanning the full database. No external reference path, network request or dependency is introduced. Full-scale migration and import/remove costs require measurement.
