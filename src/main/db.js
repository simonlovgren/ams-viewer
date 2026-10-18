'use strict';
const { DatabaseSync } = require('node:sqlite');
const crypto = require('crypto');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS ads (
  rowid INTEGER PRIMARY KEY,
  ad_id TEXT NOT NULL UNIQUE,
  headline TEXT,
  pub_date TEXT,
  year INTEGER,
  deadline TEXT,
  employer TEXT,
  region TEXT,
  muni TEXT,
  field_id TEXT, field TEXT,
  group_id TEXT, grp TEXT,
  occ_id TEXT, occ TEXT,
  emp_type TEXT,
  hours TEXT,
  source TEXT,
  raw TEXT
);
CREATE INDEX IF NOT EXISTS ix_pub ON ads(pub_date);
CREATE INDEX IF NOT EXISTS ix_year ON ads(year);
CREATE INDEX IF NOT EXISTS ix_occ_cov ON ads(field_id, group_id, occ_id, field, grp, occ);
CREATE INDEX IF NOT EXISTS ix_group ON ads(group_id);
CREATE INDEX IF NOT EXISTS ix_occ ON ads(occ_id);
CREATE INDEX IF NOT EXISTS ix_loc_cov ON ads(region, muni);
CREATE INDEX IF NOT EXISTS ix_source ON ads(source);
CREATE VIRTUAL TABLE IF NOT EXISTS ads_fts USING fts5(
  headline, employer, body,
  content='', contentless_delete=1,
  tokenize='unicode61 remove_diacritics 2'
);
CREATE TABLE IF NOT EXISTS sources (
  name TEXT PRIMARY KEY,
  path TEXT,
  ads INTEGER DEFAULT 0,
  imported_at TEXT
);
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT);
CREATE TABLE IF NOT EXISTS sum_occ (
  field_id TEXT NOT NULL, field TEXT, group_id TEXT NOT NULL, grp TEXT, occ_id TEXT NOT NULL, occ TEXT,
  n INTEGER NOT NULL, PRIMARY KEY (field_id, group_id, occ_id)
);
CREATE TABLE IF NOT EXISTS sum_loc (region TEXT NOT NULL, muni TEXT NOT NULL, n INTEGER NOT NULL, PRIMARY KEY (region, muni));
CREATE TABLE IF NOT EXISTS sum_year (year INTEGER NOT NULL PRIMARY KEY, n INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS sum_emp (v TEXT NOT NULL PRIMARY KEY, n INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS sum_hours (v TEXT NOT NULL PRIMARY KEY, n INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS sum_day (day TEXT NOT NULL PRIMARY KEY, n INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS sum_employer (v TEXT NOT NULL PRIMARY KEY, n INTEGER NOT NULL);
`;

function open(path) {
  const db = new DatabaseSync(path);
  // busy_timeout first: opening several connections at once on a WAL database that needs recovery otherwise fails with SQLITE_BUSY.
  db.exec('PRAGMA busy_timeout=30000; PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL;');
  db.exec(SCHEMA);
  return db;
}

function prune(v) {
  if (Array.isArray(v)) {
    const a = v.map(prune).filter((x) => x !== undefined);
    return a.length ? a : undefined;
  }
  if (v && typeof v === 'object') {
    const o = {};
    for (const k in v) {
      const p = prune(v[k]);
      if (p !== undefined) o[k] = p;
    }
    return Object.keys(o).length ? o : undefined;
  }
  return v === null || v === '' ? undefined : v;
}

const lbl = (o) => (o && o.label) || null;
const cid = (o) => (o && (o.concept_id || o.label)) || null;
// From 2023 the source holds arrays for occupation and employment type; the first entry is used.
const one = (x) => (Array.isArray(x) ? x.find(Boolean) || null : x);

// 2006-2016 ads have no id; derive a stable one from their content so re-imports are skipped.
const contentId = (d) =>
  'h-' + crypto.createHash('sha1')
    .update([d.headline, d.publication_date, d.application_deadline, d.employer && d.employer.name, JSON.stringify(d.workplace_address), d.number_of_vacancies, ((d.description && d.description.text) || '').slice(0, 4000)].join('\u0001'))
    .digest('hex');

// Maps one raw ad to the flat columns + FTS body.
function toRow(d, source) {
  const addr = d.workplace_address || {};
  const pub = String(d.publication_date || '').slice(0, 10) || null;
  const field = one(d.occupation_field);
  const group = one(d.occupation_group);
  const occ = one(d.occupation);
  return {
    values: [
      d.id === null || d.id === undefined || d.id === '' ? contentId(d) : String(d.id),
      d.headline || '',
      pub,
      pub ? Number(pub.slice(0, 4)) : null,
      d.application_deadline || null,
      (d.employer && (d.employer.name || d.employer.workplace)) || null,
      addr.region || null,
      addr.municipality || null,
      cid(field), lbl(field),
      cid(group), lbl(group),
      cid(occ), lbl(occ),
      lbl(one(d.employment_type)),
      lbl(one(d.working_hours_type)),
      source,
      JSON.stringify(prune(d) || {}),
    ],
    fts: [d.headline || '', (d.employer && d.employer.name) || '', (d.description && d.description.text) || ''],
  };
}

const INSERT_SQL = `INSERT OR IGNORE INTO ads
 (ad_id,headline,pub_date,year,deadline,employer,region,muni,field_id,field,group_id,grp,occ_id,occ,emp_type,hours,source,raw)
 VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;

function ftsQuery(q) {
  const parts = [];
  let rest = String(q || '').replace(/"([^"]+)"/g, (_m, p) => {
    const w = p.match(/[\p{L}\p{N}]+/gu);
    if (w) parts.push(`"${w.join(' ')}"`);
    return ' ';
  });
  for (const t of rest.match(/[\p{L}\p{N}]+/gu) || []) parts.push(`"${t}"*`);
  return parts.join(' ');
}

// Each entry (committed term or text being typed) is one unit: its words are AND-ed;
// entries are combined with AND or OR (f.termMode).
function ftsMatch(f) {
  const parts = [...(Array.isArray(f.terms) ? f.terms : []), f.q].map(ftsQuery).filter(Boolean);
  if (parts.length < 2) return parts[0] || '';
  return parts.map((p) => `(${p})`).join(f.termMode === 'or' ? ' OR ' : ' AND ');
}

// skip: dimensions whose filters are ignored (used for facet counts).
function where(f, skip = []) {
  const w = [];
  const p = [];
  const has = (s) => !skip.includes(s);
  if (has('q') && ftsMatch(f)) {
    const m = ftsMatch(f);
    if (m) {
      w.push('a.rowid IN (SELECT rowid FROM ads_fts WHERE ads_fts MATCH ?)');
      p.push(m);
    }
  }
  if (has('occ') && Array.isArray(f.sel) && f.sel.length) {
    const col = { field: 'a.field_id', group: 'a.group_id', occ: 'a.occ_id' };
    const parts = [];
    for (const k of Object.keys(col)) {
      const ids = f.sel.filter((s) => s.k === k).map((s) => s.id);
      if (ids.length) { parts.push(`${col[k]} IN (${ids.map(() => '?').join(',')})`); p.push(...ids); }
    }
    if (parts.length) w.push(`(${parts.join(' OR ')})`);
  }
  if (has('loc') && Array.isArray(f.loc) && f.loc.length) {
    const parts = [];
    const regs = f.loc.filter((s) => s.k === 'region').map((s) => s.id);
    if (regs.length) { parts.push(`a.region IN (${regs.map(() => '?').join(',')})`); p.push(...regs); }
    for (const s of f.loc.filter((x) => x.k === 'muni')) { parts.push('(a.muni = ? AND a.region = ?)'); p.push(s.id, s.ri ?? ''); }
    w.push(`(${parts.join(' OR ')})`);
  }
  if (has('date')) {
    if (f.from) { w.push('a.pub_date >= ?'); p.push(f.from); }
    if (f.to) { w.push('a.pub_date <= ?'); p.push(f.to); }
  }
  if (has('emp') && f.emp) { w.push('a.emp_type = ?'); p.push(f.emp); }
  if (has('hours') && f.hours) { w.push('a.hours = ?'); p.push(f.hours); }
  if (has('employers') && Array.isArray(f.employers) && f.employers.length) {
    w.push(`a.employer COLLATE BINARY IN (${f.employers.map(() => '?').join(',')})`);
    p.push(...f.employers);
  }
  return { sql: w.length ? w.join(' AND ') : '1', params: p };
}

const LIST_COLS = 'a.ad_id, a.headline, a.pub_date, a.employer, a.region, a.muni, a.field, a.grp, a.occ, a.emp_type, a.hours';

function search(db, f, offset, limit, wantTotal) {
  let rows;
  if (f.sort === 'relevance' && ftsMatch(f)) {
    const { sql, params } = where(f, ['q']);
    rows = db.prepare(
      `SELECT ${LIST_COLS} FROM ads_fts JOIN ads a ON a.rowid = ads_fts.rowid
       WHERE ads_fts MATCH ? AND ${sql} ORDER BY bm25(ads_fts, 10, 3, 1) LIMIT ? OFFSET ?`
    ).all(ftsMatch(f), ...params, limit, offset);
  } else {
    const { sql, params } = where(f);
    const dir = f.sort === 'oldest' ? 'ASC' : 'DESC';
    if (where(f, ['date']).sql !== '1' && !ftsMatch(f) && offset + limit <= 8192) {
      const dates = where({ from: f.from, to: f.to });
      const boundary = db.prepare(
        `SELECT a.pub_date, a.rowid FROM ads a INDEXED BY ix_pub WHERE ${dates.sql}
         ORDER BY a.pub_date ${dir}, a.rowid ${dir} LIMIT 1 OFFSET 8191`
      ).get(...dates.params);
      if (!boundary || boundary.pub_date !== null) {
        const bound = boundary
          ? dir === 'ASC' ? '(a.pub_date IS NULL OR (a.pub_date, a.rowid) <= (?, ?))' : '(a.pub_date, a.rowid) >= (?, ?)'
          : '1';
        rows = db.prepare(
          `SELECT ${LIST_COLS} FROM ads a INDEXED BY ix_pub WHERE ${sql} AND ${bound}
           ORDER BY a.pub_date ${dir}, a.rowid ${dir} LIMIT ? OFFSET ?`
        ).all(...params, ...(boundary ? [boundary.pub_date, boundary.rowid] : []), limit, offset);
      }
    }
    if (!rows || rows.length < limit) {
      rows = db.prepare(
        `SELECT ${LIST_COLS} FROM ads a WHERE ${sql} ORDER BY a.pub_date ${dir}, a.rowid ${dir} LIMIT ? OFFSET ?`
      ).all(...params, limit, offset);
    }
  }
  let total = null;
  if (wantTotal) total = count(db, f);
  return { total, rows: rows.map((r) => ({ ...r })) };
}

// The unfiltered total comes from the per-source counts: a COUNT(*) over millions of rows takes seconds.
function totalAds(db) {
  const n = db.prepare('SELECT COALESCE(SUM(ads), 0) n FROM sources').get().n;
  return n || db.prepare('SELECT COUNT(*) n FROM ads').get().n;
}

function count(db, f) {
  const { sql, params } = where(f);
  if (sql === '1') return totalAds(db);
  if (where(f, ['date']).sql === '1' && isBuilt(db)) {
    return db.prepare('SELECT COALESCE(SUM(n), 0) n FROM sum_day WHERE day >= ? AND day <= ?').get(f.from || '0000', f.to || '9999').n;
  }
  return db.prepare(`SELECT COUNT(*) n FROM ads a WHERE ${sql}`).get(...params).n;
}

const FACETS = {
  occ: { cols: 'field_id fi, group_id gi, occ_id oi', skip: ['occ'], extra: 'GROUP BY field_id, group_id, occ_id', key: ['fi', 'gi', 'oi'] },
  loc: { cols: 'region r, muni m', skip: ['loc'], extra: 'GROUP BY region, muni', key: ['r', 'm'] },
  year: { cols: 'year y', skip: ['date'], extra: 'GROUP BY year ORDER BY year DESC', key: ['y'] },
  emp: { cols: 'emp_type v', skip: ['emp'], extra: 'GROUP BY emp_type ORDER BY n DESC', key: ['v'] },
  hours: { cols: 'hours v', skip: ['hours'], extra: 'GROUP BY hours ORDER BY n DESC', key: ['v'] },
};

const keyOf = (spec, r) => JSON.stringify(spec.key.map((k) => r[k] ?? (k === 'y' ? 0 : '')));

/* ---------- summary tables ----------
 * Per-dimension counts of all ads, kept up to date by the importer and by source removal, so the filter
 * options and the ads-over-time chart never need a scan of the whole ads table. */

const isBuilt = (db) => {
  const r = db.prepare("SELECT value FROM meta WHERE key = 'summary_version'").get();
  return !!r && r.value === '2';
};

const nz = (v) => (v === null || v === undefined ? '' : v);
const nul = (s) => (s === '' ? null : s);

function newAcc() {
  return { occ: new Map(), loc: new Map(), year: new Map(), emp: new Map(), hours: new Map(), day: new Map(), employers: new Map() };
}
function bump(m, key, row) {
  const e = m.get(key);
  if (e) e.n++; else m.set(key, { row, n: 1 });
}
// `v` has the column order of toRow().values.
function accAdd(acc, v) {
  bump(acc.occ, `${nz(v[8])}\u0001${nz(v[10])}\u0001${nz(v[12])}`, [nz(v[8]), v[9], nz(v[10]), v[11], nz(v[12]), v[13]]);
  bump(acc.loc, `${nz(v[6])}\u0001${nz(v[7])}`, [nz(v[6]), nz(v[7])]);
  bump(acc.year, String(v[3] || 0), [v[3] || 0]);
  bump(acc.emp, nz(v[14]), [nz(v[14])]);
  bump(acc.hours, nz(v[15]), [nz(v[15])]);
  if (v[2]) bump(acc.day, v[2], [v[2]]);
  if (v[5]) bump(acc.employers, v[5], [v[5]]);
}

const UPSERT = {
  occ: 'INSERT INTO sum_occ(field_id,field,group_id,grp,occ_id,occ,n) VALUES (?,?,?,?,?,?,?) ON CONFLICT(field_id,group_id,occ_id) DO UPDATE SET n = n + excluded.n',
  loc: 'INSERT INTO sum_loc(region,muni,n) VALUES (?,?,?) ON CONFLICT(region,muni) DO UPDATE SET n = n + excluded.n',
  year: 'INSERT INTO sum_year(year,n) VALUES (?,?) ON CONFLICT(year) DO UPDATE SET n = n + excluded.n',
  emp: 'INSERT INTO sum_emp(v,n) VALUES (?,?) ON CONFLICT(v) DO UPDATE SET n = n + excluded.n',
  hours: 'INSERT INTO sum_hours(v,n) VALUES (?,?) ON CONFLICT(v) DO UPDATE SET n = n + excluded.n',
  day: 'INSERT INTO sum_day(day,n) VALUES (?,?) ON CONFLICT(day) DO UPDATE SET n = n + excluded.n',
  employers: 'INSERT INTO sum_employer(v,n) VALUES (?,?) ON CONFLICT(v) DO UPDATE SET n = n + excluded.n',
};
const SUM_TABLE = { occ: 'sum_occ', loc: 'sum_loc', year: 'sum_year', emp: 'sum_emp', hours: 'sum_hours', day: 'sum_day', employers: 'sum_employer' };
const stmtCache = new WeakMap();

// Adds (sign 1) or subtracts (sign -1) the accumulated counts; call it inside the same transaction as the ads change.
function accFlush(db, acc, sign = 1) {
  let st = stmtCache.get(db);
  if (!st) {
    st = {};
    for (const k of Object.keys(UPSERT)) st[k] = db.prepare(UPSERT[k]);
    stmtCache.set(db, st);
  }
  for (const k of Object.keys(UPSERT)) {
    for (const e of acc[k].values()) st[k].run(...e.row, e.n * sign);
    acc[k].clear();
    if (sign < 0) db.exec(`DELETE FROM ${SUM_TABLE[k]} WHERE n <= 0`);
  }
}

const SCAN_SQL = 'SELECT NULL, NULL, pub_date, year, NULL, employer, region, muni, field_id, field, group_id, grp, occ_id, occ, emp_type, hours, rowid FROM ads';
function scanRows(db, sql, ...params) {
  const st = db.prepare(sql);
  st.setReturnArrays(true);
  return st.iterate(...params);
}

// One pass over all ads; slow on millions of rows (minutes), so it runs once in the background.
// Indexes for the employment and hours filters are created afterwards.
function ensureSummary(db, onProgress = () => {}) {
  if (isBuilt(db)) return { built: true, fresh: false };
  const acc = newAcc();
  const total = db.prepare('SELECT MAX(rowid) m FROM ads').get().m || 1;
  let n = 0;
  onProgress({ pct: 1, text: 'Building statistics (one-time): scanning ads…' });
  for (const row of scanRows(db, SCAN_SQL)) {
    accAdd(acc, row);
    if (++n % 250000 === 0) onProgress({ pct: 1 + (88 * row[16]) / total, text: `Building statistics (one-time): ${Math.round((100 * row[16]) / total)}% of ads scanned…` });
  }
  db.exec('BEGIN');
  try {
    for (const t of Object.values(SUM_TABLE)) db.exec(`DELETE FROM ${t}`);
    accFlush(db, acc, 1);
    db.prepare("INSERT OR REPLACE INTO meta(key, value) VALUES ('summary_version', '2')").run();
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  onProgress({ pct: 90, text: 'Statistics ready; indexing employment and hours…', ready: true });
  db.exec('CREATE INDEX IF NOT EXISTS ix_emp ON ads(emp_type); CREATE INDEX IF NOT EXISTS ix_hours ON ads(hours);');
  return { built: true, fresh: true };
}

function summaryFacets(db) {
  return {
    occ: db.prepare('SELECT field_id fi, field f, group_id gi, grp g, occ_id oi, occ o, n FROM sum_occ').all()
      .map((r) => ({ fi: nul(r.fi), f: r.f, gi: nul(r.gi), g: r.g, oi: nul(r.oi), o: r.o, n: r.n })),
    loc: db.prepare('SELECT region r, muni m, n FROM sum_loc').all().map((r) => ({ r: nul(r.r), m: nul(r.m), n: r.n })),
    year: db.prepare('SELECT year y, n FROM sum_year ORDER BY year DESC').all().map((r) => ({ y: r.y, n: r.n })),
    emp: db.prepare('SELECT v, n FROM sum_emp ORDER BY n DESC').all().map((r) => ({ v: nul(r.v), n: r.n })),
    hours: db.prepare('SELECT v, n FROM sum_hours ORDER BY n DESC').all().map((r) => ({ v: nul(r.v), n: r.n })),
    employers: db.prepare('SELECT v, n FROM sum_employer ORDER BY n DESC, v COLLATE NOCASE LIMIT 30').all()
      .map((r) => ({ v: r.v, n: r.n })),
  };
}

// Every option in the data is returned; n is its count under the other active filters (0 = no match).
// The option lists and the unfiltered counts come from the summary tables; only filtered counts query the ads.
const facetCaches = new WeakMap();

function facets(db, f) {
  if (!isBuilt(db)) return { building: true };
  const universe = summaryFacets(db);
  if (where(f).sql === '1') return universe;
  const version = JSON.stringify(db.prepare('PRAGMA data_version').get());
  const changes = db.prepare('SELECT total_changes() n').get().n;
  let cache = facetCaches.get(db);
  if (!cache || cache.version !== version || cache.changes !== changes) {
    cache = { version, changes, counts: new Map() };
    facetCaches.set(db, cache);
  }
  const out = {};
  const pending = new Map();
  const selected = new Map();
  for (const [name, spec] of Object.entries(FACETS)) {
    if (where(f, spec.skip).sql === '1') { out[name] = universe[name]; continue; }
    const { sql, params } = where(f, spec.skip);
    const signature = JSON.stringify([name, sql, params]);
    let counts = cache.counts.get(signature);
    if (counts) {
      cache.counts.delete(signature);
    } else {
      counts = new Map();
      const predicate = JSON.stringify([sql, params]);
      if (!pending.has(predicate)) pending.set(predicate, { sql, params, dimensions: [] });
      pending.get(predicate).dimensions.push(name);
    }
    cache.counts.set(signature, counts);
    if (cache.counts.size > 32) cache.counts.delete(cache.counts.keys().next().value);
    selected.set(name, counts);
  }
  try {
    for (const { sql, params, dimensions } of pending.values()) {
      const queries = dimensions.map(name => {
        const spec = FACETS[name];
        const keys = spec.key.map(key => `COALESCE(${key}, ${key === 'y' ? '0' : "''"})`);
        return `SELECT '${name}' dimension, json_array(${keys.join(',')}) facet_key, n
                FROM (SELECT ${spec.cols}, COUNT(*) n FROM ${dimensions.length > 1 ? 'matched' : 'ads'} a
                      ${dimensions.length > 1 ? '' : `WHERE ${sql}`} ${spec.extra})`;
      });
      const prefix = dimensions.length > 1
        ? `WITH matched AS MATERIALIZED (SELECT field_id, group_id, occ_id, region, muni, year, emp_type, hours FROM ads a WHERE ${sql}) `
        : '';
      for (const row of db.prepare(prefix + queries.join(' UNION ALL ')).all(...params)) {
        const counts = selected.get(row.dimension);
        counts.set(row.facet_key, (counts.get(row.facet_key) || 0) + row.n);
      }
    }
  } catch (error) {
    facetCaches.delete(db);
    throw error;
  }
  for (const [name, counts] of selected) {
    const spec = FACETS[name];
    out[name] = universe[name].map((r) => ({ ...r, n: counts.get(keyOf(spec, r)) || 0 }));
  }
  const employerFilter = where(f);
  const employerSignature = JSON.stringify(['employers', employerFilter.sql, employerFilter.params]);
  let employers = cache.counts.get(employerSignature);
  if (employers) {
    cache.counts.delete(employerSignature);
    cache.counts.set(employerSignature, employers);
  }
  try {
    if (!employers) {
      employers = db.prepare(`SELECT a.employer v, COUNT(*) n FROM ads a
        WHERE ${employerFilter.sql} AND a.employer IS NOT NULL AND a.employer <> ''
        GROUP BY a.employer ORDER BY n DESC, a.employer COLLATE NOCASE LIMIT 30`).all(...employerFilter.params)
        .map((r) => ({ v: r.v, n: r.n }));
      cache.counts.set(employerSignature, employers);
      if (cache.counts.size > 32) cache.counts.delete(cache.counts.keys().next().value);
    }
  } catch (error) {
    facetCaches.delete(db);
    throw error;
  }
  out.employers = employers;
  return out;
}

const DAY = 864e5;
const isoDate = (t) => new Date(t).toISOString().slice(0, 10);

// Ads per bin over the selected period (or the whole data range); bin size follows the span.
function timeline(db, f) {
  const built = isBuilt(db);
  const r = built
    ? db.prepare('SELECT MIN(day) a, MAX(day) b FROM sum_day').get()
    : db.prepare('SELECT MIN(pub_date) a, MAX(pub_date) b FROM ads').get();
  if (!r.a) return { unit: 'month', from: null, to: null, points: [] };
  let from = f.from || r.a;
  let to = f.to || r.b;
  if (from > to) [from, to] = [to, from];
  const days = (Date.parse(to) - Date.parse(from)) / DAY + 1;
  const unit = days > 2200 ? 'year' : days > 150 ? 'month' : days > 45 ? 'week' : 'day';
  const expr = {
    year: 'substr(%D,1,4)',
    month: 'substr(%D,1,7)',
    week: "date(%D,'weekday 0','-6 days')",
    day: '%D',
  }[unit];
  // Only a date filter (or none): bin the per-day summary instead of scanning the ads.
  let counts;
  if (built && where(f, ['date']).sql === '1') {
    counts = new Map(
      db.prepare(`SELECT ${expr.replaceAll('%D', 'day')} k, SUM(n) n FROM sum_day WHERE day >= ? AND day <= ? GROUP BY k`)
        .all(f.from || '0000', f.to || '9999').map((x) => [x.k, x.n])
    );
  } else {
    const { sql, params } = where(f);
    counts = new Map(
      db.prepare(`SELECT ${expr.replaceAll('%D', 'a.pub_date')} k, COUNT(*) n FROM ads a WHERE ${sql} AND a.pub_date IS NOT NULL GROUP BY k`)
        .all(...params).map((x) => [x.k, x.n])
    );
  }
  const points = [];
  if (unit === 'year') {
    for (let y = +from.slice(0, 4); y <= +to.slice(0, 4); y++) points.push({ d: `${y}-01-01`, n: counts.get(String(y)) || 0 });
  } else if (unit === 'month') {
    let y = +from.slice(0, 4);
    let m = +from.slice(5, 7);
    const ye = +to.slice(0, 4);
    const me = +to.slice(5, 7);
    while (y < ye || (y === ye && m <= me)) {
      const k = `${y}-${String(m).padStart(2, '0')}`;
      points.push({ d: `${k}-01`, n: counts.get(k) || 0 });
      if (++m > 12) { m = 1; y++; }
    }
  } else {
    const t0 = Date.parse(from);
    const step = unit === 'week' ? 7 : 1;
    let t = unit === 'week' ? t0 - ((new Date(t0).getUTCDay() + 6) % 7) * DAY : t0;
    for (; t <= Date.parse(to); t += step * DAY) {
      const k = isoDate(t);
      points.push({ d: k, n: counts.get(k) || 0 });
    }
  }
  return { unit, from, to, points };
}

function getAd(db, id) {
  const r = db.prepare('SELECT raw FROM ads WHERE ad_id = ?').get(String(id));
  return r ? JSON.parse(r.raw) : null;
}

function info(db) {
  const t = isBuilt(db)
    ? db.prepare('SELECT MIN(day) mn, MAX(day) mx FROM sum_day').get()
    : db.prepare('SELECT MIN(pub_date) mn, MAX(pub_date) mx FROM ads').get();
  const sources = db.prepare('SELECT name, ads, imported_at FROM sources ORDER BY name').all().map((r) => ({ ...r }));
  return { total: totalAds(db), min: t.mn, max: t.mx, sources };
}

function datasetStats(db) {
  return { ...db.prepare('SELECT COALESCE(SUM(ads), 0) total, COUNT(*) sourceCount FROM sources').get() };
}

function removeSource(db, name) {
  const built = isBuilt(db);
  db.exec('BEGIN');
  try {
    if (built) {
      const acc = newAcc();
      for (const row of scanRows(db, `${SCAN_SQL} WHERE source = ?`, name)) accAdd(acc, row);
      accFlush(db, acc, -1);
    }
    db.prepare('DELETE FROM ads_fts WHERE rowid IN (SELECT rowid FROM ads WHERE source = ?)').run(name);
    db.prepare('DELETE FROM ads WHERE source = ?').run(name);
    db.prepare('DELETE FROM sources WHERE name = ?').run(name);
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

module.exports = {
  open, toRow, INSERT_SQL, search, count, facets, timeline, getAd, info, datasetStats, removeSource,
  isBuilt, ensureSummary, newAcc, accAdd, accFlush,
};
