# Testing recipes

The UI has no automated tests and no screenshot tooling was available; verify logic headlessly, then state honestly that the visual result was not seen.

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
