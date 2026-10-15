# Gotchas

## Data and import
- **Never use `readline` for JSONL.** It also splits on U+2028/U+2029, which occur inside ad texts; 61 of ~130k records broke. The importer uses a custom `\n`-only splitter (`linesOf` in `import-worker.js`).
- Sample file `2026-Q3.jsonl`: 129,721 non-empty lines, all with unique ids. `description.text_formatted` is always null, so only `description.text` is used. Some ads have no `hours` (working hours) value; some have a null region.
- Re-importing a file skips existing ids, so a code change in `toRow()` does not update stored rows. Remove the source in the Data sources view (or delete the DB) and re-import.
- Import of the sample takes ~33 s; the DB ends up ~1.1 GB.

## Database and queries
- `node:sqlite` returns rows as null-prototype objects; spread (`{ ...r }`) before sending over IPC.
- The contentless FTS table needs `contentless_delete=1` to delete rows; deleting a source removes FTS rows by rowid first.
- Facets: `facets()` returns every option with its count under the other filters (0 = grayed out, SRC-015). Unfiltered lists are cached in the worker and invalidated by `PRAGMA data_version`. A filter dimension that is added must be added to `FACETS` in `db.js`.
- `where(f, skip)` is used for both list and facet queries; `skip` names the dimension excluded for its own facet (`occ`, `loc`, `date`, `emp`, `hours`, `q`).
- Free text: committed `terms` plus the live `q` are combined by `ftsMatch()` (AND or OR per `termMode`); never read `f.q` directly in new code.
- Selecting a nullish id in a tree (`Unspecified` node) is intentionally ignored; an id of `null` in `IN (...)` would match nothing.

## Electron and renderer
- The data folder is pinned in `main.js` to `~/.config/AMS Viewer` (note the space; quote it in shells). Before it was pinned it followed `package.json`: adding `productName` for electron-builder silently switched `npm start` from `ams-viewer` to `AMS Viewer` and split the imports across two databases (2026-10-15). `~/.config/ams-viewer` is a stale leftover (only `2026-Q3`); scripts must use the `AMS Viewer` path.
- CSP has `style-src 'unsafe-inline'` because markup uses inline `style` attributes; scripts remain locked to `'self'`. Do not add inline scripts or `onclick` attributes.
- Everything dynamic in template strings must go through `esc()`.
- Global `svg { fill: none; stroke: currentColor; stroke-width: 2 }` is meant for icons. Any other inline SVG (the chart) inherits it, and its text then looks bold/glowing; reset with `stroke: none` on that SVG (`#chart svg`).
- The list view stays mounted (hidden) while an ad is open; scrollTop is saved/restored manually in `show()`.
- Stale async results are dropped with counters (`seq`, `fseq`, `adSeq`); keep using them for new async UI.
- Filter state lives in `F`, persisted as `localStorage.filters`. When changing its shape, add a migration next to the existing one at the top of `app.js` (old shapes: `field/group/occ/region/muni/lbl`).
- Mouse back/forward = DOM `mouseup` buttons 3/4 (Linux). Backspace navigates back except in inputs; the search input has its own Backspace handler (removes the last free-text entry).
- Tool edits applied in the same batch as a read may not be visible to that read; re-check with grep after multi-edit batches.

## Packaging
- Only `src/**` and `package.json` are bundled (`build.files`); the 770 MB data files in the project root must never be added.
- `npm run pack` output goes to `dist/` (git-ignored). The unpacked Linux build starts; Wayland prints a harmless Vulkan/ozone warning.

## Import crash (2026-10-15)
- Importing large `.json` array files crashed the whole app (`SIGTRAP`, `realloc` in a WorkerThread, ~10 GB memory peak, nothing inserted) because the old importer did `JSON.parse(readFileSync(file))`. Fixed by streaming (`arrayItems()` in `import-worker.js`). Never read a whole data file into memory.
- Diagnose with `coredumpctl list` / `coredumpctl info <pid>`: the crashing thread name (`WorkerThread`) and the memory peak in `journalctl` pointed at the import worker. The `GLib-GObject ... has no handler with id` and `wayland ... not compatible with Vulkan` lines printed at startup are harmless GTK/Chromium noise.
- `timeout N npx electron .` kills Electron with SIGTERM and may leave a `SIGTRAP` core dump; that is not an app crash.
- The data folder `~/storage/ams_data` also contains `2018.json` and `2019.json` (3.6 / 3.5 GB single-line JSON arrays) next to the `.jsonl` files; these were the crash trigger. The streamed importer handles `2018.json` with ~210 MB peak RSS (683k ads in 188 s).
- Source schemas differ by era (id-less ads, array-valued taxonomy, empty taxonomy before 2018); see "Source data generations" in `docs/data-model.md` and D20. Survey a new file with a quick script that reads the first ~2000 records before trusting `toRow()`.
