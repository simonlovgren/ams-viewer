'use strict';
const { DatabaseSync } = require('node:sqlite');

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
`;

function open(path) {
  const db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL; PRAGMA busy_timeout=15000;');
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

// Maps one raw ad to the flat columns + FTS body.
function toRow(d, source) {
  const addr = d.workplace_address || {};
  const pub = String(d.publication_date || '').slice(0, 10) || null;
  return {
    values: [
      String(d.id),
      d.headline || '',
      pub,
      pub ? Number(pub.slice(0, 4)) : null,
      d.application_deadline || null,
      (d.employer && (d.employer.name || d.employer.workplace)) || null,
      addr.region || null,
      addr.municipality || null,
      cid(d.occupation_field), lbl(d.occupation_field),
      cid(d.occupation_group), lbl(d.occupation_group),
      cid(d.occupation), lbl(d.occupation),
      lbl(d.employment_type),
      lbl(d.working_hours_type),
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
    rows = db.prepare(
      `SELECT ${LIST_COLS} FROM ads a WHERE ${sql} ORDER BY a.pub_date ${dir}, a.rowid ${dir} LIMIT ? OFFSET ?`
    ).all(...params, limit, offset);
  }
  let total = null;
  if (wantTotal) {
    const { sql, params } = where(f);
    total = db.prepare(`SELECT COUNT(*) n FROM ads a WHERE ${sql}`).get(...params).n;
  }
  return { total, rows: rows.map((r) => ({ ...r })) };
}

const FACETS = {
  occ: { cols: 'field_id fi, MAX(field) f, group_id gi, MAX(grp) g, occ_id oi, MAX(occ) o', skip: ['occ'], extra: 'GROUP BY field_id, group_id, occ_id' },
  loc: { cols: 'region r, muni m', skip: ['loc'], extra: 'GROUP BY region, muni' },
  year: { cols: 'year y', skip: ['date'], extra: 'GROUP BY year ORDER BY year DESC' },
  emp: { cols: 'emp_type v', skip: ['emp'], extra: 'GROUP BY emp_type ORDER BY n DESC' },
  hours: { cols: 'hours v', skip: ['hours'], extra: 'GROUP BY hours ORDER BY n DESC' },
};

const rowKey = (r) => JSON.stringify(Object.values(r).slice(0, -1));

// Every option in the data is returned; n is its count under the other active filters (0 = no match).
// `cache` keeps the unfiltered option lists until another connection changes the database.
function facets(db, f, cache = {}) {
  const ver = db.prepare('PRAGMA data_version').get().data_version;
  if (cache.ver !== ver) { cache.ver = ver; cache.all = {}; }
  const run = (spec, filter) => {
    const { sql, params } = where(filter, spec.skip);
    return db.prepare(`SELECT ${spec.cols}, COUNT(*) n FROM ads a WHERE ${sql} ${spec.extra}`).all(...params).map((r) => ({ ...r }));
  };
  const out = {};
  for (const [name, spec] of Object.entries(FACETS)) {
    const all = (cache.all[name] ||= run(spec, {}));
    if (where(f, spec.skip).sql === '1') { out[name] = all; continue; }
    const counts = new Map(run(spec, f).map((r) => [rowKey(r), r.n]));
    out[name] = all.map((r) => ({ ...r, n: counts.get(rowKey(r)) || 0 }));
  }
  out.timeline = timeline(db, f);
  return out;
}

const DAY = 864e5;
const isoDate = (t) => new Date(t).toISOString().slice(0, 10);

// Ads per bin over the selected period (or the whole data range); bin size follows the span.
function timeline(db, f) {
  const r = db.prepare('SELECT MIN(pub_date) a, MAX(pub_date) b FROM ads').get();
  if (!r.a) return { unit: 'month', from: null, to: null, points: [] };
  let from = f.from || r.a;
  let to = f.to || r.b;
  if (from > to) [from, to] = [to, from];
  const days = (Date.parse(to) - Date.parse(from)) / DAY + 1;
  const unit = days > 2200 ? 'year' : days > 150 ? 'month' : days > 45 ? 'week' : 'day';
  const expr = {
    year: 'substr(a.pub_date,1,4)',
    month: 'substr(a.pub_date,1,7)',
    week: "date(a.pub_date,'weekday 0','-6 days')",
    day: 'a.pub_date',
  }[unit];
  const { sql, params } = where(f);
  const counts = new Map(
    db.prepare(`SELECT ${expr} k, COUNT(*) n FROM ads a WHERE ${sql} AND a.pub_date IS NOT NULL GROUP BY k`)
      .all(...params).map((x) => [x.k, x.n])
  );
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
  const t = db.prepare('SELECT COUNT(*) n, MIN(pub_date) mn, MAX(pub_date) mx FROM ads').get();
  const sources = db.prepare('SELECT name, ads, imported_at FROM sources ORDER BY name').all().map((r) => ({ ...r }));
  return { total: t.n, min: t.mn, max: t.mx, sources };
}

function removeSource(db, name) {
  db.exec('BEGIN');
  try {
    db.prepare('DELETE FROM ads_fts WHERE rowid IN (SELECT rowid FROM ads WHERE source = ?)').run(name);
    db.prepare('DELETE FROM ads WHERE source = ?').run(name);
    db.prepare('DELETE FROM sources WHERE name = ?').run(name);
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

module.exports = { open, toRow, INSERT_SQL, search, facets, getAd, info, removeSource };
