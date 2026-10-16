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
