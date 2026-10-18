# Project state and preferences

Last updated: 2026-10-18.

## User preferences
- 2026-10-18: prefer explicit manual exclusion of erroneous ads over silent import-time date culling (user-reported 2099 dates). Planned as DAT-025/T18; no implementation yet.
- 2026-10-18: dataset metadata editing must edit the visible heading and description in place, preserving their CSS typography rather than showing separate native form fields (D41).
- 2026-10-16: all filter and statistics widgets resize vertically by grabbing their bottom divider, not only hierarchical trees (D34, D35). T1/T8 are complete; T9 now supplies employer statistics, while T5 remains planned. Filter/statistics columns collapse independently like the menu; both also resize in width, with statistics using its left divider (D36). Saved preferences survive automatic narrow-layout hiding and viewport clamping.
- 2026-10-16: ads-over-time chart stays in the filter column beside publication-date filters, not in the planned statistics bar (D27). T2 is complete.
- 2026-10-16: Settings on/off controls should use slider-style switches, not plain checkboxes. The monospace switch retains native checkbox keyboard behavior and exposes `role="switch"`; browser click/Space behavior and focus styling verified.
- 2026-10-16: monospace applies to all main-window text, including headings and ad descriptions; user can disable it in top-level Settings > Appearance (D26). Keep future application preferences here, outside search/ad controls.
- Answers short and technical; the caveman skill is always used in chat (code, commits and docs are written normally).
- The user wants requirements first (IDs in `requirements/`), decisions traced to requirements, docs updated in the same change.
- Python only via `uv` virtual environments.
- App name is **AMS Viewer** (`ams-viewer`). The workspace folder is still `ams_oldbrowser`.

## Implemented highlights
- 2026-10-18: DAT-026/D49 adds confirmed manual reprocessing in Datasets. The build worker regenerates projections, FTS, summaries, source counts, indexes and planner statistics atomically from stored raw ads, preserving identity/source metadata. Top progress persists across views; failures show both modal and dismissible status notice. All 68 tests and disposable Electron startup pass; browser fixture checks modal and injected notices. Live dataset untouched; native rebuild interaction and full-scale time/disk use unverified. Future notification guidance is in this directory's README.
- 2026-10-18: D48/DAT-012/LST-002 repairs missing promoted array-valued tags once per dataset at startup/activation, then rebuilds summaries if changed. Real `Getdet AB` 2026 rows verified in memory: 624 stale ads out of 642, zero stale after repair. All 62 tests pass. Live DB untouched; next startup performs migration. Full-scale migration and native post-repair view remain unverified.
- 2026-10-18: D47/UI-022 adds a top notification stack for background tasks (summary/index build, import, dataset operations, source removal, dataset statistics reads) and statistics refresh errors. Real full-DB build/import/switch notices not observed natively yet.
- 2026-10-18: D46 fixes missing exact-employer index behind reported stalled statistics. Background `ensureSummary()` upgrades existing version-2 datasets with employer/date index, without summary rebuild or re-import. 57 tests pass; synthetic 130k-ad refresh outputs match and queries improve. Real DB inspected read-only; index migration and post-index full-scale/native latency not run. See [testing recipes](testing-recipes.md#top-employer-statistics-t9--d43).
- 2026-10-18: T9/D45/SRC-022 adds exact-name employer toggles and removable active chips. Shared predicates retain filtered Top-30 semantics; session/ad return persists selections and dataset switch resets them. DB/renderer suites and browser Enter/Space fixture pass; actual Tab traversal, native Electron interaction and full-scale employer-filter latency remain unverified.
Import to SQLite with progress (multi-file, drag and drop); keyword search with multiple free-text entries; multi-select occupation and location trees with always-visible options and counts; date range, year, employment, hours filters; job-ad style ad view with breadcrumb and in-ad find/highlight/navigation (AD-011); history navigation (Backspace, mouse buttons); electron-builder packaging.

- 2026-10-18: T9/D43–D44 adds filtered top-30 employer counts to the statistics column; exact stored employer text defines groups, unfiltered totals use `sum_employer`. Geography placeholder removed; T5/SRC-019 remains planned. Next startup rebuilds summary version 2 in background; this migration and filtered full-scale latency remain unverified (T6).

## Not verified / known gaps
- 2026-10-18: T15/D39–T17/D42 complete. Dataset chooser supports cached/backfilled stats, creation, switching and confirmed deletion. Switching resets session filters, invalidates stale results and blocks prior-dataset history. 51 focused catalog/DB/renderer tests pass; native chooser interaction, multiple full-scale DB latency and close prompt remain unverified. DAT-017–024 now Implemented. See [T15-T17](../tasks.md#t15-done-named-dataset-storage-and-lifecycle-dat-017-dat-018-dat-021-dat-022).
- Browser fixtures now cover Settings/typography (D26), filter widgets, minimum-width tree/search layout, date inputs, sidebar drag resizing and yearly chart layout (D27), in-ad find/navigation (D28), and contextual shortcut help (D31), with screenshots reviewed. Real Electron interactions, gray zero-count styling, search chips/AND-OR and non-year chart label layouts still need visual review.
- Mouse back/forward buttons, drag and drop import and the packaged AppImage/Windows/macOS builds are untested.
- NFR-005/NFR-010: D37 fixes broad chronological list plans and reuses/batches facet counts. Full-scale list/facet measurements and remaining first-use/cancellation limits are in [testing-recipes.md](testing-recipes.md#full-scale-filtering-and-facet-reuse-d37); rapid native filter interaction remains untested. Counts/timelines and deep OFFSET paging still need optimization.
- No app icon, code signing or auto-update (NFR-009 in progress).

## Open ideas (not requirements yet)
- Prev/next ad navigation inside the ad view following the current result list.
- Export of the current result list.
- Merge updated versions of an ad when a newer file contains the same id.

## Real data import (2026-10-15)
- Data lives in `~/storage/ams_data` (21 `.jsonl`/`.json` files, ~57 GB, plus `.zip`/`.zst` copies the importer ignores). The real DB now lives at `~/.config/AMS Viewer/datasets/default.db`; it contains 11,252,350 ads (~70.4 GB). `2016.jsonl` previously imported with 0 ads before ids were synthesized; re-import it if needed. `2018.json` and `2006.jsonl` were only tested in a scratch DB.
- All files are imported (11.25M ads). Startup is fast since D22 (window in ~3 s). Facets, counts and the chart use summary tables (D23, NFR-010). D44 bumps summary version to 2 for `sum_employer`; next startup rebuilds summaries in the background on the real 70 GB DB, with no source re-import. This migration has not run yet. Filtered group-by on broad filters (including employer stats) may still be slow; measure under T6.
