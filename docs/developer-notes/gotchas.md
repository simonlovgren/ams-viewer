# Gotchas

## Data and import
- **Never use `readline` for JSONL.** It also splits on U+2028/U+2029, which occur inside ad texts; 61 of ~130k records broke. The importer uses a custom `\n`-only splitter (`linesOf` in `import-worker.js`).
- Sample file `2026-Q3.jsonl`: 129,721 non-empty lines, all with unique ids. `description.text_formatted` is always null, so only `description.text` is used. Some ads have no `hours` (working hours) value; some have a null region.
- Re-importing a file skips existing ids, so a code change in `toRow()` does not update stored rows. Remove the source in the Datasets view (or delete the DB) and re-import.
- D48 is the targeted exception: `ensureSummary()` repairs NULL promoted array-valued tags from stored raw JSON once (`meta.array_tags_version = '1'`), then rebuilds summaries if changed. Reported employer `Gedet AB` is `Getdet AB` in the screenshot/data; June 2026 rows in `2026-Q2.jsonl` reproduce stale columns. Never use `dbm.open()` for read-only live-data inspection.
- Import of the sample takes ~33 s; the DB ends up ~1.1 GB.

## Database and queries
- `node:sqlite` returns rows as null-prototype objects; spread (`{ ...r }`) before sending over IPC.
- The contentless FTS table needs `contentless_delete=1` to delete rows; deleting a source removes FTS rows by rowid first.
- Facets: `facets()` returns every option with its count under the other filters (0 = grayed out, SRC-015). Unfiltered options come from summary tables (D23). A filter dimension that is added must be added to `FACETS` in `db.js`. Merge keys must normalize NULL/empty strings like `accAdd` and accumulate duplicate normalized groups; otherwise matching ads can disappear from counts (D25). Pending renderer counts are unknown (`...`), never zero.
- D55 employer identities/labels/totals are precomputed: `ads.employer_id`, variant counts in `sum_employer`, and ranked `employer_catalog`. Only import/removal/build/reprocess writes update mappings; filtering counts stored identities and joins labels. Never add per-query raw-JSON ID extraction or name-mapping builds. Readiness needs both summary version 2 and employer identity version 1; legacy backfill must run on disposable fixtures unless a real migration is intended.
- D55 employer selections use `{id,label}[]` (`id:null` for missing-ID exact names); legacy session strings remain exact-name compatible. Do not confuse `employers` with `emp` or free text, or add an own-filter-excluded employer facet. Preserve buttons while counts load and restore focus by identity without interpolating names into CSS selectors.
- D46: exact-employer filters previously had no index (`SCAN a` on the real 11.25M-ad DB; reported 22.5 s refresh). `ensureSummary()` now builds `ix_employer(employer COLLATE BINARY, pub_date)` before the existing-summary early return. Keep index creation in the build worker, not `open()`; do not bump the summary version for index-only upgrades.
- `where(f, skip)` is used for both list and facet queries; `skip` names the dimension excluded for its own facet (`occ`, `loc`, `date`, `emp`, `hours`, `q`).
- Free text: committed `terms` (added with Enter; the renderer no longer sends `q`) are combined by `ftsMatch()` (AND or OR per `termMode`); never read `f.q` directly in new code.
- Selecting a nullish id in a tree (`Unspecified` node) is intentionally ignored; an id of `null` in `IN (...)` would match nothing.

## Electron and renderer
- Filter sections inside the scrolling flex column must not shrink. In a 600 px window, `.f-sec.grow { min-height: 0 }` plus default flex shrinking reduced tree sections to zero height while titles/inputs overflowed into neighbours (D27). Keep `.f-head, .f-sec { flex-shrink: 0 }` and let the column scroll.
- Collapsible widgets use stable `data-widget` keys, a `.widget-toggle` button with `aria-controls`, a `.widget-active` badge and a `.widget-body` with matching ID. `initWidgets()` binds existing sections; `updateWidgets()` refreshes state/badges. Chart rendering must skip zero width and rely on `ResizeObserver` when shown again (D27).
- The data folder is pinned in `main.js` to `~/.config/AMS Viewer` (note the space; quote it in shells). Before it was pinned it followed `package.json`: adding `productName` for electron-builder silently switched `npm start` from `ams-viewer` to `AMS Viewer` and split the imports across two databases (2026-10-15). `~/.config/ams-viewer` is a stale leftover (only `2026-Q3`); scripts must use the `AMS Viewer` path.
- T15/D39 moves existing `ads.db` plus `-wal`/`-shm` sidecars into `~/.config/AMS Viewer/datasets/default.db` on first startup after upgrade. Back up `~/.config/AMS Viewer` first. Catalog is `datasets.json`; database filenames use generated IDs, never editable names. Catalog recovery restores staged deletion files for still-registered datasets.
- CSP has `style-src 'unsafe-inline'` because markup uses inline `style` attributes; scripts remain locked to `'self'`. Do not add inline scripts or `onclick` attributes.
- Everything dynamic in template strings must go through `esc()`.
- Global `svg { fill: none; stroke: currentColor; stroke-width: 2 }` is meant for icons. Any other inline SVG (the chart) inherits it, and its text then looks bold/glowing; reset with `stroke: none` on that SVG (`#chart svg`).
- The list view stays mounted (hidden) while an ad is open; scrollTop is saved/restored manually in `show()`.
- Stale async results are dropped with counters (`seq`, `fseq`, `adSeq`); keep using them for new async UI.
- D47 notices: new background work in main should call `sendTask(key, 'running'|'done'|'error', text, pct)`; never leave a `running` key without `done`/`error` (it stays visible and is replayed by `tasks:list`). Body is a CSS grid (`#notices` row above sidebar/main); views must not use `100vh` heights. Explicitly place notices in row 1 and sidebar/main in row 2: when empty notices use `display: none`, auto-placement otherwise moves content into the content-sized first row and leaves unused space below (fixed 2026-10-29). Hidden integrated-browser tabs throttle `setTimeout`, so the 300 ms notice delay can take ~1 s there.
- Facet refresh failures must not be silently swallowed: `loadStats()` logs `Failed to update filter counts:` with the underlying error. A reported startup stall on `...` was not reproduced in a fresh native Electron instance (2026-10-16); the user confirmed that instance showed counts. The original instance's cause remains unknown.
- Filter state lives in `F`, kept in `sessionStorage.filters` (only while the app is open, SRC-013). Nothing needs migrating when its shape changes; the old `localStorage.filters` key is deleted on start.
- Mouse back/forward = DOM `mouseup` buttons 3/4 (Linux). Backspace navigates back except in inputs; the search input has its own Backspace handler (removes the last free-text entry).
- Tool edits applied in the same batch as a read may not be visible to that read; re-check with grep after multi-edit batches.

## Packaging
- Only `src/**` and `package.json` are bundled (`build.files`); the 770 MB data files in the project root must never be added.
- `npm run pack` output goes to `dist/` (git-ignored). The unpacked Linux build starts; Wayland prints a harmless Vulkan/ozone warning.

## Startup and reads (2026-10-15)
- A stale live-typed keyword (`W`, an FTS prefix of one letter) saved in `localStorage` made the first page query run for minutes on 11M ads. FTS prefix terms of 1 to 2 characters match huge posting lists; consider requiring a minimum prefix length. Filters are session-only now.
- Do not run DB queries in the main process. Set `PRAGMA busy_timeout` before `journal_mode=WAL` when several connections open together.
- Startup diagnostics: `[startup]` and `[perf]` lines print to the console; `AMS_TRACE=1 npm start` logs every IPC call. Long GUI test runs trigger the OS "not responding" popup if the main process blocks; use short `timeout` runs and `pkill -f ams_oldbrowser/node_modules/electron` afterwards.

## Import crash (2026-10-15)
- Importing large `.json` array files crashed the whole app (`SIGTRAP`, `realloc` in a WorkerThread, ~10 GB memory peak, nothing inserted) because the old importer did `JSON.parse(readFileSync(file))`. Fixed by streaming (`arrayItems()` in `import-worker.js`). Never read a whole data file into memory.
- Diagnose with `coredumpctl list` / `coredumpctl info <pid>`: the crashing thread name (`WorkerThread`) and the memory peak in `journalctl` pointed at the import worker. The `GLib-GObject ... has no handler with id` and `wayland ... not compatible with Vulkan` lines printed at startup are harmless GTK/Chromium noise.
- `timeout N npx electron .` kills Electron with SIGTERM and may leave a `SIGTRAP` core dump; that is not an app crash.
- The data folder `~/storage/ams_data` also contains `2018.json` and `2019.json` (3.6 / 3.5 GB single-line JSON arrays) next to the `.jsonl` files; these were the crash trigger. The streamed importer handles `2018.json` with ~210 MB peak RSS (683k ads in 188 s).
- Source schemas differ by era (id-less ads, array-valued taxonomy, empty taxonomy before 2018); see "Source data generations" in `docs/data-model.md` and D20. Survey a new file with a quick script that reads the first ~2000 records before trusting `toRow()`.

- Summary tables (`sum_*`, D23) are derived state: any new path that inserts or deletes ads must call `accAdd`/`accFlush` (import-worker) or the removal subtraction in `removeSource`, else counts drift. Fix: delete `meta.summary_version` and restart; the build recomputes everything. Facets/timeline return `{building:true}` until the build is done; import and removal are refused meanwhile.
