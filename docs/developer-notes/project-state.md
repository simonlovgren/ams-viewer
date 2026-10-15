# Project state and preferences

Last updated: 2026-10-15.

## User preferences
- Answers short and technical; the caveman skill is always used in chat (code, commits and docs are written normally).
- The user wants requirements first (IDs in `requirements/`), decisions traced to requirements, docs updated in the same change.
- Python only via `uv` virtual environments.
- App name is **AMS Viewer** (`ams-viewer`). The workspace folder is still `ams_oldbrowser`.

## Implemented highlights
Import to SQLite with progress (multi-file, drag and drop); keyword search with multiple free-text entries; multi-select occupation and location trees with always-visible options and counts; date range, year, employment, hours filters; job-ad style ad view with breadcrumb; history navigation (Backspace, mouse buttons); electron-builder packaging.

## Not verified / known gaps
- No visual review of the UI has been done by an agent (layout, gray styling of zero-count options, search-input chips and AND/OR button, date boxes, resizable/collapsible filter bar, icon-only menu, ads-over-time chart layout and labels). Ask the user for feedback or find a way to screenshot.
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
- Next: import everything via the app (about an hour, ~70 GB DB), then re-measure facet/chart/keyword timings at ~10x scale. Facet counts (and the ads-over-time chart with a date filter) are the expected bottleneck (NFR-005).
