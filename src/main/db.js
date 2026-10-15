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

// skip: dimensions whose filters are ignored (used for facet counts).
function where(f, skip = []) {
  const w = [];
  const p = [];
  const has = (s) => !skip.includes(s);
  if (has('q') && f.q) {
    const m = ftsQuery(f.q);
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
  if (has('loc')) {
    if (f.muni) { w.push('a.muni = ? AND a.region = ?'); p.push(f.muni, f.region || ''); }
    else if (f.region) { w.push('a.region = ?'); p.push(f.region); }
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
  if (f.sort === 'relevance' && f.q && ftsQuery(f.q)) {
    const { sql, params } = where(f, ['q']);
    rows = db.prepare(
      `SELECT ${LIST_COLS} FROM ads_fts JOIN ads a ON a.rowid = ads_fts.rowid
       WHERE ads_fts MATCH ? AND ${sql} ORDER BY bm25(ads_fts, 10, 3, 1) LIMIT ? OFFSET ?`
    ).all(ftsQuery(f.q), ...params, limit, offset);
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

function facets(db, f) {
  const q = (cols, skip, extra = '') => {
    const { sql, params } = where(f, skip);
    return db
      .prepare(`SELECT ${cols}, COUNT(*) n FROM ads a WHERE ${sql} ${extra}`)
      .all(...params)
      .map((r) => ({ ...r }));
  };
  return {
    occ: q('field_id fi, MAX(field) f, group_id gi, MAX(grp) g, occ_id oi, MAX(occ) o', ['occ'], 'GROUP BY field_id, group_id, occ_id'),
    loc: q('region r, muni m', ['loc'], 'GROUP BY region, muni'),
    year: q('year y', ['date'], 'GROUP BY year ORDER BY year DESC'),
    emp: q('emp_type v', ['emp'], 'GROUP BY emp_type ORDER BY n DESC'),
    hours: q('hours v', ['hours'], 'GROUP BY hours ORDER BY n DESC'),
  };
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
