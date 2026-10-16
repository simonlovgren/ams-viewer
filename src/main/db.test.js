'use strict';
const assert = require('node:assert/strict');
const { test } = require('node:test');
const dbm = require('./db');

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