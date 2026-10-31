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
  raw TEXT,
  employer_id TEXT,
  legacy_occ_id TEXT,
  legacy_muni_code TEXT
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
CREATE TABLE IF NOT EXISTS sum_employer (org_id TEXT NOT NULL, v TEXT NOT NULL, n INTEGER NOT NULL, PRIMARY KEY (org_id, v));
CREATE TABLE IF NOT EXISTS employer_catalog (org_id TEXT NOT NULL, name_key TEXT NOT NULL, v TEXT NOT NULL, n INTEGER NOT NULL, PRIMARY KEY (org_id, name_key));
CREATE INDEX IF NOT EXISTS ix_employer_rank ON employer_catalog(n DESC, v COLLATE NOCASE, v COLLATE BINARY, org_id);
CREATE TABLE IF NOT EXISTS legacy_occ_map (legacy_id TEXT NOT NULL, tuple TEXT NOT NULL, n INTEGER NOT NULL, PRIMARY KEY (legacy_id, tuple));
CREATE TABLE IF NOT EXISTS legacy_loc_map (municipality_code TEXT NOT NULL, tuple TEXT NOT NULL, n INTEGER NOT NULL, PRIMARY KEY (municipality_code, tuple));
`;

function open(path) {
  const db = new DatabaseSync(path);
  // busy_timeout first: opening several connections at once on a WAL database that needs recovery otherwise fails with SQLITE_BUSY.
  db.exec('PRAGMA busy_timeout=30000; PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL;');
  db.exec(SCHEMA);
  const columns = db.prepare('PRAGMA table_info(ads)').all().map(column => column.name);
  if (!['employer_id', 'legacy_occ_id', 'legacy_muni_code'].every(name => columns.includes(name))) {
    db.exec('BEGIN IMMEDIATE');
    try {
      const current = new Set(db.prepare('PRAGMA table_info(ads)').all().map(column => column.name));
      for (const name of ['employer_id', 'legacy_occ_id', 'legacy_muni_code']) {
        if (!current.has(name)) db.exec(`ALTER TABLE ads ADD COLUMN ${name} TEXT`);
      }
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      db.close();
      throw error;
    }
  }
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
const legacyId = (o) => {
  const value = o && (o.legacy_ams_taxonomy_id ?? o.legacy_taxonomy_id);
  return value === null || value === undefined || String(value).trim() === '' ? null : String(value).trim();
};
const legacyCode = (value) => value === null || value === undefined || String(value).trim() === '' ? null : String(value).trim();
// From 2023 the source holds arrays for occupation and employment type; the first entry is used.
const one = (x) => (Array.isArray(x) ? x.find(Boolean) || null : x);
const items = (x) => Array.isArray(x) ? x.filter(Boolean) : x ? [x] : [];
const employerId = (value) => typeof value === 'string' || typeof value === 'number' ? String(value).trim() || null : null;

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
      employerId(d.employer?.organization_number),
      legacyId(occ),
      legacyCode(addr.municipality_code),
    ],
    fts: [d.headline || '', (d.employer && d.employer.name) || '', (d.description && d.description.text) || ''],
  };
}

function projectionValues(row) {
  const values = toRow(JSON.parse(row.raw), row.source).values;
  for (const [index, column] of [[6, 'region'], [7, 'muni'], [8, 'field_id'], [9, 'field'], [10, 'group_id'], [11, 'grp'], [12, 'occ_id'], [13, 'occ']]) {
    if (row[column] !== undefined) values[index] = row[column];
  }
  return values;
}

const INSERT_SQL = `INSERT OR IGNORE INTO ads
 (ad_id,headline,pub_date,year,deadline,employer,region,muni,field_id,field,group_id,grp,occ_id,occ,emp_type,hours,source,raw,employer_id,legacy_occ_id,legacy_muni_code)
 VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;

function legacyReferences(ad) {
  const references = { occupations: [], locations: [] };
  const occupations = items(ad.occupation);
  const groups = items(ad.occupation_group);
  const fields = items(ad.occupation_field);
  if (occupations.length === groups.length && occupations.length === fields.length) {
    for (let index = 0; index < occupations.length; index++) {
      const id = legacyId(occupations[index]);
      const tuple = {
        field_id: cid(fields[index]), field: lbl(fields[index]),
        group_id: cid(groups[index]), grp: lbl(groups[index]),
        occ_id: cid(occupations[index]), occ: lbl(occupations[index]),
      };
      if (id && tuple.field_id && tuple.field && tuple.group_id && tuple.grp && tuple.occ_id && tuple.occ) {
        references.occupations.push({ id, tuple });
      }
    }
  }
  const address = ad.workplace_address || {};
  const code = legacyCode(address.municipality_code);
  const tuple = { muni: address.municipality || null, region: address.region || null };
  if (code && (tuple.muni || tuple.region)) references.locations.push({ code, tuple });
  return references;
}

const legacyAdjustStatements = new WeakMap();
function adjustLegacyReferences(db, references, direction = 1) {
  let statements = legacyAdjustStatements.get(db);
  if (!statements) {
    statements = {
      occupation: db.prepare(`INSERT INTO legacy_occ_map(legacy_id, tuple, n) VALUES (?, ?, ?)
        ON CONFLICT(legacy_id, tuple) DO UPDATE SET n = n + excluded.n`),
      location: db.prepare(`INSERT INTO legacy_loc_map(municipality_code, tuple, n) VALUES (?, ?, ?)
        ON CONFLICT(municipality_code, tuple) DO UPDATE SET n = n + excluded.n`),
      removeOccupation: db.prepare('DELETE FROM legacy_occ_map WHERE legacy_id = ? AND tuple = ? AND n <= 0'),
      removeLocation: db.prepare('DELETE FROM legacy_loc_map WHERE municipality_code = ? AND tuple = ? AND n <= 0'),
    };
    legacyAdjustStatements.set(db, statements);
  }
  for (const reference of references.occupations || []) {
    const tuple = JSON.stringify(reference.tuple);
    statements.occupation.run(reference.id, tuple, direction);
    statements.removeOccupation.run(reference.id, tuple);
  }
  for (const reference of references.locations || []) {
    const tuple = JSON.stringify(reference.tuple);
    statements.location.run(reference.code, tuple, direction);
    statements.removeLocation.run(reference.code, tuple);
  }
}

function reconcileLegacyMappings(db, affected = {}, options = {}) {
  let changed = 0;
  const built = isBuilt(db);
  const skippedRows = options.skipSummaryRows || new Set();
  const summaryBefore = newAcc();
  const summaryAfter = newAcc();
  const occupationMaps = db.prepare('SELECT tuple FROM legacy_occ_map WHERE legacy_id = ? AND n > 0');
  const locationMaps = db.prepare('SELECT tuple FROM legacy_loc_map WHERE municipality_code = ? AND n > 0');
  const occupationRows = db.prepare('SELECT rowid, raw, source, field_id, field, group_id, grp, occ_id, occ FROM ads WHERE legacy_occ_id = ?');
  const locationRows = db.prepare('SELECT rowid, raw, source, region, muni FROM ads WHERE legacy_muni_code = ?');
  const updateTaxonomy = db.prepare('UPDATE ads SET field_id = ?, field = ?, group_id = ?, grp = ?, occ_id = ?, occ = ? WHERE rowid = ?');
  const updateLocation = db.prepare('UPDATE ads SET region = ?, muni = ? WHERE rowid = ?');
  for (const id of new Set(affected.occupations || [])) {
    const mappings = occupationMaps.all(id).map(row => JSON.parse(row.tuple));
    const mapping = mappings.length === 1 ? mappings[0] : null;
    for (const row of occupationRows.iterate(id)) {
      const baseline = toRow(JSON.parse(row.raw), row.source).values.slice(8, 14);
      const next = [...baseline];
      if (mapping) {
        const tuple = [mapping.field_id, mapping.field, mapping.group_id, mapping.grp, mapping.occ_id, mapping.occ];
        for (let index = 0; index < tuple.length; index++) {
          if (next[index] === null) next[index] = tuple[index];
        }
      }
      const current = [row.field_id, row.field, row.group_id, row.grp, row.occ_id, row.occ];
      if (next.some((value, index) => value !== current[index])) {
        const before = projectionValues(row);
        const after = [...before];
        for (let index = 0; index < next.length; index++) after[index + 8] = next[index];
        updateTaxonomy.run(...next, row.rowid);
        if (built && !skippedRows.has(row.rowid)) {
          accAdd(summaryBefore, before);
          accAdd(summaryAfter, after);
        }
        changed++;
      }
    }
  }
  for (const code of new Set(affected.locations || [])) {
    const mappings = locationMaps.all(code).map(row => JSON.parse(row.tuple));
    const municipalities = new Set(mappings.map(mapping => mapping.muni).filter(Boolean));
    const regions = new Set(mappings.map(mapping => mapping.region).filter(Boolean));
    const municipality = municipalities.size === 1 ? [...municipalities][0] : null;
    const region = regions.size === 1 ? [...regions][0] : null;
    for (const row of locationRows.iterate(code)) {
      const baseline = toRow(JSON.parse(row.raw), row.source).values;
      const nextRegion = baseline[6] === null && region ? region : baseline[6];
      const nextMuni = baseline[7] === null && municipality ? municipality : baseline[7];
      if (nextRegion !== row.region || nextMuni !== row.muni) {
        const before = projectionValues(row);
        const after = [...before];
        after[6] = nextRegion;
        after[7] = nextMuni;
        updateLocation.run(nextRegion, nextMuni, row.rowid);
        if (built && !skippedRows.has(row.rowid)) {
          accAdd(summaryBefore, before);
          accAdd(summaryAfter, after);
        }
        changed++;
      }
    }
  }
  if (built) {
    accFlush(db, summaryBefore, -1);
    accFlush(db, summaryAfter);
  }
  return { changed };
}

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
    const parts = [];
    const legacy = f.employers.filter(value => typeof value === 'string');
    const organizations = f.employers.filter(value => value && typeof value.id === 'string').map(value => value.id);
    const names = f.employers.filter(value => value && value.id === null && typeof value.label === 'string').map(value => value.label);
    if (legacy.length) { parts.push(`a.employer COLLATE BINARY IN (${legacy.map(() => '?').join(',')})`); p.push(...legacy); }
    if (organizations.length) { parts.push(`a.employer_id IN (${organizations.map(() => '?').join(',')})`); p.push(...organizations); }
    if (names.length) { parts.push(`(a.employer_id IS NULL AND a.employer COLLATE BINARY IN (${names.map(() => '?').join(',')}))`); p.push(...names); }
    w.push(parts.length ? `(${parts.join(' OR ')})` : '0');
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
  return !!r && r.value === '2' && !!db.prepare("SELECT 1 FROM meta WHERE key = 'employer_identity_version' AND value = '1'").get();
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
  if (v[5]) bump(acc.employers, JSON.stringify([nz(v[18]), v[5]]), [nz(v[18]), v[5]]);
}

const UPSERT = {
  occ: 'INSERT INTO sum_occ(field_id,field,group_id,grp,occ_id,occ,n) VALUES (?,?,?,?,?,?,?) ON CONFLICT(field_id,group_id,occ_id) DO UPDATE SET n = n + excluded.n',
  loc: 'INSERT INTO sum_loc(region,muni,n) VALUES (?,?,?) ON CONFLICT(region,muni) DO UPDATE SET n = n + excluded.n',
  year: 'INSERT INTO sum_year(year,n) VALUES (?,?) ON CONFLICT(year) DO UPDATE SET n = n + excluded.n',
  emp: 'INSERT INTO sum_emp(v,n) VALUES (?,?) ON CONFLICT(v) DO UPDATE SET n = n + excluded.n',
  hours: 'INSERT INTO sum_hours(v,n) VALUES (?,?) ON CONFLICT(v) DO UPDATE SET n = n + excluded.n',
  day: 'INSERT INTO sum_day(day,n) VALUES (?,?) ON CONFLICT(day) DO UPDATE SET n = n + excluded.n',
  employers: 'INSERT INTO sum_employer(org_id,v,n) VALUES (?,?,?) ON CONFLICT(org_id,v) DO UPDATE SET n = n + excluded.n',
};
const SUM_TABLE = { occ: 'sum_occ', loc: 'sum_loc', year: 'sum_year', emp: 'sum_emp', hours: 'sum_hours', day: 'sum_day', employers: 'sum_employer' };
const stmtCache = new WeakMap();

// Adds (sign 1) or subtracts (sign -1) the accumulated counts; call it inside the same transaction as the ads change.
function accFlush(db, acc, sign = 1) {
  const employers = new Map([...acc.employers.values()].map(entry => {
    const [id, name] = entry.row;
    return [JSON.stringify([id, id ? '' : name]), [id, id ? '' : name]];
  }));
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
  const removeEmployer = db.prepare('DELETE FROM employer_catalog WHERE org_id = ? AND name_key = ?');
  const updateEmployer = db.prepare(`INSERT INTO employer_catalog(org_id, name_key, v, n)
    SELECT org_id, ?, MIN(v COLLATE BINARY), SUM(n) FROM sum_employer
    WHERE org_id = ? AND (? <> '' OR v = ?) GROUP BY org_id HAVING SUM(n) > 0`);
  for (const [id, name] of employers.values()) {
    removeEmployer.run(id, name);
    updateEmployer.run(name, id, id, name);
  }
}

const SCAN_SQL = 'SELECT NULL, NULL, pub_date, year, NULL, employer, region, muni, field_id, field, group_id, grp, occ_id, occ, emp_type, hours, rowid, NULL, employer_id FROM ads';
function scanRows(db, sql, ...params) {
  const st = db.prepare(sql);
  st.setReturnArrays(true);
  return st.iterate(...params);
}

function migrateEmployerSummary(db) {
  if (!db.prepare('PRAGMA table_info(sum_employer)').all().some(column => column.name === 'org_id')) {
    db.exec('DROP TABLE sum_employer; CREATE TABLE sum_employer (org_id TEXT NOT NULL, v TEXT NOT NULL, n INTEGER NOT NULL, PRIMARY KEY (org_id, v));');
    stmtCache.delete(db);
  }
}

function ensureLegacyEnrichment(db, onProgress) {
  if (db.prepare("SELECT 1 FROM meta WHERE key = 'legacy_enrichment_version' AND value = '1'").get()) return;
  onProgress({ pct: 1, text: 'Enriching legacy records (one-time)…' });
  db.exec('BEGIN IMMEDIATE');
  try {
    db.exec("DELETE FROM meta WHERE key IN ('legacy_enrichment_version', 'summary_version'); DELETE FROM legacy_occ_map; DELETE FROM legacy_loc_map;");
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }

  const batch = db.prepare('SELECT rowid, raw, source, legacy_occ_id, legacy_muni_code FROM ads WHERE rowid > ? ORDER BY rowid LIMIT 500');
  const update = db.prepare('UPDATE ads SET legacy_occ_id = ?, legacy_muni_code = ? WHERE rowid = ?');
  const total = db.prepare('SELECT MAX(rowid) n FROM ads').get().n || 1;
  const affected = { occupations: new Set(), locations: new Set() };
  let last = 0;
  for (;;) {
    const rows = batch.all(last);
    if (!rows.length) break;
    db.exec('BEGIN');
    try {
      for (const row of rows) {
        const ad = JSON.parse(row.raw);
        const values = toRow(ad, row.source).values;
        if (row.legacy_occ_id !== values[19] || row.legacy_muni_code !== values[20]) {
          update.run(values[19], values[20], row.rowid);
        }
        const references = legacyReferences(ad);
        adjustLegacyReferences(db, references);
        for (const reference of references.occupations) affected.occupations.add(reference.id);
        for (const reference of references.locations) affected.locations.add(reference.code);
      }
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
    last = rows.at(-1).rowid;
    onProgress({ pct: 1 + 75 * last / total, text: `Enriching legacy records (one-time): ${Math.round(100 * last / total)}%…` });
  }

  db.exec('BEGIN IMMEDIATE');
  try {
    onProgress({ pct: 80, text: 'Enriching legacy records: reconciling mappings…' });
    reconcileLegacyMappings(db, {
      occupations: [...affected.occupations],
      locations: [...affected.locations],
    });
    db.prepare("INSERT OR REPLACE INTO meta(key, value) VALUES ('legacy_enrichment_version', '1')").run();
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

// One pass over all ads; slow on millions of rows (minutes), so it runs once in the background.
// Indexes for the employment and hours filters are created afterwards.
function ensureSummary(db, onProgress = () => {}) {
  ensureLegacyEnrichment(db, onProgress);
  if (!db.prepare("SELECT 1 FROM sqlite_schema WHERE type = 'index' AND name = 'ix_legacy_occ_id'").get()) {
    onProgress({ pct: 1, text: 'Indexing legacy occupation IDs…' });
    db.exec('CREATE INDEX IF NOT EXISTS ix_legacy_occ_id ON ads(legacy_occ_id);');
  }
  if (!db.prepare("SELECT 1 FROM sqlite_schema WHERE type = 'index' AND name = 'ix_legacy_muni_code'").get()) {
    onProgress({ pct: 1, text: 'Indexing legacy municipality codes…' });
    db.exec('CREATE INDEX IF NOT EXISTS ix_legacy_muni_code ON ads(legacy_muni_code);');
  }
  if (!db.prepare("SELECT 1 FROM meta WHERE key = 'array_tags_version' AND value = '1'").get()) {
    onProgress({ pct: 1, text: 'Repairing imported tags (one-time)…' });
    const columns = ['field_id', 'field', 'group_id', 'grp', 'occ_id', 'occ', 'emp_type', 'hours'];
    const dimensions = [
      ['occupation_field', ['field_id', 'field']], ['occupation_group', ['group_id', 'grp']],
      ['occupation', ['occ_id', 'occ']], ['employment_type', ['emp_type']], ['working_hours_type', ['hours']],
    ];
    const predicate = dimensions.map(([key, names]) =>
      `((${names.map(name => `${name} IS NULL`).join(' OR ')}) AND json_type(raw, '$.${key}') = 'array')`
    ).join(' OR ');
    const batch = db.prepare(`SELECT rowid, raw, ${columns.join(', ')} FROM ads WHERE rowid > ? AND (${predicate}) ORDER BY rowid LIMIT 500`);
    const update = db.prepare(`UPDATE ads SET ${columns.map(name => `${name} = COALESCE(${name}, ?)`).join(', ')} WHERE rowid = ?`);
    let last = 0;
    for (;;) {
      const rows = batch.all(last);
      if (!rows.length) break;
      db.exec('BEGIN');
      try {
        for (const row of rows) {
          const values = toRow(JSON.parse(row.raw)).values.slice(8, 16);
          if (columns.some((name, index) => row[name] === null && values[index] !== null)) {
            db.prepare("DELETE FROM meta WHERE key = 'summary_version'").run();
            update.run(...values, row.rowid);
          }
        }
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
      last = rows[rows.length - 1].rowid;
      onProgress({ pct: 1, text: 'Repairing imported tags (one-time)…' });
    }
    db.prepare("INSERT OR REPLACE INTO meta(key, value) VALUES ('array_tags_version', '1')").run();
  }
  if (!db.prepare("SELECT 1 FROM meta WHERE key = 'employer_identity_version' AND value = '1'").get()) {
    onProgress({ pct: 1, text: 'Consolidating employers (one-time)…' });
    db.exec('BEGIN');
    try {
      db.prepare("DELETE FROM meta WHERE key = 'summary_version'").run();
      migrateEmployerSummary(db);
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
    const batch = db.prepare('SELECT rowid, raw FROM ads WHERE rowid > ? ORDER BY rowid LIMIT 500');
    const update = db.prepare('UPDATE ads SET employer_id = ? WHERE rowid = ? AND employer_id IS NOT ?');
    const total = db.prepare('SELECT MAX(rowid) n FROM ads').get().n || 1;
    let last = 0;
    for (;;) {
      const rows = batch.all(last);
      if (!rows.length) break;
      db.exec('BEGIN');
      try {
        for (const row of rows) {
          const id = employerId(JSON.parse(row.raw).employer?.organization_number);
          update.run(id, row.rowid, id);
        }
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
      last = rows.at(-1).rowid;
      onProgress({ pct: 88 * last / total, text: `Consolidating employers (one-time): ${Math.round(100 * last / total)}%…` });
    }
    db.prepare("INSERT OR REPLACE INTO meta(key, value) VALUES ('employer_identity_version', '1')").run();
  }
  if (!db.prepare("SELECT 1 FROM sqlite_schema WHERE type = 'index' AND name = 'ix_employer_id'").get()) {
    onProgress({ pct: 1, text: 'Indexing employer identities (one-time)…' });
    db.exec('CREATE INDEX IF NOT EXISTS ix_employer_id ON ads(employer_id, pub_date);');
  }
  if (!db.prepare("SELECT 1 FROM sqlite_schema WHERE type = 'index' AND name = 'ix_employer'").get()) {
    onProgress({ pct: 1, text: 'Indexing employers (one-time)…' });
    db.exec('CREATE INDEX IF NOT EXISTS ix_employer ON ads(employer COLLATE BINARY, pub_date);');
  }
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
    db.exec('DELETE FROM employer_catalog');
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

function reprocess(db, onProgress = () => {}) {
  const total = db.prepare('SELECT COUNT(*) n FROM ads').get().n;
  const batch = db.prepare('SELECT rowid, raw, source FROM ads WHERE rowid > ? ORDER BY rowid LIMIT 500');
  const columns = ['headline', 'pub_date', 'year', 'deadline', 'employer', 'region', 'muni', 'field_id', 'field', 'group_id', 'grp', 'occ_id', 'occ', 'emp_type', 'hours', 'employer_id', 'legacy_occ_id', 'legacy_muni_code'];
  const update = db.prepare(`UPDATE ads SET ${columns.map(name => `${name} = ?`).join(', ')} WHERE rowid = ?`);
  const insertFts = db.prepare('INSERT INTO ads_fts(rowid, headline, employer, body) VALUES (?, ?, ?, ?)');
  const acc = newAcc();
  const sources = new Map();
  const affected = { occupations: new Set(), locations: new Set() };
  let last = 0;
  let processed = 0;
  onProgress({ pct: 0, text: 'Reprocessing dataset: preparing…' });
  db.exec('BEGIN IMMEDIATE');
  try {
    migrateEmployerSummary(db);
    db.prepare("DELETE FROM meta WHERE key = 'summary_version'").run();
    db.exec('DELETE FROM legacy_occ_map; DELETE FROM legacy_loc_map;');
    db.exec("INSERT INTO ads_fts(ads_fts) VALUES ('delete-all')");
    for (;;) {
      const rows = batch.all(last);
      if (!rows.length) break;
      for (const row of rows) {
        const ad = JSON.parse(row.raw);
        const mapped = toRow(ad, row.source);
        update.run(...mapped.values.slice(1, 16), mapped.values[18], mapped.values[19], mapped.values[20], row.rowid);
        insertFts.run(row.rowid, ...mapped.fts);
        const references = legacyReferences(ad);
        adjustLegacyReferences(db, references);
        for (const reference of references.occupations) affected.occupations.add(reference.id);
        for (const reference of references.locations) affected.locations.add(reference.code);
        sources.set(row.source, (sources.get(row.source) || 0) + 1);
      }
      last = rows[rows.length - 1].rowid;
      processed += rows.length;
      onProgress({ pct: 75 * processed / Math.max(1, total), text: `Reprocessing dataset: ${processed.toLocaleString('en-US')} of ${total.toLocaleString('en-US')} ads` });
    }
    reconcileLegacyMappings(db, {
      occupations: [...affected.occupations],
      locations: [...affected.locations],
    });
    for (const map of Object.values(acc)) map.clear();
    for (const row of scanRows(db, SCAN_SQL)) accAdd(acc, row);
    onProgress({ pct: 80, text: 'Reprocessing dataset: rebuilding statistics…' });
    for (const table of Object.values(SUM_TABLE)) db.exec(`DELETE FROM ${table}`);
    db.exec('DELETE FROM employer_catalog');
    accFlush(db, acc);
    db.exec('UPDATE sources SET ads = 0');
    const updateSource = db.prepare('UPDATE sources SET ads = ? WHERE name = ?');
    for (const [source, count] of sources) updateSource.run(count, source);
    onProgress({ pct: 85, text: 'Reprocessing dataset: rebuilding indexes…' });
    db.exec('CREATE INDEX IF NOT EXISTS ix_employer ON ads(employer COLLATE BINARY, pub_date); CREATE INDEX IF NOT EXISTS ix_employer_id ON ads(employer_id, pub_date); CREATE INDEX IF NOT EXISTS ix_emp ON ads(emp_type); CREATE INDEX IF NOT EXISTS ix_hours ON ads(hours); REINDEX;');
    onProgress({ pct: 95, text: 'Reprocessing dataset: updating query planner statistics…' });
    db.exec('ANALYZE');
    db.exec("INSERT OR REPLACE INTO meta(key, value) VALUES ('summary_version', '2'), ('array_tags_version', '1'), ('employer_identity_version', '1'), ('legacy_enrichment_version', '1'); COMMIT;");
  } catch (error) {
    db.exec('ROLLBACK');
    stmtCache.delete(db);
    throw error;
  }
  onProgress({ pct: 100, text: 'Dataset reprocessing complete', ready: true });
  return { built: true, processed };
}

const employerFacet = (row) => row.id ? { id: row.id, v: row.v, n: row.n } : { v: row.v, n: row.n };

function summaryFacets(db) {
  return {
    occ: db.prepare('SELECT field_id fi, field f, group_id gi, grp g, occ_id oi, occ o, n FROM sum_occ').all()
      .map((r) => ({ fi: nul(r.fi), f: r.f, gi: nul(r.gi), g: r.g, oi: nul(r.oi), o: r.o, n: r.n })),
    loc: db.prepare('SELECT region r, muni m, n FROM sum_loc').all().map((r) => ({ r: nul(r.r), m: nul(r.m), n: r.n })),
    year: db.prepare('SELECT year y, n FROM sum_year ORDER BY year DESC').all().map((r) => ({ y: r.y, n: r.n })),
    emp: db.prepare('SELECT v, n FROM sum_emp ORDER BY n DESC').all().map((r) => ({ v: nul(r.v), n: r.n })),
    hours: db.prepare('SELECT v, n FROM sum_hours ORDER BY n DESC').all().map((r) => ({ v: nul(r.v), n: r.n })),
    employers: db.prepare('SELECT org_id id, v, n FROM employer_catalog ORDER BY n DESC, v COLLATE NOCASE, v COLLATE BINARY, org_id LIMIT 30').all()
      .map(employerFacet),
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
      employers = db.prepare(`SELECT matched.id, catalog.v, matched.n FROM (
        SELECT COALESCE(a.employer_id, '') id, CASE WHEN a.employer_id IS NULL THEN a.employer ELSE '' END name_key, COUNT(*) n FROM ads a
        WHERE ${employerFilter.sql} AND a.employer IS NOT NULL AND a.employer <> ''
        GROUP BY a.employer_id, name_key
      ) matched JOIN employer_catalog catalog ON catalog.org_id = matched.id AND catalog.name_key = matched.name_key
        ORDER BY matched.n DESC, catalog.v COLLATE NOCASE, catalog.v COLLATE BINARY, matched.id LIMIT 30`).all(...employerFilter.params)
        .map(employerFacet);
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

function getAd(db, id, includeSource = false) {
  const row = db.prepare('SELECT raw, field_id, field, group_id, grp, occ_id, occ, region, muni FROM ads WHERE ad_id = ?').get(String(id));
  if (!row) return null;
  const ad = JSON.parse(row.raw);
  const enrichment = {};
  for (const [key, idColumn, labelColumn] of [
    ['occupation_field', 'field_id', 'field'],
    ['occupation_group', 'group_id', 'grp'],
    ['occupation', 'occ_id', 'occ'],
  ]) {
    const tag = one(ad[key]);
    const additions = {};
    if (!tag?.concept_id && row[idColumn] && row[idColumn] !== cid(tag)) additions.concept_id = row[idColumn];
    if (!tag?.label && row[labelColumn]) additions.label = row[labelColumn];
    if (!Object.keys(additions).length) continue;
    enrichment[key] = Array.isArray(ad[key])
      ? Array.from({ length: tag ? ad[key].indexOf(tag) + 1 : ad[key].length + 1 }, (_, index) =>
        index === (tag ? ad[key].indexOf(tag) : ad[key].length) ? additions : null)
      : additions;
    if (tag) Object.assign(tag, additions);
    else if (Array.isArray(ad[key])) ad[key].push(additions);
    else ad[key] = additions;
  }
  for (const [key, column] of [['municipality', 'muni'], ['region', 'region']]) {
    if (!ad.workplace_address?.[key] && row[column]) {
      ad.workplace_address ||= {};
      ad.workplace_address[key] = row[column];
      enrichment.workplace_address ||= {};
      enrichment.workplace_address[key] = row[column];
    }
  }
  return includeSource ? { ad, source: JSON.parse(row.raw), enrichment } : ad;
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
    const affected = { occupations: new Set(), locations: new Set() };
    if (built) {
      const acc = newAcc();
      for (const row of scanRows(db, `${SCAN_SQL} WHERE source = ?`, name)) accAdd(acc, row);
      accFlush(db, acc, -1);
    }
    const references = db.prepare('SELECT raw FROM ads WHERE source = ?');
    for (const row of references.iterate(name)) {
      const refs = legacyReferences(JSON.parse(row.raw));
      adjustLegacyReferences(db, refs, -1);
      for (const reference of refs.occupations) affected.occupations.add(reference.id);
      for (const reference of refs.locations) affected.locations.add(reference.code);
    }
    db.prepare('DELETE FROM ads_fts WHERE rowid IN (SELECT rowid FROM ads WHERE source = ?)').run(name);
    db.prepare('DELETE FROM ads WHERE source = ?').run(name);
    db.prepare('DELETE FROM sources WHERE name = ?').run(name);
    reconcileLegacyMappings(db, {
      occupations: [...affected.occupations],
      locations: [...affected.locations],
    });
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

module.exports = {
  reprocess,
  open, toRow, projectionValues, INSERT_SQL, legacyReferences, adjustLegacyReferences, reconcileLegacyMappings,
  search, count, facets, timeline, getAd, info, datasetStats, removeSource,
  isBuilt, ensureSummary, newAcc, accAdd, accFlush,
};
