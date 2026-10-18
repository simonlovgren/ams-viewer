'use strict';
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const dbm = require('./db');

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