# Tasks (planned and active)

Planned work that is specified but not started, plus active tasks. Each task links to its requirements; when work starts, set the requirement to `In progress` and record decisions in [design-decisions.md](design-decisions.md). Last updated 2026-10-18.

| # | Task | Requirements | Size |
|---|---|---|---|
| T6 | Full-scale performance of filtering, counts and statistics (lower priority since startup is fixed; [plan](full-scale-performance-plan.md)) | NFR-003, NFR-004, NFR-005 | L |
| T1 | Done: vertically resizable filter widgets | UI-010 | S |
| T2 | Done: collapsible filter widgets and chart | UI-011, UI-007, SRC-017 | S |
| T3 | Live-updating import file list | DAT-013 | S |
| T4 | Import statistics per file (time, duplicates, errors) | DAT-014 | M |
| T5 | Geographical hotspot view | SRC-019 | L |
| T7 | Done: monospace typography and top-level Settings | UI-012, UI-016, NAV-009 | S |
| T8 | Done: matching, resizable statistics widgets and collapsible columns | UI-013, UI-011, UI-019, UI-020, UI-021 | M |
| T9 | Top-30 employers widget | SRC-020 | M |
| T10 | Employer logo cache | AD-010 | M |
| T11 | Favorite lists and star-action popover | LST-009, LST-010, LST-011, LST-012, LST-013 | M |
| T12 | Enrich older ads from newer taxonomy and geographic data | DAT-015, DAT-016 | L |
| T13 | Done: Find and navigate text matches in the ad view | AD-011 | S |
| T14 | Done: Contextual keyboard-shortcut help modal | NAV-011, NAV-010, UI-001 | S |
| T15 | Named dataset storage, lifecycle and existing-database migration | DAT-017, DAT-018, DAT-021, DAT-022 | L |
| T16 | Datasets page and dataset metadata editor | DAT-019, DAT-020, DAT-021, DAT-022 | M |
| T17 | Dataset chooser, summary statistics and switching | DAT-017, DAT-023, DAT-024 | M |

Current focus: T15, per user request. T7, T2, T13, T14, T1 and T8 are complete (D26, D27, D28, D31, D34, D35). T9 and T5 use the statistics bar. T3 goes with T4; T10 is independent. T6 follows the [full-scale performance plan](full-scale-performance-plan.md) when filtered use at full scale feels slow, and before T9 and T5 if their queries make it worse.

## T1. Done: vertically resizable filter widgets (UI-010)
- Completed 2026-10-16; D34. Scope broadened to all six filter widgets at the user's request. Drag each bottom divider to resize the widget above; keyboard Up/Down and Home/End also work.
- Body heights are independent and persisted; collapse and Clear all preserve them. Bounds are 80 px through window height minus 160 px. Trees grow beyond their old cap, with overflowing content scrolling inside the resized body.
- All 18 renderer tests and syntax checks passed. Browser fixture passed all six pointer drags, keyboard bounds/steps, reload persistence, collapse and Clear all retention, and non-overlapping layout at 960x600 and 1400x900 in both fonts; minimum-window screenshot reviewed. Native Electron interaction and quit/relaunch not manually tested.

## T2. Done: collapsible widgets (UI-011, UI-007, SRC-017)
- Completed 2026-10-16; D27. Ads over time, Published, Occupation, Location, Employment and Working hours stay in the filter column and collapse independently using native title buttons (click/Enter/Space).
- Shared `data-widget` helper, independent `localStorage` collapse keys and active-selection badges; collapse preserves filters and tree search. The chart skips zero-width rendering and redraws on expand/resize.
- Fixed minimum-width overlap by preventing filter sections from shrinking; scrolling keeps titles and inputs separate. T1 now adds saved heights for all widgets and retains them across collapse (D34).
- Nine renderer tests passed. Browser fixture verified reload persistence, keyboard controls, badges, drag resizing and non-overlapping 310 px layout at 960x600 and 1400x900 in both font modes. Electron startup passed against 11.25M ads; actual quit/relaunch preference retention not manually tested.

## T3. Live-updating import file list (DAT-013)
- Today `renderData()` runs on the data view and after import completion; per-file completion (`file-done`) is ignored, so the list changes only at the very end.
- On each `file-done` event, refresh the sources table (and totals) without re-rendering the whole view or the progress panel; also when a file is removed.
- Consider also updating the row of the file currently importing (ads added so far) from progress events.
- Watch out: the code that restores `importState` after `renderData()` is a workaround; a targeted table update removes the need for it.

## T4. Import statistics per file (DAT-014)
- Show per file: elapsed time, duplicates (skipped), errors (and added count).
- The worker already counts `inserted`, `skipped` and `errors` and emits them in `file-done`; elapsed time must be measured in the worker.
- Schema change: add columns to `sources` (`duration_ms`, `skipped`, `errors`, maybe `size_bytes`) with an `ALTER TABLE` migration at open time (existing rows stay null and show as "n/a"); record a decision (new D with DAT-014).
- Re-importing a file overwrites its row; decide whether to keep a history (suggest: no, latest run only).
- Also useful: show the same figures live for the running import.

## T5. Geographical hotspot view (SRC-019)
- Goal: in the right statistics bar, a map-like view of where the filtered ads are, as a hotspot/heat overlay, following all active filters like the chart (which stays in the filter column).
- Data: `workplace_address.coordinates` exists in newer ads (2026 sample has `[lon, lat]`); older eras mostly have only municipality/region (and none before 2018). Needs a survey of coordinate coverage per file first.
- Open questions to settle with the user before building:
  - Base map without network (requirement NFR-002: offline): bundle a simplified Sweden outline (GeoJSON, e.g. from public domain/open data, with licence noted) and draw it in SVG, versus loading online map tiles (violates offline, adds a network dependency and a CSP change).
  - Fallback location for ads without coordinates: municipality centroid (needs a municipality-to-coordinate table) so older ads still show.
  - Aggregation: grid or municipality bins computed in the facets worker (new query like `timeline()`), to avoid shipping millions of points.
  - Interaction: hover shows count; optional click to filter by municipality/region (would tie into SRC-014 location selections).
- Storage: promote `lat`/`lon` (or a grid cell id) to columns, which is a schema change and needs a re-import or a backfill from `raw`; record a decision and update `data-model.md`.
- Performance budget: must stay within NFR-003/NFR-005; measure on the full data set.

## T6. Full-scale performance of filtering, counts and statistics (NFR-003, NFR-004, NFR-005)
- Update 2026-10-16: facet options, total, date-only counts and the chart now use summary tables (D23, NFR-010); remaining: filtered group-by cost on broad filters, deep OFFSET paging, cold-cache queries.
- Status 2026-10-15: the startup and freeze problems at about 70 GB / 11 million ads are fixed (D22: reads in workers, splash, window shown in about 3 s). Priority lowered by the user. What remains is slow filtered counts, facet counts, timeline and cold queries; main process and list stay responsive meanwhile.
- Follow the [full-scale performance plan](full-scale-performance-plan.md) (sections 1 and 2 are largely done by D22): measure first, optimize facets/counts/timeline, benchmark compact metadata storage, bound obsolete work and replace deep OFFSET paging.
- Retain Electron + SQLite initially. Consider Rust or another engine only if profiling demonstrates a remaining bottleneck that warrants the change.
- Existing measurements at 926k ads are not a full-scale baseline; remeasure startup, list, keyword, exact counts, facets, timeline and detail lookup on the full dataset.

## T7. Done: monospace typography and Settings (UI-012, UI-016, NAV-009)
- Completed 2026-10-16; D26. User selected monospace for all main-window text, including ad descriptions.
- Offline system font stacks controlled by CSS variables. Settings > Appearance offers an immediate, persistent on/off checkbox; monospace defaults on.
- Settings is a separate sidebar view with browser-style history; search context stays alive. Future settings can use additional sections; light/dark mode is not part of T7.
- Renderer regression tests, browser fixture layout/keyboard/history/reload checks and Electron startup passed. Actual Electron quit/relaunch retention was not manually tested.

## T8. Done: statistics bar (UI-013, UI-011, UI-019, UI-020, UI-021)
- Completed 2026-10-16; D35, D36. Right-hand column starts at 280 px and resizes in width through its left divider, with independent persistence, pointer capture and Left/Right/Home/End keyboard controls. It hosts Geography and Top employers shells, using the same title buttons, saved collapse state and vertically resizable bottom dividers as filters. Map/employer data stays in T5/T9; the timeline stays beside time filters.
- Filter and statistics columns have independent remembered icon toggles with accessible names and expanded states, consistent with the menu. Statistics starts hidden below 1200 px; opening a column takes priority when both cannot leave 420 px for results, without overwriting the other column's preference. Preferred filter width returns after narrowing/reload/widening.
- All 23 renderer tests and syntax checks passed. Browser fixture passed both statistics-widget pointer drags, keyboard resize/title collapse, column toggles, reload persistence, sidebar-width restoration and non-overlapping layout at 960x600 and 1400x900 in both fonts. Sidebar-width follow-up verified real 280-to-400 px dragging, keyboard resizing and collapse/reload retention; saved 720 px width clamps to 467 px at minimum size, leaving 420 px for results, then restores on widening. Statistics screenshot reviewed within the browser's visible area. Initial T8 Electron startup opened 11.25M ads in 578 ms; native interaction/resize and actual quit/relaunch persistence not manually tested.

## T9. Top-30 employers widget (SRC-020)
- Query: group the filtered ads by employer name (`ads.employer`) and return the 30 most frequent, as part of the facets worker (`facets()` in `db.js`, like `timeline()`), following all active filters.
- Index: `employer` has no index; at full scale a grouped scan over millions of rows is slow, so add an index or fold it into the summary-table work (T6); measure before deciding.
- Display: labels (chip style) with the ad count, ordered by count descending; full name in a tooltip; collapsible like the other widgets.
- Open questions: names differ in spelling and case (could group on `employer.organization_number` when present, which exists from 2018); whether clicking a label should filter by that employer (needs a new filter dimension, see "Adding a new filter dimension" in `data-model.md`, and its own requirement).
- Docs: decision if grouping by organisation number or adding an index or filter; `data-model.md` if the schema changes.

## T10. Employer logo cache (AD-010)
- Today the ad view loads `logo_url` directly in an `<img>` (CSP `img-src` allows any `https:`); nothing is stored, so every view hits the remote host and fails offline.
- Cache on first view only; the importer must not fetch logos. Store files under the data folder next to `ads.db` (for example `<userData>/logo-cache/`), one file per logo, named by a hash of the URL (never use the URL or ad text as a file name).
- Flow: the renderer asks main (`api` call) for the logo; main returns a local file on a cache hit, otherwise downloads it, stores it, and returns it. Serving the file needs a safe route: a `data:` URL for small images (CSP already allows `data:`), or a registered custom protocol for the cache folder (would need a CSP change and a decision).
- Download in the main process with limits: `https` only, redirect cap, timeout, maximum size (for example 1 MB), accept only image content types, and verify the response is a real image. This replaces the browser's `no-referrer` load, so send no cookies or referrer.
- Failures: remember failed URLs (negative cache entry with an expiry, for example a day) so dead links are not retried on every view; fall back to the initial-letter box as today.
- Many ads share one employer logo URL, so the cache is small compared to the database; still decide whether to bound its size (suggest: no limit at first, show size on the Data sources page, offer "clear cache").
- Privacy and offline: first view of each logo contacts the host once; afterwards it works offline. Mention this in the README/constraints.
- Decisions to record: where files live and how they are served, security limits, negative caching. Update `system-description.md` (new data flow) and `constraints.md`.

## T11. Favorite lists and star-action popover (LST-009–LST-013)
- Status: planned only; no app implementation yet. Priority relative to existing tasks is not assigned.
- [ ] Provide one default list named "Favorites".
- [ ] Allow creation of custom-named lists and deletion of custom lists.
- [ ] Add a star-icon action for ads. Clicking it opens a bubble/popover with the available lists; choosing a list adds the current ad to it.
- [ ] Keep a plus (+) control as the last popover entry. Clicking it replaces that entry with a new-list name input and an "Add" button on the right.
- [ ] On "Add", create the named list and add the pending ad to it in the same workflow, without asking the user to star the ad again.
- Before implementation, settle: where saved lists are browsed and managed; star placement in results and/or ad detail; persistence across restarts and re-imports; handling source removal; whether the default list can be deleted; name validation and duplicate names; removing ads from lists and membership in multiple lists.
- Verification: default list available; custom list creation/deletion; adding an ad to an existing list; plus-to-input transition and button placement; creating a list from the popover also adds the original ad. Include keyboard operation, cancellation and failure handling when implementing.
- Docs: planned interaction recorded in D24. Record storage/schema and navigation decisions before implementation; update affected requirements, data model, system description, constraints and developer notes as needed.

## T12. Legacy taxonomy and geographic enrichment (DAT-015, DAT-016)
- Status: planned only; priority relative to existing tasks is not assigned.
- Inspect representative older and newer records first. Older datasets contain occupation `legacy_taxonomy_id`; survey whether other taxonomy fields also expose usable legacy identifiers. Check which fields under `workplace_address` carry usable location information across dataset generations.
- Cross-reference legacy occupation identifiers with the newest available dataset containing both legacy identifiers and modern taxonomy information. Use reliable matches to fill missing occupation labels and hierarchy so older ads display and filter like newer ads. Assess other taxonomy fields after confirming their mappings.
- Similarly, cross-reference available `workplace_address` fields with the newest available geographic data to fill missing location labels and hierarchy. Do not assume names alone identify a unique place or that historical administrative boundaries match current ones.
- Preserve existing populated values and original source data. Keep ambiguous, conflicting or unmatched mappings unresolved rather than guessing; define mapping provenance and report matched, unmatched and ambiguous coverage.
- Before implementation, decide mapping keys and conflict rules, reference-dataset selection, offline persistence, import-time versus backfill enrichment, and how newly imported reference data updates previously imported ads. Keep expensive work off the main thread and update affected search indexes and summary tables consistently.
- Verification: fixtures from older and newer generations; resolved occupation hierarchy and location displayed in list/detail and available in filters; ambiguous and unmatched cases unchanged; existing values preserved; import-order independence and repeat-run stability. Measure coverage and full-dataset processing cost.
- Docs: record implementation decisions with DAT-015/DAT-016; update the data model and migration/backfill procedure, data flow, constraints and developer notes as needed. Coordinate geographic coverage findings with T5.

## T13. Done: Find and navigate text matches in the ad view (AD-011)
- Completed 2026-10-16; D28. The ad toolbar searches displayed content case-insensitively, highlights all matches, reports the current position and cycles with previous/next buttons or Enter/Shift+Enter. Escape clears the query.
- Renderer tests passed. Browser fixture verified matching across headline and description, navigation, no-match and clear states, and toolbar fit at 960x600 and 1400x900. Real Electron interaction was not manually tested.

## T14. Contextual keyboard-shortcut help modal (NAV-011, NAV-010, UI-001)
- Status: done 2026-10-16; D31.
- `?` opens a native dialog outside editable controls. Global shortcuts and only the active view's shortcuts are listed, including contextual `/`, keyword-entry/result keys and ad-find navigation/clear keys.
- Escape and the close button dismiss the dialog and restore focus. The modal contains focus and blocks keyboard/mouse navigation behind it; shortcut content is static and aligned with existing handlers.
- Verification: 14 renderer tests passed. Browser fixture passed `?` in all four views, literal `?` in the keyword field, repeated activation, Escape and close-button dismissal, focus containment/restoration, and blocked background navigation. At 960x600 the dialog fit without scrolling in both font modes. Real Electron interaction was not manually tested.

## T15. Named dataset storage and lifecycle (DAT-017, DAT-018, DAT-021, DAT-022)
- Status: In progress 2026-10-18; D39 implements catalog, per-dataset DB paths, legacy migration and lifecycle IPC. T16/T17 UI and renderer refresh remain separate.
- Each dataset has a generated stable ID, name and optional multiline description in `<userData>/datasets.json`; DB paths use IDs, never names. Initial name is exactly "default". Names trim whitespace, reject blank values and duplicate case-insensitive names.
- Existing `ads.db` and WAL/SHM sidecars move into `datasets/default.db` without copying or re-importing. Migration resumes partial moves and refuses conflicts. The user confirmed an existing backup before the real migration.
- Imports, source removal, search, filters, ad lookup and summaries use active dataset DB. Activation drains and restarts all five read lanes. Dataset changes/deletion are rejected during import or summary build.
- Deleting active dataset selects oldest remaining. `default` may be deleted if another dataset remains; deleting the last dataset creates an empty active `default`. DB/WAL/SHM deletion is staged, with rollback and startup recovery. Original source files are untouched.
- Verified: migration and crash-recovery tests; same ad IDs/source names remain isolated across DBs; real startup preserved 11,252,350 ads after moving the 70.4 GB DB. IPC create/switch/delete failure paths and renderer refresh still need integrated verification with T16/T17.
- Docs: D39; data model, system description, constraints, README and developer notes updated. Heavy database work remains in workers.

## T16. Datasets page and metadata editor (DAT-019–DAT-022)
- Status: planned only; depends on T15. Preserve the current source-management layout, import progress, source list, totals and source-removal behavior. Coordinate T3/T4 against this renamed view.
- Rename the navigation entry and Data sources view to "Datasets". Use the active dataset name as the page heading, with adjacent Edit and Swap dataset icon buttons and accessible names/tooltips.
- Edit enters metadata editing with Save and Discard controls. Clicking the heading enters the same editor and additionally selects the full name text. Include a multiline description box; persist both values only on Save and restore stored values on Discard.
- New-dataset creation starts in this editor with the name field focused and its text selected. Reject empty/whitespace-only names and allow empty descriptions. Discarding creation must not leave an unnamed dataset.
- Before implementation, settle unsaved-change handling when navigating, switching or closing the app, and where the optional description appears outside editing.
- Verification: heading click versus Edit button, new-dataset initial focus/selection, keyboard operation, valid/invalid names, multiline description round-trip, Save/Discard for existing and new datasets, and import/source-management regressions. Check minimum-window and wider layouts for overlap.
- Docs: planned UX is recorded in D38. Update current-view names in requirements notes and user/architecture docs when the rename is implemented, not before.

## T17. Dataset chooser and switching (DAT-017, DAT-023, DAT-024)
- Status: planned only; depends on T15 and integrates with T16.
- Swap dataset opens a compact list consistent with the existing UI. Each selectable entry shows the dataset name, only the first description line when present, imported-file count and ad count; optional extra statistics can reuse the year range.
- Keep "+ add new dataset" as the final option. It starts T16's creation editor, with the name field focused and its text selected. Choosing an existing dataset activates its database and refreshes the dataset page and all dataset-dependent views.
- Coordinate main-process connections, read/import workers, in-memory caches, summary tables and sequence counters so late results from the previous dataset cannot populate the new one. Decide filter/history/ad-detail handling across datasets and how failed switches recover before implementation.
- Fetch chooser summaries without scanning ad tables or opening every large database on the main thread; decide how counts stay current after imports and removals, and define pending/error states.
- Verification: chooser ordering and final add option, missing/multiline description previews, accurate per-dataset statistics including empty datasets, mouse/keyboard selection and dismissal, successful and failed switches, and stale-response isolation. Measure switching and chooser latency with small and full-scale databases.
- Docs: record switching/state/performance decisions with the related DAT IDs; update data flow, constraints and testing recipes as needed.

## Other open items (not requirements yet)
- Re-import `2016.jsonl` (shows 0 ads) and import the remaining files.
- Visual review of the recently added UI (chart, AND/OR button, resizable sidebar, zero-count styling, search chips).
- Ideas listed in [developer-notes/project-state.md](developer-notes/project-state.md).
