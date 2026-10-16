# Testing recipes

Count logic has headless regression tests; visual layout still needs manual review.

## Find in ad (D28)
`node --test src/renderer/app.test.js && node --check src/renderer/app.js` covers case-insensitive match ranges and renderer regressions. In a browser fixture, load an ad with repeated text, search it, then verify all marks, next/previous cycling, `0/0` with disabled controls for no matches, and clearing. Toolbar fit was checked at 960x600 and 1400x900; real Electron interaction was not tested.

## Collapsible widgets and minimum-width filters (D27)
`node --test src/renderer/app.test.js` now includes independent collapse persistence, invalid/unavailable storage, active-selection badges, filter retention and badge clearing (nine renderer tests total, passed 2026-10-16).

Browser fixture: inject `window.api` before loading the renderer, with 30 occupation fields, 25 regions, 21 years, employment/hours options and a yearly timeline. At 310 px filter width, verify adjacent section rectangles do not overlap, each tree search starts below its heading, and filter `scrollWidth <= clientWidth`. Passed at 960x600 and 1400x900 in both font modes; screenshots reviewed. Reintroducing default section shrinking and `min-height: 0` reproduced zero-height tree sections with inputs outside their bounds.

Click/Enter/Space toggles, active-date badge, retained date input, independent chart/date/tree collapse after reload, and chart redraw after expand/drag resize passed. When expanding all widgets in Playwright, repeatedly click `.widget-toggle[aria-expanded="false"]` with `.first()`; locators returned by `.all()` use shifting indexes as the selector stops matching expanded buttons. Real `timeout 12s npm start -- --no-sandbox` opened 11.25M ads in ~0.6 s; known Wayland/Vulkan warning and expected SIGTERM only. Actual Electron quit/relaunch persistence and non-year chart label layouts were not manually tested.

## Settings and typography (D26)
`node --test src/renderer/app.test.js` covers default-on typography, boolean validation, malformed/unavailable storage, immediate changes, persistence across renderer restart and Settings navigation preserving list scroll. Seven renderer tests passed 2026-10-16.

Browser checks with a fixture `window.api` verified checkbox and Space activation, proportional/monospace switching, reload persistence, ad-body inheritance, Backspace/forward history and Settings/search fit at 960x600 and 1400x900. Settings screenshot reviewed at minimum window size. Fixture checks do not exercise real IPC or Electron quit/relaunch. `timeout 12s npm start -- --no-sandbox` separately opened the real 11.25M-ad app in ~4.6 s; only environmental Wayland/GPU warnings, expected SIGTERM on timeout.

## Facet and compact-count regressions (D25)
```bash
node --test src/main/db.test.js src/renderer/app.test.js
```
Uses in-memory SQLite and renderer helper evaluation (no real DB writes). Covers missing-value normalization, all five facet dimensions and own-filter exclusion, locations present in results, duplicate tree leaves, compact unit boundaries, exact tooltips and pending-count invalidation. Five tests passed 2026-10-16. A read-only query on the real 11,252,350-ad DB for `neuropsykolog` returned 9,100 ads and identical totals in all five facets (~846 ms combined); no visible location had a zero facet count. Electron startup smoke test (`timeout 15s npm start -- --no-sandbox`) showed the window in ~625 ms; no app errors, only an environmental Wayland/Vulkan warning. Timeout termination is expected. Visual fit and interactive rapid-filter changes were not manually reviewed.

## Syntax / startup
```bash
node --check src/renderer/app.js && node --check src/main/db.js && node --check src/main/main.js
timeout 10 npx electron . --enable-logging 2>&1 | grep -iE "uncaught|console|error" | grep -viE "dbus|gpu|vulkan|ozone"
```
No output means no startup or renderer console errors.

## Query checks against the real DB
```bash
node --no-warnings -e "
const d=require('./src/main/db');
const db=d.open(process.env.HOME+'/.config/AMS Viewer/ads.db');
const c=f=>d.search(db,f,0,1,true).total;
console.log(c({}), c({terms:['sjuksköterska','hemtjänst']}));
console.log(Object.keys(d.facets(db,{})));"
```
Filter shapes are listed in `docs/data-model.md`. Reference numbers for `2026-Q3.jsonl`: 129,721 ads; `sjuksköterska` 8,675; `hemtjänst` 2,594; both 674. Timings: list a few ms, facets cold ~300 ms, filtered ~60 ms.

## Headless import (same code as the app)
```js
// /tmp/runimp.js
const {Worker}=require('worker_threads');
const w=new Worker('src/main/import-worker.js',{workerData:{dbPath:process.env.HOME+'/.config/AMS Viewer/ads.db',files:['2026-Q3.jsonl']}});
w.on('message',m=>m.type!=='progress'&&console.log(JSON.stringify(m)));
```
Run from the project root with `node --no-warnings /tmp/runimp.js`. Use a different `dbPath` (e.g. `/tmp/test.db`) to avoid touching the real database.

## Build
```bash
npm run pack && timeout 8 dist/linux-unpacked/ams-viewer --no-sandbox
```

## Python
If a script ever needs Python, create a `uv` virtual environment; never use system Python.

## Large JSON-array import test
Build array files from the stored ads (no source file needed) and import them into a scratch DB:
```js
// mk.js: node --no-warnings mk.js 100000 ~/.cache/ams-test/big.json   (single-line array, ~500 MB)
const d=require('/path/to/src/main/db'),fs=require('fs');
const db=d.open(process.env.HOME+'/.config/AMS Viewer/ads.db');
const [limit,out]=[+process.argv[2],process.argv[3]];const fd=fs.openSync(out,'w');fs.writeSync(fd,'[');let n=0;
for(const r of db.prepare('SELECT raw FROM ads LIMIT ?').iterate(limit)) fs.writeSync(fd,(n++?',':'')+r.raw);
fs.writeSync(fd,']');
```
Import with the headless worker runner (set `dbPath` to a scratch file under `~/.cache/`, not `/tmp`, which may be RAM-backed) and print `process.resourceUsage().maxRSS` at exit. Reference: 511 MB / 100k ads in 29 s, max RSS 146 MB. Delete the scratch files afterwards.

## Summary-table consistency (D23)
On a scratch DB under `~/.cache/`: `open` + `ensureSummary` on the empty DB (so the incremental path is used), import two sample files (`head -n 20000` of real files) with the headless Worker runner, `removeSource` one, snapshot all `sum_*` tables, delete `meta.summary_version`, `ensureSummary` again, compare snapshots (must be equal). Verified 2026-10-16. Write the script to a file, not inline (`!` history expansion).
