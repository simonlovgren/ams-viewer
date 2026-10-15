'use strict';
const { parentPort, workerData } = require('worker_threads');
const fs = require('fs');
const path = require('path');
const { StringDecoder } = require('string_decoder');
const { open, toRow, INSERT_SQL } = require('./db');

const { dbPath, files } = workerData;
const db = open(dbPath);
const insAd = db.prepare(INSERT_SQL);
const insFts = db.prepare('INSERT INTO ads_fts(rowid, headline, employer, body) VALUES (?,?,?,?)');
const BATCH = 2000;

// readline would also split on U+2028/2029, which occur inside ad texts.
async function* linesOf(stream) {
  const dec = new StringDecoder('utf8');
  let tail = '';
  for await (const chunk of stream) {
    const parts = (tail + dec.write(chunk)).split('\n');
    tail = parts.pop();
    yield* parts;
  }
  tail += dec.end();
  if (tail) yield tail;
}

function firstChar(file) {
  const fd = fs.openSync(file, 'r');
  try {
    const buf = Buffer.alloc(4096);
    const n = fs.readSync(fd, buf, 0, 4096, 0);
    return buf.subarray(0, n).toString('utf8').trimStart()[0];
  } finally {
    fs.closeSync(fd);
  }
}

async function importFile(file, fileIndex) {
  const name = path.basename(file);
  const size = fs.statSync(file).size;
  const st = { type: 'progress', file: name, fileIndex, files: files.length, lines: 0, inserted: 0, skipped: 0, errors: 0, pct: 0 };
  let last = 0;
  let pending = 0;

  const emit = (force) => {
    const now = Date.now();
    if (force || now - last > 250) {
      last = now;
      parentPort.postMessage({ ...st });
    }
  };
  const handle = (d) => {
    st.lines++;
    try {
      if (!d || d.id === undefined || d.id === null) throw new Error('no id');
      const { values, fts } = toRow(d, name);
      const r = insAd.run(...values);
      if (r.changes) {
        insFts.run(r.lastInsertRowid, ...fts);
        st.inserted++;
      } else st.skipped++;
    } catch {
      st.errors++;
    }
    if (++pending >= BATCH) {
      db.exec('COMMIT; BEGIN');
      pending = 0;
    }
  };

  db.exec('BEGIN');
  try {
    if (firstChar(file) === '[') {
      const arr = JSON.parse(fs.readFileSync(file, 'utf8'));
      for (const d of arr) {
        handle(d);
        if (st.lines % 500 === 0) { st.pct = st.lines / arr.length; emit(); }
      }
    } else {
      const stream = fs.createReadStream(file);
      for await (const line of linesOf(stream)) {
        if (!line.trim()) continue;
        let d = null;
        try { d = JSON.parse(line); } catch { /* counted as error in handle */ }
        handle(d);
        if (st.lines % 200 === 0) { st.pct = stream.bytesRead / size; emit(); }
      }
    }
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  const n = db.prepare('SELECT COUNT(*) n FROM ads WHERE source = ?').get(name).n;
  db.prepare(
    `INSERT INTO sources(name, path, ads, imported_at) VALUES (?,?,?,?)
     ON CONFLICT(name) DO UPDATE SET ads = excluded.ads, path = excluded.path, imported_at = excluded.imported_at`
  ).run(name, file, n, new Date().toISOString());
  st.pct = 1;
  emit(true);
  parentPort.postMessage({ ...st, type: 'file-done' });
}

(async () => {
  try {
    for (let i = 0; i < files.length; i++) await importFile(files[i], i);
    parentPort.postMessage({ type: 'done' });
  } catch (e) {
    parentPort.postMessage({ type: 'error', message: String(e && e.message || e) });
  } finally {
    db.close();
  }
})();
