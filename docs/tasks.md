# Tasks (planned and active)

Planned work that is specified but not started, plus active tasks. Each task links to its requirements; when work starts, set the requirement to `In progress` and record decisions in [design-decisions.md](design-decisions.md). Last updated 2026-10-31.

| # | Task | Requirements | Size |
|---|---|---|---|
| T1 | Done: vertically resizable filter widgets | UI-010 | S |
| T2 | Done: collapsible filter widgets and chart | UI-011, UI-007, SRC-017 | S |
| T3 | Live-updating import file list | DAT-013 | S |
| T4 | Done: latest-run import statistics and static enriched-ad counts | DAT-014 | M |
| T5 | Geographical hotspot view | SRC-019 | L |
| T6 | Full-scale performance of filtering, counts and statistics (lower priority since startup is fixed; [plan](full-scale-performance-plan.md)) | NFR-003, NFR-004, NFR-005 | L |
| T7 | Done: monospace typography and top-level Settings | UI-012, UI-016, NAV-009 | S |
| T8 | Done: matching, resizable statistics widgets and collapsible columns | UI-013, UI-011, UI-019, UI-020, UI-021 | M |
| T9 | Done: Top-30 employers widget and exact-name selection | SRC-020, SRC-022 | M |
| T10 | Employer logo cache | AD-010 | M |
| T11 | Favorite lists and star-action popover | LST-009, LST-010, LST-011, LST-012, LST-013 | M |
| T12 | Done: enrich older ads from newer taxonomy and geographic data | DAT-015, DAT-016 | L |
| T13 | Done: Find and navigate text matches in the ad view | AD-011 | S |
| T14 | Done: Contextual keyboard-shortcut help modal | NAV-011, NAV-010, UI-001 | S |
| T15 | Done: Named dataset storage, lifecycle and existing-database migration | DAT-017, DAT-018, DAT-021, DAT-022 | L |
| T16 | Done: Datasets page and metadata editor | DAT-019, DAT-020, DAT-021, DAT-022 | M |
| T17 | Done: Dataset chooser, statistics, switching and deletion | DAT-017, DAT-018, DAT-020, DAT-021, DAT-023, DAT-024 | M |
| T18 | Manually report and exclude erroneous ads | DAT-025 | M |
| T19 | Done: file-based themes, light palette and Appearance chooser | UI-002, UI-003, UI-024, UI-025, UI-026, UI-027, UI-028, UI-029 | L |
| T20 | Done: generated third-party license inventory and dedicated reading view | NFR-011, UI-030 | M |

T12 completed 2026-10-31 (D58). T15–T17 completed 2026-10-18 (D39–D42). T7, T2, T13, T14, T1, T8 and T9 are complete (D26–D28, D31, D34–D36, D43–D44). T9 uses the statistics bar; T5 remains planned, with no placeholder shown. T3 remains planned independently of T4; T10 is independent. T6 follows the [full-scale performance plan](full-scale-performance-plan.md); filtered T9 latency on the full database remains unmeasured. T12 full-scale migration cost and cross-quarter reference comparison remain unverified.

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
- Completed 2026-10-31; D61. Store latest-run `duration_ms`, `inserted`, `skipped` and `errors`, plus a static current `enriched` count on each source row. Existing rows keep null import-run values and display `n/a`; only an import of that source creates or replaces them.
- `enriched` counts current source ads whose promoted taxonomy/location fields contain values absent from immutable `raw`. Initialize once from stored records and maintain transitions during import, source removal and reprocessing. It is not a per-import count; D62/UI-031's separate live enrichment notice reports in-flight work instead of this stored statistic.
- Datasets table distinguishes current source ad total (`Ads`), latest-run inserts (`Added`) and current enriched ads. T3's live source-list refresh remains separate and planned.
- Regression coverage includes old-schema migration, latest-run metrics, static count initialization, import-order independence, conflict/removal/reprocess transitions and renderer display. All 126 tests, changed-file syntax checks and `git diff --check` pass. Full-scale count initialization/import overhead and visual fit remain unverified; shared browser server was unavailable.

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
- Completed 2026-10-16; D35, D36. Right-hand column starts at 280 px and resizes in width through its left divider, with independent persistence, pointer capture and Left/Right/Home/End keyboard controls. It initially hosted Geography and Top employers shells, using the same title buttons, saved collapse state and vertically resizable bottom dividers as filters. D43 removes the unavailable Geography shell; T5 remains planned. The timeline stays beside time filters.
- Filter and statistics columns have independent remembered icon toggles with accessible names and expanded states, consistent with the menu. Statistics starts hidden below 1200 px; opening a column takes priority when both cannot leave 420 px for results, without overwriting the other column's preference. Preferred filter width returns after narrowing/reload/widening.
- All 23 renderer tests and syntax checks passed. Browser fixture passed both statistics-widget pointer drags, keyboard resize/title collapse, column toggles, reload persistence, sidebar-width restoration and non-overlapping layout at 960x600 and 1400x900 in both fonts. Sidebar-width follow-up verified real 280-to-400 px dragging, keyboard resizing and collapse/reload retention; saved 720 px width clamps to 467 px at minimum size, leaving 420 px for results, then restores on widening. Statistics screenshot reviewed within the browser's visible area. Initial T8 Electron startup opened 11.25M ads in 578 ms; native interaction/resize and actual quit/relaunch persistence not manually tested.

## T9. Top-30 employers widget (SRC-020, SRC-022)
- Completed 2026-10-18; D43–D44. `facets()` groups exact stored employer text under all active filters and returns the 30 most frequent; unfiltered totals come from `sum_employer`. Labels show counts and full-name tooltips and collapse like other widgets.
- D55 (2026-10-31) consolidates spelling/case variants by organization ID; missing IDs retain exact-name grouping. IDs, dataset-wide representative names and unfiltered totals are precomputed on writes, not rebuilt during filtering. D45's native toggles and removable "Employer: …" chips now select organization IDs (or missing-ID exact names), OR within employers and AND with other filters. Existing filters, committed keywords and draft text remain unchanged. Session/ad navigation retains selections; Clear all and dataset switch reset them. Statistics retain SRC-020's filtered Top-30 behavior, not an own-filter-excluded employer option list.
- Summary version 2 rebuilds derived tables once in the background; source ads need no re-import. Filtered results use the existing bounded per-worker facet cache. D45 adds no schema/index or migration.
- Before summary precomputation, an unfiltered group-by took 167,837 ms on 11.25M ads. Filtered full-scale latency and the version-2 rebuild have not been verified; track remaining query cost under T6.
- `node --test src/main/db.test.js src/renderer/app.test.js` passes 46 tests, covering exact case/spacing, multi-employer OR, combined filters, all query paths, toggles, chips, Clear all, dataset reset and session state. Browser fixture verifies native Enter/Space, focus retention, request propagation, draft preservation and ad/reload retention; native Electron interaction and full-scale latency remain unverified.
- D55 verification: all 102 tests and syntax/editor checks pass, including precomputed read-only catalog queries, shared-ID consolidation, same-name/different-ID separation, missing-ID fallback, incremental removal/reprocessing, resumable legacy backfill and renderer identity/session workflows. Disposable native launch verifies one Kils entry, ID-backed chip and both spelling variants returned, then quits normally (574 ms startup). Live data untouched; full-scale backfill/disk cost, filtered latency and physical native keyboard remain unverified.

## T10. Employer logo cache (AD-010)
- Today the ad view loads `logo_url` directly in an `<img>` (CSP `img-src` allows any `https:`); nothing is stored, so every view hits the remote host and fails offline.
- Cache on first view only; the importer must not fetch logos. Store files under the data folder next to `ads.db` (for example `<userData>/logo-cache/`), one file per logo, named by a hash of the URL (never use the URL or ad text as a file name).
- Flow: the renderer asks main (`api` call) for the logo; main returns a local file on a cache hit, otherwise downloads it, stores it, and returns it. Serving the file needs a safe route: a `data:` URL for small images (CSP already allows `data:`), or a registered custom protocol for the cache folder (would need a CSP change and a decision).
- Download in the main process with limits: `https` only, redirect cap, timeout, maximum size (for example 1 MB), accept only image content types, and verify the response is a real image. This replaces the browser's `no-referrer` load, so send no cookies or referrer.
- Failures: remember failed URLs (negative cache entry with an expiry, for example a day) so dead links are not retried on every view; fall back to the initial-letter box as today.
- Many ads share one employer logo URL, so the cache is small compared to the database; still decide whether to bound its size (suggest: no limit at first, show size on the Datasets page, offer "clear cache").
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
- Status: implementation complete (2026-10-31; D58). Full-scale migration time/disk use and cross-quarter reference comparison remain unverified; no live dataset was changed.
- Progress follow-up (2026-10-31; UI-031/D62): separate stacked enrichment notice for imports, backfill and reprocessing, with throttled checks/newly enriched-ad counters and live source-count scan feedback. All 102 affected tests and syntax/editor checks pass; full-scale performance and native visual appearance remain unverified.
- Inspect representative older and newer records first. Older datasets contain occupation `legacy_ams_taxonomy_id`; survey whether other taxonomy fields also expose usable legacy identifiers. Check which fields under `workplace_address` carry usable location information across dataset generations.
- Cross-reference legacy occupation identifiers with the newest available dataset containing both legacy identifiers and modern taxonomy information. Use reliable matches to fill missing occupation labels and hierarchy so older ads display and filter like newer ads. Assess other taxonomy fields after confirming their mappings.
- Similarly, cross-reference available `workplace_address` fields with the newest available geographic data to fill missing location labels and hierarchy. Do not assume names alone identify a unique place or that historical administrative boundaries match current ones.
- Preserve existing populated values and original source data. Keep ambiguous, conflicting or unmatched mappings unresolved rather than guessing; define mapping provenance and report matched, unmatched and ambiguous coverage.
- Decisions: D58 uses exact legacy IDs/codes and complete tuples, dataset-local offline references, consensus-only fills, and immutable `raw` as the source-projection baseline. Backfill, import, removal and reprocessing run in existing workers; changed summaries are maintained with the relevant transaction.
- Verification: temporary worker fixtures cover migration/retry, both import orders, duplicate-safe contributions, consensus conflict/removal, source-value/raw preservation, independent municipality/region behavior, reprocessing and summary/facet consistency. `node --test src/main/db.test.js` passes. Disposable Electron startup passed; full-scale processing cost and native visual inspection remain unverified.
- Docs: D58 and implementation details are recorded in the data model and system description; DAT-015/016 are Implemented with full-scale caveats. Coordinate geographic coverage findings with T5.

### Initial coverage survey (2026-10-31)
- Read-only full-file scan of 2006–2017 JSONL files against `2026-Q3.jsonl` (129,721 records); no source files or app databases changed.
- Taxonomy: `occupation.legacy_ams_taxonomy_id` maps uniquely to a complete modern field/group/occupation tuple for 4,038,404 of 4,667,640 ads from 2007–2017 (86.5%). All 129,721 Q3 records have one aligned field, group and occupation item; two legacy occupation IDs have conflicting full tuples. 2006 is an outlier: 245,192 of 245,227 IDs are `0`, which has no Q3 mapping; 21 of the 26 distinct nonzero IDs map uniquely, covering 28 ads. Field/group legacy IDs are null throughout 2006–2017.
- Geography: across 2007–2017, 4,606,062 ads have `workplace_address.municipality_code`; 4,573,278 resolve to a unique municipality (99.3% of coded ads), and 4,076,347 also have a unique region hierarchy (88.5%). Ten codes have conflicting region metadata in Q3. For 2006, 242,308 of 245,227 ads have a code; 240,179 resolve to a municipality, while 22,700 have conflicting region data. `ALLA` (1,873 ads) and `1917` (256 ads) do not match. Free-text `city` is weaker than the code.
- Q3 carries municipality and region fields on 127,292 records and finite coordinates on 117,339. The scan does not compare all 2026 quarters. D58 resolves consensus and persistence policy; comparing Q1/Q2 2026 and measuring full-scale runtime/disk cost remain open.

## T13. Done: Find and navigate text matches in the ad view (AD-011)
- Completed 2026-10-16; D28. The ad toolbar searches displayed content case-insensitively, highlights all matches, reports the current position and cycles with previous/next buttons or Enter/Shift+Enter. Escape clears the query.
- Renderer tests passed. Browser fixture verified matching across headline and description, navigation, no-match and clear states, and toolbar fit at 960x600 and 1400x900. Real Electron interaction was not manually tested.

## T14. Contextual keyboard-shortcut help modal (NAV-011, NAV-010, UI-001)
- Status: done 2026-10-16; D31.
- `?` opens a native dialog outside editable controls. Global shortcuts and only the active view's shortcuts are listed, including contextual `/`, keyword-entry/result keys and ad-find navigation/clear keys.
- Escape and the close button dismiss the dialog and restore focus. The modal contains focus and blocks keyboard/mouse navigation behind it; shortcut content is static and aligned with existing handlers.
- Verification: 14 renderer tests passed. Browser fixture passed `?` in all four views, literal `?` in the keyword field, repeated activation, Escape and close-button dismissal, focus containment/restoration, and blocked background navigation. At 960x600 the dialog fit without scrolling in both font modes. Real Electron interaction was not manually tested.

## T15. Done: named dataset storage and lifecycle (DAT-017, DAT-018, DAT-021, DAT-022)
- Completed 2026-10-18; D39 implements catalog, per-dataset DB paths, legacy migration and lifecycle IPC. T16 adds metadata UI; T17 adds chooser, deletion UI and dataset-dependent refresh.
- Each dataset has a generated stable ID, name and optional multiline description in `<userData>/datasets.json`; DB paths use IDs, never names. Initial name is exactly "default". Names trim whitespace, reject blank values and duplicate case-insensitive names.
- Existing `ads.db` and WAL/SHM sidecars move into `datasets/default.db` without copying or re-importing. Migration resumes partial moves and refuses conflicts. The user confirmed an existing backup before the real migration.
- Imports, source removal, search, filters, ad lookup and summaries use active dataset DB. Activation drains and restarts all five read lanes. Dataset changes/deletion are rejected during import or summary build.
- Deleting active dataset selects oldest remaining. `default` may be deleted if another dataset remains; deleting the last dataset creates an empty active `default`. DB/WAL/SHM deletion is staged, with rollback and startup recovery. Original source files are untouched.
- Verified: migration and crash-recovery tests; same ad IDs/source names remain isolated across DBs; real startup preserved 11,252,350 ads after moving the 70.4 GB DB. Catalog lifecycle tests and T17 renderer tests cover creation, switching, deletion and error recovery.
- Docs: D39; data model, system description, constraints, README and developer notes updated. Heavy database work remains in workers.

## T16. Done: Datasets page and metadata editor (DAT-019–DAT-022)
- Completed 2026-10-18; D40/D41. Page rename, active-name heading, description display, inline metadata editor, guarded navigation/close and creation editor are complete. Preserve current source-management layout, import progress, source list, totals and source-removal behavior. Coordinate T3/T4 against renamed view.
- Rename the navigation entry and former Data sources view to "Datasets". Use the active dataset name as the page heading, with adjacent Edit and Swap dataset icon buttons and accessible names/tooltips.
- Edit enters inline metadata editing with Save and Discard controls beside the heading (D41). Clicking the heading enters the same editor and additionally selects the full name text. Edit the heading and multiline description directly in their display typography; persist both values only on Save and restore stored values on Discard.
- New-dataset creation starts in this editor with the name field focused and its text selected. Reject empty/whitespace-only names and allow empty descriptions. Discarding creation must not leave an unnamed dataset.
- Dirty edits prompt Save / Discard / Cancel on view navigation, browser-history movement, dataset switching and app close. Description displays below heading with line breaks preserved.
- Verification: renderer tests cover metadata editing and dirty-exit choices. Browser fixture verified heading-click selection, matching display/edit typography, inline metadata edit/save, multiline keyboard input, Discard restoration and long-text layouts without overlap or overflow at 960×600 and 1400×900 (D41). Native close prompt remains untested.
- Docs: D40 records resolved UX. Update requirement names, user docs and architecture references with the rename.

## T17. Done: Dataset chooser and switching (DAT-017, DAT-018, DAT-023, DAT-024)
- Completed 2026-10-18; D42. Swap opens compact native dialog with selectable dataset rows, first-line description, cached file/ad counts, per-dataset delete and final "+ add new dataset" action. Creation enters T16 editor focused with name selected.
- Successful switch activates target DB, clears session filters and stale list/ad/facet results, shows Datasets and reloads Search. History is tagged by dataset; back/forward cannot reopen old-dataset ads. Failed activation preserves current view and filter state. Dirty editor uses T16 Save / Discard / Cancel guard.
- Delete requires permanent-removal confirmation; active deletion selects oldest remaining, and deleting last dataset recreates empty `default`. Source files are never deleted.
- Cached counts refresh on startup, activation, import completion and source removal. Unknown legacy snapshots backfill in temporary read workers from source metadata, with visible pending/error states; no ad-table scan or main-thread DB access.
- Verification: dataset/catalog, DB and renderer suites pass 51 tests; syntax checks pass. Browser fixture reviewed chooser layout at desktop and minimum window sizes; native Electron chooser interaction and performance against multiple full-scale DBs remain unverified.

## T18. Manually report and exclude erroneous ads (DAT-025)
- Status: planned only; no app implementation yet. Priority relative to existing tasks is not assigned.
- Allow the user to explicitly report an individual ad as erroneous and exclude it from the active dataset. User-reported example: ads dated 2099, far beyond the current year. Do not silently cull ads during import based on suspect dates; retain existing malformed-record validation (DAT-008).
- Reporting is local to the dataset, not submission to JobTech or another external service. Preserve original source files and leave other datasets unchanged.
- Excluded ads must disappear from browsable ads, search results, filter options/counts, date ranges, timelines, employer statistics and dataset totals. Keep FTS, summary tables, worker caches and cached dataset statistics consistent; run expensive work off the main thread.
- Before implementation, settle action placement, confirmation and optional reason capture; reversible exclusion versus physical deletion; reviewing/restoring excluded ads; persistence across restart, re-import and source removal. Record decisions with DAT-025 and update the data model, data flow and constraints as needed.
- Verification: explicitly exclude a fixture ad dated 2099 and confirm all affected views and totals update; leave an unreported suspect-date ad visible; verify dataset isolation, unchanged source files, cancellation/failure handling and the chosen restart/re-import behavior.

## T19. File-based themes and theme chooser
- Completed 2026-10-29, D51-D54; [complete contract and token reference](theming.md). Built-in/custom themes, pre-paint persisted selection, validated file operations and Appearance chooser are implemented.
- [x] Stage 1: revise dark-only requirements; record JSON/color/font contract, chooser behavior, storage/security rules and agent maintenance requirements. Verify documentation consistency before moving on.
- [x] Stage 2: tokenize current CSS, chart SVG, splash and window colors; add shared theme validation/application and ams-dark without changing appearance. All 76 tests and syntax/editor checks pass. Browser parity covers four views at both sizes/fonts, including semantic/highlight/loading probes, allowing 8-bit alpha rounding; chart stops match. Search/Ad screenshots reviewed. Disposable Electron main/splash values confirmed; main shown in 629 ms. Native interaction, normal quit and visual startup-flash observation remain unverified; live data untouched.
- [x] Stage 3: ams-light, atomic themes.json selection and live updates implemented (D52). All 83 tests, 32 browser view/size/theme/font cases and eight modal cases pass; light Search/Ad screenshots reviewed. Three disposable native launches verify light startup, context-preserving live dark switch, dark restart, font retention and visible corrupt-catalog recovery, all with normal quit. Native windows appeared in 476-606 ms; live data untouched. Visual startup-flash observation and full-dataset interaction remain unverified.
- [x] Stage 4: custom-library import/export/removal, generated-ID storage, legacy catalog compatibility and reusable renderer confirmation/error actions implemented (D53). All 93 tests pass, covering bounded/unsafe input, protected defaults, duplicates, cancellation, rollback, corruption and interrupted deletion. Two disposable native launches verify custom startup, preview data, built-in protection, active deletion fallback and dark restart with normal exits. Actual native Open/Save dialogs and chooser interaction remain unverified; live data untouched.
- [x] Stage 5: Theme is first under Appearance, with label left/name button right; Settings caps at 450 px and button at 30 px minimum height (user revisions, D54). Chooser has self-themed/fonted panels, swatches, check/pressed state, protected defaults and separate import/download/trash controls. All 98 tests pass. Browser keyboard/file-action/confirmation/error/focus workflows and eight chooser plus 12 Appearance geometry cases pass; screenshots reviewed. Native DOM-driven chooser/removal/focus and theme/font restart pass in two normally closed disposable launches. Physical native keyboard, OS Open/Save interaction, startup flashing and full-dataset interaction remain unverified; live data untouched.
- All five stages are complete. Remaining manual caveats are recorded in [theming verification](theming.md#staged-verification), not pending implementation.

## T20. Done: Generated third-party licenses (NFR-011, UI-030)
- Completed 2026-10-31; D56. `npm start`, `npm run pack` and `npm run dist` generate a packaged manifest from installed production package-lock entries; missing license metadata/text or Electron notices fail generation. Electron is included despite being a dev dependency; build-only tools are excluded.
- D57 revises presentation: Settings contains a "View third party licenses" button opening a separate history-backed reading view. All package and Chromium texts share one page scroll area; inert parsing copies only text, without a frame or source markup.
- Initial D56 verification passed all 111 tests and Linux unpacked packaging. D57 passes all 62 focused generator/loader/renderer tests and syntax/editor checks. The real 779-project Chromium report passes eight browser geometry cases at 960x600 and 1400x900 with both themes/fonts: no horizontal overflow or nested scrollbars, final notice reachable, Back returns Settings. Styled screenshot reviewed; Electron package text uses a browser fixture. Native interaction and AppImage/Windows/macOS builds remain unverified.

## Other open items (not requirements yet)
- Re-import `2016.jsonl` (shows 0 ads) and import the remaining files.
- Visual review of the recently added UI (chart, AND/OR button, resizable sidebar, zero-count styling, search chips).
- Ideas listed in [developer-notes/project-state.md](developer-notes/project-state.md).
