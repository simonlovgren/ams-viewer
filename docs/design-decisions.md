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
- **Consequence**: JSON array files (`[...]`) are supported but read fully into memory; prefer JSONL for large files.

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
- **Why**: options must stay visible (grayed at count 0) so the filter panel does not jump around. The facets worker runs the unfiltered group-by once per dimension (cached, invalidated via `PRAGMA data_version`), runs the filtered group-by only when relevant filters are active, and merges counts onto the full list.
- **Consequence**: payload always contains every option (~2.5k occupations, ~300 municipalities at one quarter; more with all years). Cold start of the cache costs ~300 ms; filtered updates ~60 ms. During imports the cache is rebuilt often.

## D16. Free-text entries as chips inside the search input
- **Requirements**: SRC-016, SRC-003, SRC-008
- **Why**: several keywords should be combinable and individually removable. Enter commits the typed text to `terms`; the uncommitted text in `q` still filters live. Main joins `terms` + `q` and the FTS query ANDs every token, so each entry behaves as before (prefix match, `"phrases"`).
- **Consequence**: Backspace in an empty-at-caret input removes the last entry; the native search-clear button is hidden. Terms are persisted with the other filters.

## D17. Layout state (menu collapse, filter width and collapse) kept in the renderer
- **Requirements**: UI-007, UI-008, UI-009
- **Why**: pure presentation state; stored in `localStorage` (`menuCollapsed`, `filtersCollapsed`, `filterW`) and applied through a body/view class and the `--filter-w` CSS variable, so no IPC or framework is needed. The resize handle uses pointer events with pointer capture; the filter width is clamped to 310 px (previous fixed width) up to min(720 px, 60% of the window).
- **Consequence**: the collapsed menu hides text only via CSS; nav items carry `title` tooltips for accessibility. The menu is collapsed by default (`menuCollapsed` unset); an explicit choice is stored as `1`/`0`.

## D18. Ads-over-time chart: server-side binning, hand-built SVG
- **Requirements**: SRC-017, SRC-009, NFR-003
- **Why**: the chart must follow every active filter and adapt its resolution to the period. `timeline()` in `db.js` groups matching ads by year/month/week/day (SQL `substr` / `date(..,'weekday 0','-6 days')`), fills empty bins and returns the unit and bounds; it is part of the facets result, so it runs in the facets worker and costs no extra IPC. The renderer draws an SVG with no charting library (no new dependency); axis labels are chosen by priority (first bin, then year/month landmarks, then fillers such as months, week numbers or days) and dropped when they would overlap.
- **Consequence**: the chart is recomputed on every filter change (cheap without a date filter, ~0.8 s at 130k ads with a date filter because it runs a second grouped query; see constraints). Its width follows the resizable sidebar through a `ResizeObserver`. Inline SVG inherits the global icon stroke style, so the chart resets `stroke`.
