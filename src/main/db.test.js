'use strict';
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const dbm = require('./db');

test('organization identities consolidate employer variants across all queries and summary updates', () => {
  const db = dbm.open(':memory:');
  try {
    dbm.ensureSummary(db);
    const acc = dbm.newAcc();
    const employers = [
      { name: 'Kils Kommun', organization_number: '2120001751' },
      { name: 'KILS KOMMUN', organization_number: 2120001751 },
      { name: 'Kils Kommun', organization_number: 'other-id' },
      { name: 'Kils Kommun' }, { name: 'KILS KOMMUN', organization_number: ' ' },
      { name: 'Other employer', organization_number: 'other-id' },
    ];
    employers.forEach((employer, index) => {
      const row = dbm.toRow({
        id: String(index), headline: 'Engineer', employer,
        publication_date: index === 1 ? '2026-02-02' : '2026-01-01',
        workplace_address: { region: index === 1 ? 'South' : 'North' },
        employment_type: { label: 'Permanent' }, working_hours_type: { label: 'Full time' },
      }, index === 1 ? 'upper' : 'mixed');
      const inserted = db.prepare(dbm.INSERT_SQL).run(...row.values);
      db.prepare('INSERT INTO ads_fts(rowid,headline,employer,body) VALUES (?,?,?,?)').run(inserted.lastInsertRowid, ...row.fts);
      dbm.accAdd(acc, row.values);
    });
    dbm.accFlush(db, acc);
    const selection = { id: '2120001751', label: 'KILS KOMMUN' };
    const filter = { employers: [selection] };
    const ids = filters => dbm.search(db, filters, 0, 60, true).rows.map(row => row.ad_id).sort();
    assert.deepEqual(ids(filter), ['0', '1']);
    assert.equal(dbm.count(db, filter), 2);
    assert.equal(dbm.timeline(db, filter).points.reduce((sum, row) => sum + row.n, 0), 2);
    assert.deepEqual(dbm.facets(db, filter).employers, [{ id: '2120001751', v: 'KILS KOMMUN', n: 2 }]);
    assert.deepEqual(dbm.facets(db, {}).employers, dbm.facets(db, { emp: 'Permanent' }).employers);
    assert.equal(dbm.facets(db, {}).employers.length, 4);
    assert.deepEqual(ids({ employers: [selection, { id: 'other-id', label: 'Other' }] }), ['0', '1', '2', '5']);
    assert.deepEqual(ids({ employers: [{ id: null, label: 'Kils Kommun' }] }), ['3']);
    assert.deepEqual(ids({ employers: [{ id: null, label: 'KILS KOMMUN' }] }), ['4']);
    assert.deepEqual(ids({ employers: ["Kils Kommun"] }), ['0', '2', '3']);
    assert.deepEqual(ids({ employers: [{ id: "' OR 1=1 --", label: 'Unsafe' }] }), []);
    const combined = { ...filter, terms: ['Engineer'], emp: 'Permanent', hours: 'Full time', loc: [{ k: 'region', id: 'North' }], from: '2026-01-01', to: '2026-01-31' };
    assert.deepEqual(ids({ ...combined, sort: 'relevance' }), ['0']);
    assert.equal(dbm.count(db, combined), 1);
    assert.equal(dbm.facets(db, combined).employers[0].n, 1);
    assert.equal(dbm.timeline(db, combined).points.reduce((sum, row) => sum + row.n, 0), 1);
    const plan = db.prepare('EXPLAIN QUERY PLAN SELECT pub_date FROM ads a WHERE a.employer_id IN (?)').all(selection.id);
    assert.ok(plan.some(row => /COVERING INDEX ix_employer_id/.test(row.detail)), JSON.stringify(plan));
    dbm.removeSource(db, 'upper');
    assert.deepEqual(dbm.facets(db, filter).employers, [{ id: '2120001751', v: 'Kils Kommun', n: 1 }]);
    const snapshot = dbm.facets(db, {}).employers;
    db.exec("DELETE FROM meta WHERE key = 'summary_version'");
    dbm.ensureSummary(db);
    assert.deepEqual(dbm.facets(db, {}).employers, snapshot);
    dbm.reprocess(db);
    assert.deepEqual(dbm.facets(db, {}).employers, snapshot);
  } finally {
    db.close();
  }
});

test('employer names and totals are precomputed, never rebuilt by filtering', () => {
  const db = dbm.open(':memory:');
  try {
    for (const [id, name, region] of [['one', 'KILS KOMMUN', 'North'], ['two', 'Kils Kommun', 'South']]) {
      db.prepare(dbm.INSERT_SQL).run(...dbm.toRow({ id, employer: { name, organization_number: '2120001751' }, workplace_address: { region } }, 'test').values);
    }
    dbm.ensureSummary(db);
    const before = db.prepare('SELECT * FROM employer_catalog').all();
    assert.deepEqual(before.map(row => ({ ...row })), [{ org_id: '2120001751', name_key: '', v: 'KILS KOMMUN', n: 2 }]);
    const writes = db.prepare('SELECT total_changes() n').get().n;
    const prepare = db.prepare.bind(db);
    const queries = [];
    db.prepare = sql => { queries.push(sql); return prepare(sql); };
    assert.deepEqual(dbm.facets(db, {}).employers, [{ id: '2120001751', v: 'KILS KOMMUN', n: 2 }]);
    const filter = { loc: [{ k: 'region', id: 'South' }] };
    assert.deepEqual(dbm.facets(db, filter).employers, [{ id: '2120001751', v: 'KILS KOMMUN', n: 1 }]);
    assert.deepEqual(dbm.facets(db, filter).employers, [{ id: '2120001751', v: 'KILS KOMMUN', n: 1 }]);
    assert.ok(queries.some(sql => sql.includes('JOIN employer_catalog')));
    assert.ok(queries.every(sql => !/json_extract|json_type|MIN\(.*employer|MIN\(v|INSERT|UPDATE|DELETE/i.test(sql)), queries.join('\n'));
    assert.equal(db.prepare('SELECT total_changes() n').get().n, writes);
    assert.deepEqual(db.prepare('SELECT * FROM employer_catalog').all(), before);
    const plan = db.prepare('EXPLAIN QUERY PLAN SELECT org_id, v, n FROM employer_catalog ORDER BY n DESC, v COLLATE NOCASE, v COLLATE BINARY, org_id LIMIT 30').all();
    assert.ok(plan.some(row => row.detail.includes('ix_employer_rank')), JSON.stringify(plan));
  } finally {
    db.close();
  }
});

test('legacy employer migration backfills IDs without changing raw ads and resumes failed batches', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'ams-employer-migration-'));
  const file = path.join(directory, 'ads.db');
  let db = dbm.open(file);
  try {
    for (let index = 0; index < 501; index++) {
      db.prepare(dbm.INSERT_SQL).run(...dbm.toRow({ id: String(index), employer: { name: index % 2 ? 'KILS KOMMUN' : 'Kils Kommun', organization_number: '2120001751' } }, 'test').values);
    }
    const before = db.prepare('SELECT rowid, ad_id, employer, raw, source FROM ads').all();
    db.exec(`ALTER TABLE ads DROP COLUMN employer_id;
      DROP TABLE sum_employer; CREATE TABLE sum_employer(v TEXT PRIMARY KEY, n INTEGER NOT NULL);
      INSERT INTO meta(key, value) VALUES ('summary_version', '2'), ('array_tags_version', '1');`);
    db.close();
    db = dbm.open(file);
    const prepare = db.prepare.bind(db);
    let updates = 0;
    db.prepare = sql => {
      const statement = prepare(sql);
      return sql.startsWith('UPDATE ads SET employer_id') ? {
        run: (...params) => {
          if (++updates === 501) throw new Error('Interrupted identity backfill');
          return statement.run(...params);
        },
      } : statement;
    };
    assert.throws(() => dbm.ensureSummary(db), /Interrupted identity backfill/);
    db.prepare = prepare;
    assert.equal(dbm.isBuilt(db), false);
    assert.equal(db.prepare('SELECT COUNT(*) n FROM ads WHERE employer_id IS NULL').get().n, 1);
    assert.equal(db.prepare("SELECT value FROM meta WHERE key = 'employer_identity_version'").get(), undefined);
    const events = [];
    dbm.ensureSummary(db, event => events.push(event));
    assert.ok(events.some(event => /Consolidating employers/.test(event.text)));
    assert.deepEqual(db.prepare('SELECT rowid, ad_id, employer, raw, source FROM ads').all(), before);
    assert.deepEqual(dbm.facets(db, {}).employers, [{ id: '2120001751', v: 'KILS KOMMUN', n: 501 }]);
    dbm.ensureSummary(db, () => assert.fail('Migration must not repeat'));
  } finally {
    db.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test('manual reprocessing restores all projections, FTS, summaries, source counts and indexes', () => {
  const db = dbm.open(':memory:');
  try {
    const ad = {
      id: 'source-id', headline: 'Engineer', publication_date: '2026-06-23',
      employer: { name: 'Acme' }, description: { text: 'Robotics specialist' },
      workplace_address: { region: 'North', municipality: 'Town' },
      occupation_field: [{ concept_id: 'field', label: 'Technology' }],
      occupation_group: [{ concept_id: 'group', label: 'Engineering' }],
      occupation: [{ concept_id: 'occupation', label: 'Engineer' }],
      employment_type: [{ label: 'Permanent' }], working_hours_type: [{ label: 'Full time' }],
    };
    db.prepare(dbm.INSERT_SQL).run(...dbm.toRow(ad, 'test.jsonl').values);
    db.prepare("INSERT INTO sources VALUES ('test.jsonl', '/missing/test.jsonl', 77, '2026-01-01')").run();
    db.prepare("INSERT INTO sources VALUES ('empty.jsonl', '/missing/empty.jsonl', 9, '2026-01-02')").run();
    dbm.ensureSummary(db);
    db.exec(`UPDATE ads SET ad_id = 'preserved-id', headline = 'Stale', year = 2000, employer = 'Stale',
      field = 'Stale', occ_id = NULL, emp_type = NULL, hours = NULL;
      UPDATE sum_day SET n = 99; DROP INDEX ix_employer;`);
    const before = db.prepare('SELECT rowid, ad_id, raw, source FROM ads').get();
    const events = [];
    assert.deepEqual(dbm.reprocess(db, event => events.push(event)), { built: true, processed: 1 });
    assert.deepEqual(db.prepare('SELECT rowid, ad_id, raw, source FROM ads').get(), before);
    const results = dbm.search(db, { q: 'Robotics', employers: ['Acme'], emp: 'Permanent', hours: 'Full time' }, 0, 60, true);
    assert.equal(results.total, 1);
    assert.equal(results.rows[0].headline, 'Engineer');
    assert.equal(results.rows[0].field, 'Technology');
    assert.equal(results.rows[0].grp, 'Engineering');
    assert.equal(results.rows[0].occ, 'Engineer');
    assert.equal(dbm.count(db, { from: '2026-01-01', to: '2026-12-31' }), 1);
    const facets = dbm.facets(db, {});
    assert.deepEqual(facets.employers, [{ v: 'Acme', n: 1 }]);
    assert.deepEqual(facets.year, [{ y: 2026, n: 1 }]);
    assert.deepEqual(facets.loc, [{ r: 'North', m: 'Town', n: 1 }]);
    assert.equal(facets.occ[0].oi, 'occupation');
    assert.equal(dbm.datasetStats(db).total, 1);
    assert.deepEqual({ ...db.prepare("SELECT * FROM sources WHERE name = 'test.jsonl'").get() }, {
      name: 'test.jsonl', path: '/missing/test.jsonl', ads: 1, imported_at: '2026-01-01',
    });
    assert.equal(db.prepare("SELECT ads FROM sources WHERE name = 'empty.jsonl'").get().ads, 0);
    assert.equal(db.prepare("SELECT COUNT(*) n FROM sqlite_stat1 WHERE idx = 'ix_employer'").get().n, 1);
    assert.equal(events[0].pct, 0);
    assert.equal(events.at(-1).pct, 100);
    assert.ok(events.every((event, index) => !index || event.pct >= events[index - 1].pct));
    dbm.reprocess(db);
    assert.equal(dbm.count(db, { q: 'Robotics' }), 1);
    assert.equal(dbm.facets(db, {}).employers[0].n, 1);
  } finally {
    db.close();
  }
});

test('manual reprocessing rolls back partial work and handles empty datasets', () => {
  const db = dbm.open(':memory:');
  try {
    assert.deepEqual(dbm.reprocess(db), { built: true, processed: 0 });
    const row = dbm.toRow({ id: 'one', headline: 'Original', publication_date: '2026-01-01' }, 'test');
    db.prepare(dbm.INSERT_SQL).run(...row.values);
    db.prepare('INSERT INTO ads_fts(rowid, headline, employer, body) VALUES (1, ?, ?, ?)').run(...row.fts);
    dbm.ensureSummary(db);
    db.exec("UPDATE ads SET headline = 'Old projection'");
    const summaries = dbm.facets(db, {});
    assert.throws(() => dbm.reprocess(db, event => {
      if (event.pct === 95) throw new Error('Interrupted rebuild');
    }), /Interrupted rebuild/);
    assert.equal(db.prepare('SELECT headline FROM ads').get().headline, 'Old projection');
    assert.equal(dbm.count(db, { q: 'Original' }), 1);
    assert.deepEqual(dbm.facets(db, {}), summaries);
    assert.equal(dbm.isBuilt(db), true);
    dbm.reprocess(db);
    assert.equal(db.prepare('SELECT headline FROM ads').get().headline, 'Original');
  } finally {
    db.close();
  }
});

test('summary startup repairs stale array-valued tags and rebuilds affected counts once', () => {
  const db = dbm.open(':memory:');
  try {
    const ad = {
      id: 'stale-array-tags', publication_date: '2026-06-23', employer: { name: 'Getdet AB' },
      occupation_field: [{ concept_id: 'field', label: 'Sales' }],
      occupation_group: [{ concept_id: 'group', label: 'Retail' }],
      occupation: [{ concept_id: 'occupation', label: 'Salesperson' }],
      employment_type: [{ label: 'Permanent' }], working_hours_type: { label: 'Full time' },
    };
    db.prepare(dbm.INSERT_SQL).run(...dbm.toRow(ad, '2026-Q2.jsonl').values);
    dbm.ensureSummary(db);
    db.exec(`UPDATE ads SET field_id = NULL, field = NULL, group_id = NULL, grp = NULL,
      occ_id = NULL, occ = NULL, emp_type = NULL;
      DELETE FROM meta WHERE key = 'array_tags_version';`);
    const progress = [];
    dbm.ensureSummary(db, event => progress.push(event));
    const filter = { employers: ['Getdet AB'], from: '2026-01-01', to: '2026-12-31' };
    const row = dbm.search(db, filter, 0, 60).rows[0];
    assert.equal(row.field, 'Sales');
    assert.equal(row.grp, 'Retail');
    assert.equal(row.occ, 'Salesperson');
    assert.equal(row.emp_type, 'Permanent');
    assert.equal(dbm.count(db, { ...filter, sel: [{ k: 'occ', id: 'occupation' }] }), 1);
    assert.deepEqual(dbm.facets(db, {}).emp, [{ v: 'Permanent', n: 1 }]);
    assert.equal(dbm.facets(db, {}).occ[0].oi, 'occupation');
    assert.ok(progress.length);
    assert.equal(db.prepare("SELECT value FROM meta WHERE key = 'array_tags_version'").get().value, '1');
    dbm.ensureSummary(db, () => assert.fail('Repair must not repeat'));
    assert.deepEqual(dbm.getAd(db, ad.id), ad);
  } finally {
    db.close();
  }
});

test('array tag repair preserves existing values and resumes after a failed batch', () => {
  const db = dbm.open(':memory:');
  try {
    for (let index = 0; index < 501; index++) {
      const row = dbm.toRow({
        id: String(index), publication_date: '2026-06-23',
        occupation_field: [{ concept_id: 'field', label: 'Source field' }],
        occupation: [{ concept_id: 'occupation', label: 'Salesperson' }],
        working_hours_type: [{ label: 'Full time' }], employment_type: [],
      }, 'test');
      db.prepare(dbm.INSERT_SQL).run(...row.values);
    }
    dbm.ensureSummary(db);
    db.exec(`UPDATE ads SET field = 'Existing field', occ = NULL, hours = NULL;
      DELETE FROM meta WHERE key = 'array_tags_version';`);
    const prepare = db.prepare.bind(db);
    let updates = 0;
    db.prepare = sql => {
      const statement = prepare(sql);
      return sql.startsWith('UPDATE ads SET field_id') ? {
        run: (...params) => {
          if (++updates === 501) throw new Error('Interrupted repair');
          return statement.run(...params);
        },
      } : statement;
    };
    assert.throws(() => dbm.ensureSummary(db), /Interrupted repair/);
    db.prepare = prepare;
    assert.equal(dbm.isBuilt(db), false);
    assert.equal(db.prepare("SELECT value FROM meta WHERE key = 'array_tags_version'").get(), undefined);
    assert.equal(db.prepare('SELECT COUNT(*) n FROM ads WHERE occ IS NULL').get().n, 1);
    dbm.ensureSummary(db);
    assert.equal(db.prepare("SELECT COUNT(*) n FROM ads WHERE field = 'Existing field' AND occ = 'Salesperson' AND hours = 'Full time' AND emp_type IS NULL").get().n, 501);
    assert.deepEqual(dbm.facets(db, {}).hours, [{ v: 'Full time', n: 501 }]);
    assert.equal(dbm.facets(db, {}).occ[0].n, 501);
  } finally {
    db.close();
  }
});

test('employer selections use an index for counts, timeline and facet reads', () => {
  const db = dbm.open(':memory:');
  try {
    dbm.ensureSummary(db);
    for (const projection of ['COUNT(*)', 'pub_date', 'field_id, group_id, occ_id, region, muni, year, emp_type, hours']) {
      const plan = db.prepare(`EXPLAIN QUERY PLAN SELECT ${projection} FROM ads a WHERE a.employer COLLATE BINARY IN (?, ?)`).all('Acme', 'Other');
      assert.ok(plan.some(row => /SEARCH a USING (?:COVERING )?INDEX ix_employer/.test(row.detail)), JSON.stringify(plan));
      if (projection !== 'field_id, group_id, occ_id, region, muni, year, emp_type, hours') {
        assert.ok(plan.some(row => row.detail.includes('COVERING INDEX ix_employer')), JSON.stringify(plan));
      }
    }
  } finally {
    db.close();
  }
});

test('existing summaries gain the employer index without rebuilding and skip it on repeat', () => {
  const db = dbm.open(':memory:');
  try {
    dbm.ensureSummary(db);
    db.exec('DROP INDEX ix_employer');
    const progress = [];
    assert.deepEqual(dbm.ensureSummary(db, event => progress.push(event)), { built: true, fresh: false });
    assert.equal(progress.length, 1);
    assert.match(progress[0].text, /Indexing employers/);
    assert.deepEqual(db.prepare('PRAGMA index_info(ix_employer)').all().map(row => row.name), ['employer', 'pub_date']);
    dbm.ensureSummary(db, () => assert.fail('Index must not rebuild'));
  } finally {
    db.close();
  }
});

test('employer selections match exact names and combine with all filtered queries', () => {
  const db = dbm.open(':memory:');
  try {
    const names = ['Acme', 'acme', 'Acme ', 'Acme subsidiary', 'Other', "O'Reilly & Sons"];
    names.forEach((name, index) => {
      const row = dbm.toRow({
        id: String(index), headline: index === 4 ? 'Different' : 'Engineer',
        publication_date: '2026-01-02', employer: { name },
        workplace_address: { region: index === 1 ? 'South' : 'North' },
        employment_type: { label: 'Permanent' }, working_hours_type: { label: 'Full time' },
      }, 'test');
      const inserted = db.prepare(dbm.INSERT_SQL).run(...row.values);
      db.prepare('INSERT INTO ads_fts(rowid,headline,employer,body) VALUES (?,?,?,?)').run(inserted.lastInsertRowid, ...row.fts);
    });
    dbm.ensureSummary(db);
    const ids = filter => dbm.search(db, filter, 0, 60, true).rows.map(row => row.ad_id).sort();
    assert.deepEqual(ids({ employers: ['Acme'] }), ['0']);
    assert.deepEqual(ids({ employers: ['acme', 'Acme '] }), ['1', '2']);
    assert.deepEqual(ids({ employers: ["O'Reilly & Sons"] }), ['5']);
    assert.deepEqual(ids({ employers: ["' OR 1=1 --"] }), []);
    assert.equal(dbm.count(db, { employers: [] }), 6);
    const filter = { employers: ['Acme', 'acme', 'Other'], terms: ['Engineer'], loc: [{ k: 'region', id: 'North' }], emp: 'Permanent', hours: 'Full time', from: '2026-01-01', to: '2026-12-31' };
    assert.deepEqual(ids(filter), ['0']);
    assert.deepEqual(ids({ ...filter, sort: 'relevance' }), ['0']);
    assert.equal(dbm.count(db, filter), 1);
    assert.equal(dbm.timeline(db, filter).points.reduce((sum, point) => sum + point.n, 0), 1);
    assert.deepEqual(dbm.facets(db, filter).employers, [{ v: 'Acme', n: 1 }]);
    assert.equal(dbm.facets(db, filter).loc.reduce((sum, row) => sum + row.n, 0), 2);
    assert.deepEqual(ids({ ...filter, from: '2027-01-01' }), []);
  } finally {
    db.close();
  }
});

test('dataset chooser statistics read only imported-source metadata', () => {
  const db = dbm.open(':memory:');
  try {
    db.prepare('INSERT INTO sources(name, ads) VALUES (?, ?), (?, ?)').run('one.jsonl', 7, 'two.jsonl', 5);
    assert.deepEqual(dbm.datasetStats(db), { total: 12, sourceCount: 2 });
  } finally {
    db.close();
  }
});

test('chronological filtering preserves ordering, offsets and sparse fallback', () => {
  const db = dbm.open(':memory:');
  try {
    const insert = db.prepare(dbm.INSERT_SQL);
    db.exec('BEGIN');
    for (let index = 0; index < 8300; index++) {
      const row = dbm.toRow({
        id: String(index), publication_date: index < 2 ? null : index < 4150 ? '2025-01-02' : '2026-01-02',
        workplace_address: { region: index % 2 ? 'North' : 'South' },
        employment_type: { label: index === 4200 ? 'Rare' : 'Common' },
      }, 'test');
      insert.run(...row.values);
    }
    db.exec('COMMIT');
    for (const sort of ['newest', 'oldest']) {
      const direction = sort === 'oldest' ? 'ASC' : 'DESC';
      for (const offset of [0, 60, 4090, 4200, 8190]) {
        const expected = db.prepare(`SELECT ad_id FROM ads WHERE region = ? ORDER BY pub_date ${direction}, rowid ${direction} LIMIT 60 OFFSET ?`).all('North', offset);
        const actual = dbm.search(db, { sort, loc: [{ k: 'region', id: 'North' }] }, offset, 60).rows;
        assert.deepEqual(actual.map(row => row.ad_id), expected.map(row => row.ad_id));
      }
      assert.equal(dbm.search(db, { sort, emp: 'Rare' }, 0, 60).rows[0].ad_id, '4200');
      assert.equal(dbm.search(db, { sort, emp: 'Absent' }, 0, 60).rows.length, 0);
      const dated = dbm.search(db, { sort, from: '2025-01-01', to: '2025-12-31', loc: [{ k: 'region', id: 'North' }] }, 0, 60).rows;
      assert.equal(dated.length, 60);
      assert.ok(dated.every(row => row.pub_date === '2025-01-02'));
    }
  } finally {
    db.close();
  }
});

test('facet cache reuses dimension counts and invalidates after local writes', () => {
  const db = dbm.open(':memory:');
  try {
    const row = dbm.toRow({ id: '1', publication_date: '2026-01-02', employer: { name: 'Cached Employer' }, employment_type: { label: 'E' } }, 'test');
    db.prepare(dbm.INSERT_SQL).run(...row.values);
    dbm.ensureSummary(db);
    const prepare = db.prepare.bind(db);
    let scans = 0;
    db.prepare = sql => {
      if (sql.includes('FROM (SELECT')) scans++;
      return prepare(sql);
    };
    const filter = { emp: 'E' };
    const first = dbm.facets(db, filter);
    assert.equal(scans, 1);
    assert.deepEqual(dbm.facets(db, {}).employers, [{ v: 'Cached Employer', n: 1 }]);
    assert.deepEqual(dbm.facets(db, filter), first);
    assert.equal(scans, 1);
    dbm.facets(db, { ...filter, hours: 'H' });
    assert.equal(scans, 3);
    assert.deepEqual(dbm.facets(db, filter), first);
    assert.equal(scans, 3);
    db.prepare("UPDATE ads SET emp_type = 'X'").run();
    assert.equal(dbm.facets(db, filter).year.reduce((sum, row) => sum + row.n, 0), 0);
    assert.equal(scans, 4);
  } finally {
    db.close();
  }
});

test('facet cache invalidates after another connection imports or removes a source', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'ams-facet-cache-'));
  const db = dbm.open(path.join(directory, 'ads.db'));
  const writer = dbm.open(path.join(directory, 'ads.db'));
  try {
    dbm.ensureSummary(writer);
    const filter = { emp: 'E' };
    assert.deepEqual(dbm.facets(db, filter).year, []);
    const row = dbm.toRow({ id: '1', publication_date: '2026-01-02', employer: { name: 'Cached Employer' }, employment_type: { label: 'E' } }, 'new-source');
    writer.exec('BEGIN');
    const inserted = writer.prepare(dbm.INSERT_SQL).run(...row.values);
    writer.prepare('INSERT INTO ads_fts(rowid,headline,employer,body) VALUES (?,?,?,?)').run(inserted.lastInsertRowid, ...row.fts);
    const acc = dbm.newAcc();
    dbm.accAdd(acc, row.values);
    dbm.accFlush(writer, acc);
    writer.exec('COMMIT');
    assert.deepEqual(dbm.facets(db, filter).year, [{ y: 2026, n: 1 }]);
    assert.deepEqual(dbm.facets(db, {}).employers, [{ v: 'Cached Employer', n: 1 }]);
    dbm.removeSource(writer, 'new-source');
    assert.equal(dbm.facets(db, filter).year.reduce((sum, row) => sum + row.n, 0), 0);
    assert.deepEqual(dbm.facets(db, {}).employers, []);
  } finally {
    writer.close();
    db.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test('facet cache evicts old groupings and never caches failed queries', () => {
  const db = dbm.open(':memory:');
  try {
    dbm.ensureSummary(db);
    const prepare = db.prepare.bind(db);
    let scans = 0;
    let fail = false;
    db.prepare = sql => {
      if (sql.includes('FROM (SELECT')) {
        scans++;
        if (fail) throw new Error('Test query failure');
      }
      return prepare(sql);
    };
    for (let index = 0; index < 9; index++) dbm.facets(db, { emp: String(index) });
    assert.equal(scans, 9);
    dbm.facets(db, { emp: '0' });
    assert.equal(scans, 10);
    fail = true;
    assert.throws(() => dbm.facets(db, { emp: 'failed' }), /Test query failure/);
    fail = false;
    dbm.facets(db, { emp: 'failed' });
    assert.equal(scans, 12);
  } finally {
    db.close();
  }
});

test('filtered facets preserve counts across missing-value representations', () => {
  const db = dbm.open(':memory:');
  try {
    const insert = db.prepare(dbm.INSERT_SQL);
    for (const [index, missing] of [null, ''].entries()) {
      const row = dbm.toRow({
        id: String(index), publication_date: '2026-10-16',
        workplace_address: { municipality: 'Test municipality' },
        employment_type: { label: 'Test employment' },
      }, 'test');
      row.values[6] = missing;
      row.values[8] = missing;
      insert.run(...row.values);
    }
    dbm.ensureSummary(db);
    const facets = dbm.facets(db, { emp: 'Test employment' });
    assert.equal(facets.loc.length, 1);
    assert.equal(facets.loc[0].n, 2);
    assert.equal(facets.occ.length, 1);
    assert.equal(facets.occ[0].n, 2);
  } finally {
    db.close();
  }
});

test('facet counts follow other filters and exclude only their own dimension', () => {
  const db = dbm.open(':memory:');
  try {
    const fixtures = [
      ['1', 'alpha', '2026-01-02', 'North', 'Town A', 'f1', 'E', 'H'],
      ['2', 'beta', '2025-01-02', 'South', 'Town B', 'f1', 'E', 'J'],
      ['3', 'alpha', '2026-01-02', 'North', 'Town A', 'f2', 'X', 'H'],
    ];
    for (const [id, headline, date, region, municipality, field, emp, hours] of fixtures) {
      const row = dbm.toRow({
        id, headline, publication_date: date,
        workplace_address: { region, municipality },
        occupation_field: { concept_id: field, label: field },
        employment_type: { label: emp }, working_hours_type: { label: hours },
      }, 'test');
      const inserted = db.prepare(dbm.INSERT_SQL).run(...row.values);
      db.prepare('INSERT INTO ads_fts(rowid,headline,employer,body) VALUES (?,?,?,?)').run(inserted.lastInsertRowid, ...row.fts);
    }
    dbm.ensureSummary(db);
    const scenarios = [
      [{}, [3, 3, 3, 3, 3]],
      [{ terms: ['alpha'] }, [2, 2, 2, 2, 2]],
      [{ loc: [{ k: 'region', id: 'North' }] }, [2, 3, 2, 2, 2]],
      [{ sel: [{ k: 'field', id: 'f1' }] }, [3, 2, 2, 2, 2]],
      [{ from: '2026-01-01' }, [2, 2, 3, 2, 2]],
      [{ emp: 'E' }, [2, 2, 2, 3, 2]],
      [{ hours: 'H' }, [2, 2, 2, 2, 3]],
      [{ terms: ['absent'] }, [0, 0, 0, 0, 0]],
      [{ terms: ['alpha'], emp: 'E', hours: 'H', from: '2026-01-01' }, [1, 1, 1, 2, 1]],
    ];
    for (const [filter, expected] of scenarios) {
      const facets = dbm.facets(db, filter);
      assert.deepEqual(['occ', 'loc', 'year', 'emp', 'hours'].map(name => facets[name].reduce((sum, row) => sum + row.n, 0)), expected, JSON.stringify(filter));
      const rows = dbm.search(db, filter, 0, 60).rows;
      assert.equal(rows.length, dbm.count(db, filter));
      for (const row of rows) {
        assert.ok(facets.loc.some(loc => loc.r === row.region && loc.m === row.muni && loc.n > 0));
      }
    }
  } finally {
    db.close();
  }
});

test('employer statistics follow active filters and return top 30 by count', () => {
  const db = dbm.open(':memory:');
  try {
    const insert = db.prepare(dbm.INSERT_SQL);
    for (let index = 0; index < 32; index++) {
      for (let count = 0; count < 32 - index; count++) {
        const row = dbm.toRow({ id: `${index}-${count}`, employer: { name: `Employer ${String(index).padStart(2, '0')}` }, employment_type: { label: 'Match' } }, 'test');
        insert.run(...row.values);
      }
    }
    const excluded = dbm.toRow({ id: 'excluded', employer: { name: 'Excluded employer' }, employment_type: { label: 'Other' } }, 'test');
    insert.run(...excluded.values);
    dbm.ensureSummary(db);

    const employers = dbm.facets(db, { emp: 'Match' }).employers;
    assert.equal(employers.length, 30);
    assert.deepEqual(employers.slice(0, 2), [{ v: 'Employer 00', n: 32 }, { v: 'Employer 01', n: 31 }]);
    assert.equal(employers.some(row => row.v === 'Excluded employer'), false);
    assert.equal(dbm.facets(db, { emp: 'Other' }).employers[0].v, 'Excluded employer');
  } finally {
    db.close();
  }
});