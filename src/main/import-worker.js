'use strict';
const { parentPort, workerData } = require('worker_threads');
const fs = require('fs');
const path = require('path');
const { StringDecoder } = require('string_decoder');
const { open, toRow, INSERT_SQL, isBuilt, newAcc, accAdd, accFlush, projectionValues, legacyReferences, adjustLegacyReferences, adjustSourceEnriched, reconcileLegacyMappings } = require('./db');

const { dbPath, files } = workerData;
const db = open(dbPath);
// When the summary tables exist they are updated with every committed batch, so they always match the ads.
const summary = isBuilt(db);
const acc = newAcc();
const insAd = db.prepare(INSERT_SQL);
const insFts = db.prepare('INSERT INTO ads_fts(rowid, headline, employer, body) VALUES (?,?,?,?)');
const selectProjection = db.prepare('SELECT rowid, raw, source, region, muni, field_id, field, group_id, grp, occ_id, occ FROM ads WHERE rowid = ?');
const BATCH = 2000;

// readline would also split on U+2028/2029, which occur inside ad texts.
const MAX_LINE = 64 * 1024 * 1024;
async function* linesOf(stream) {
  const dec = new StringDecoder('utf8');
  let tail = '';
  for await (const chunk of stream) {
    const parts = (tail + dec.write(chunk)).split('\n');
    tail = parts.pop();
    if (tail.length > MAX_LINE) throw new Error('A line is larger than 64 MB; the file is not line-delimited JSON');
    yield* parts;
  }
  tail += dec.end();
  if (tail) yield tail;
}

// Yields the text of each top-level object of a JSON array without loading the whole file.
async function* arrayItems(stream) {
  const dec = new StringDecoder('utf8');
  let depth = 0;
  let inStr = false;
  let esc = false;
  let parts = [];
  let size = 0;
  for await (const chunk of stream) {
    const s = dec.write(chunk);
    let seg = depth >= 2 ? 0 : -1;
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i);
      if (inStr) {
        if (esc) esc = false;
        else if (c === 92) esc = true;
        else if (c === 34) inStr = false;
      } else if (c === 34) inStr = true;
      else if (c === 123 || c === 91) {
        if (++depth === 2) seg = i;
      } else if (c === 125 || c === 93) {
        if (--depth === 1 && seg >= 0) {
          yield parts.join('') + s.slice(seg, i + 1);
          parts = [];
          size = 0;
          seg = -1;
        }
      }
    }
    if (depth >= 2 && seg >= 0) {
      parts.push(s.slice(seg));
      size += s.length - seg;
      if (size > MAX_LINE) throw new Error('A JSON array element is larger than 64 MB');
    }
  }
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
  const started = Date.now();
  const name = path.basename(file);
  const size = fs.statSync(file).size;
  let sourceExists = !!db.prepare('SELECT 1 FROM sources WHERE name = ?').get(name);
  let initialEnriched = 0;
  const st = { type: 'progress', file: name, fileIndex, files: files.length, lines: 0, inserted: 0, skipped: 0, errors: 0, duration_ms: 0, pct: 0 };
  let last = 0;
  let pending = 0;
  const affected = { occupations: new Set(), locations: new Set() };
  const inserted = [];

  const finishBatch = () => {
    if (affected.occupations.size || affected.locations.size) {
      reconcileLegacyMappings(db, {
        occupations: [...affected.occupations],
        locations: [...affected.locations],
      }, {
        skipSummaryRows: new Set(inserted),
        onEnrichmentChange: (source, delta) => {
          if (source === name && !sourceExists) initialEnriched += delta;
          else adjustSourceEnriched(db, source, delta);
        },
      });
    }
    if (summary) {
      for (const rowid of inserted) accAdd(acc, projectionValues(selectProjection.get(rowid)));
      accFlush(db, acc);
    }
    affected.occupations.clear();
    affected.locations.clear();
    inserted.length = 0;
  };

  const emit = (force) => {
    const now = Date.now();
    if (force || now - last > 250) {
      last = now;
      st.duration_ms = Date.now() - started;
      parentPort.postMessage({ ...st });
    }
  };
  const handle = (d) => {
    st.lines++;
    let mapped;
    try {
      if (!d || typeof d !== 'object') throw new Error('not an object');
      mapped = toRow(d, name);
    } catch {
      st.errors++;
    }
    if (mapped) {
      const { values, fts } = mapped;
      const r = insAd.run(...values);
      if (r.changes) {
        insFts.run(r.lastInsertRowid, ...fts);
        const references = legacyReferences(d);
        adjustLegacyReferences(db, references);
        for (const reference of references.occupations) affected.occupations.add(reference.id);
        for (const reference of references.locations) affected.locations.add(reference.code);
        if (values[19]) affected.occupations.add(values[19]);
        if (values[20]) affected.locations.add(values[20]);
        inserted.push(Number(r.lastInsertRowid));
        st.inserted++;
      } else st.skipped++;
    }
    if (++pending >= BATCH) {
      finishBatch();
      db.exec('COMMIT; BEGIN');
      pending = 0;
    }
  };

  db.exec('BEGIN');
  try {
    const stream = fs.createReadStream(file);
    const items = firstChar(file) === '[' ? arrayItems(stream) : linesOf(stream);
    for await (const text of items) {
      if (!text.trim()) continue;
      let d = null;
      try { d = JSON.parse(text); } catch { /* counted as error in handle */ }
      handle(d);
      if (st.lines % 200 === 0) { st.pct = Math.min(1, stream.bytesRead / size); emit(); }
    }
    finishBatch();
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    for (const m of Object.values(acc)) m.clear();
    throw e;
  }
  const n = db.prepare('SELECT COUNT(*) n FROM ads WHERE source = ?').get(name).n;
  st.duration_ms = Date.now() - started;
  db.prepare(
    `INSERT INTO sources(name, path, ads, imported_at, duration_ms, inserted, skipped, errors, enriched) VALUES (?,?,?,?,?,?,?,?,?)
     ON CONFLICT(name) DO UPDATE SET ads = excluded.ads, path = excluded.path, imported_at = excluded.imported_at,
       duration_ms = excluded.duration_ms, inserted = excluded.inserted, skipped = excluded.skipped, errors = excluded.errors`
  ).run(name, file, n, new Date().toISOString(), st.duration_ms, st.inserted, st.skipped, st.errors, Math.max(0, initialEnriched));
  sourceExists = true;
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
