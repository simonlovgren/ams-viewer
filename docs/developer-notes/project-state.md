# Project state and preferences

Last updated: 2026-10-15.

## User preferences
- 2026-10-16: Settings on/off controls should use slider-style switches, not plain checkboxes. The monospace switch retains native checkbox keyboard behavior and exposes `role="switch"`; browser click/Space behavior and focus styling verified.
- 2026-10-16: monospace applies to all main-window text, including headings and ad descriptions; user can disable it in top-level Settings > Appearance (D26). Keep future application preferences here, outside search/ad controls.
- Answers short and technical; the caveman skill is always used in chat (code, commits and docs are written normally).
- The user wants requirements first (IDs in `requirements/`), decisions traced to requirements, docs updated in the same change.
- Python only via `uv` virtual environments.
- App name is **AMS Viewer** (`ams-viewer`). The workspace folder is still `ams_oldbrowser`.

## Implemented highlights
Import to SQLite with progress (multi-file, drag and drop); keyword search with multiple free-text entries; multi-select occupation and location trees with always-visible options and counts; date range, year, employment, hours filters; job-ad style ad view with breadcrumb; history navigation (Backspace, mouse buttons); electron-builder packaging.

## Not verified / known gaps
- No visual review of the UI has been done by an agent (layout, gray styling of zero-count options, search-input chips (Enter-only) and AND/OR button, date boxes, resizable/collapsible filter bar, icon-only menu, ads-over-time chart layout and labels). Ask the user for feedback or find a way to screenshot.
- Mouse back/forward buttons, drag and drop import and the packaged AppImage/Windows/macOS builds are untested.
- NFR-005 (scaling to all years, 2006–2026): facets and OFFSET paging may need optimisation; see `docs/constraints.md`. Ideas: summary table for facets, keyset paging.
- No app icon, code signing or auto-update (NFR-009 in progress).

## Open ideas (not requirements yet)
- Prev/next ad navigation inside the ad view following the current result list.
- Highlight keyword matches in the ad text.
- Export of the current result list.
- Merge updated versions of an ad when a newer file contains the same id.

## Real data import (2026-10-15)
- Data lives in `~/storage/ams_data` (21 `.jsonl`/`.json` files, ~57 GB, plus `.zip`/`.zst` copies the importer ignores). In the real database (`~/.config/AMS Viewer`) as of 2026-10-15: 2017, 2026-Q1, Q2, Q3 (1.14M ads, 7.2 GB) and `2016.jsonl` with 0 ads (imported before ids were synthesized; re-import it). `2018.json` and `2006.jsonl` were only tested in a scratch DB.
- All files are imported (11.25M ads). Startup is fast since D22 (window in ~3 s). Facets, counts and the chart were made fast with summary tables (D23, NFR-010, user request: filters took minutes even for one-ad filters). Implemented and verified on scratch DBs only; the first start on the real 70 GB DB runs the one-time background build (not yet run by the agent): check `[perf]` logs and time to filters/chart, then mark NFR-010 Implemented. Filtered group-by on broad filters (1-letter FTS prefix) may still be slow; consider a minimum prefix length.
