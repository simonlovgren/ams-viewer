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
const db=d.open(process.env.HOME+'/.config/ams-viewer/ads.db');
const c=f=>d.search(db,f,0,1,true).total;
console.log(c({}), c({terms:['sjuksköterska','hemtjänst']}));
console.log(Object.keys(d.facets(db,{})));"
```
Filter shapes are listed in `docs/data-model.md`. Reference numbers for `2026-Q3.jsonl`: 129,721 ads; `sjuksköterska` 8,675; `hemtjänst` 2,594; both 674. Timings: list a few ms, facets cold ~300 ms, filtered ~60 ms.

## Headless import (same code as the app)
```js
// /tmp/runimp.js
const {Worker}=require('worker_threads');
const w=new Worker('src/main/import-worker.js',{workerData:{dbPath:process.env.HOME+'/.config/ams-viewer/ads.db',files:['2026-Q3.jsonl']}});
w.on('message',m=>m.type!=='progress'&&console.log(JSON.stringify(m)));
```
Run from the project root with `node --no-warnings /tmp/runimp.js`. Use a different `dbPath` (e.g. `/tmp/test.db`) to avoid touching the real database.

## Build
```bash
npm run pack && timeout 8 dist/linux-unpacked/ams-viewer --no-sandbox
```

## Python
If a script ever needs Python, create a `uv` virtual environment; never use system Python.
