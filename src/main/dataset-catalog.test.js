'use strict';
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Worker } = require('node:worker_threads');
const { open } = require('./dataset-catalog');
const dbm = require('./db');

test('migrates legacy database and SQLite sidecars without copying', (t) => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ams-datasets-'));
  t.after(() => fs.rmSync(dataDir, { recursive: true, force: true }));
  for (const suffix of ['', '-wal', '-shm']) fs.writeFileSync(path.join(dataDir, `ads.db${suffix}`), suffix || 'database');

  const catalog = open(dataDir);
  const migrated = path.join(dataDir, 'datasets', 'default.db');
  assert.equal(catalog.active().name, 'default');
  assert.equal(catalog.databasePath(), migrated);
  for (const suffix of ['', '-wal', '-shm']) {
    assert.equal(fs.readFileSync(migrated + suffix, 'utf8'), suffix || 'database');
    assert.equal(fs.existsSync(path.join(dataDir, `ads.db${suffix}`)), false);
  }
  assert.equal(open(dataDir).active().id, 'default');
});

test('resumes migration after primary database was moved', (t) => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ams-datasets-'));
  t.after(() => fs.rmSync(dataDir, { recursive: true, force: true }));
  const databaseDir = path.join(dataDir, 'datasets');
  fs.mkdirSync(databaseDir);
  fs.writeFileSync(path.join(dataDir, 'ads.db-wal'), 'wal');
  fs.writeFileSync(path.join(dataDir, 'ads.db-shm'), 'shm');
  fs.writeFileSync(path.join(databaseDir, 'default.db'), 'database');
  fs.writeFileSync(path.join(dataDir, 'datasets-migration.json'), '{}');

  const catalog = open(dataDir);
  assert.equal(catalog.isInitialized('default'), true);
  assert.equal(fs.readFileSync(path.join(databaseDir, 'default.db-wal'), 'utf8'), 'wal');
  assert.equal(fs.readFileSync(path.join(databaseDir, 'default.db-shm'), 'utf8'), 'shm');
  assert.equal(fs.existsSync(path.join(dataDir, 'datasets-migration.json')), false);
});

test('refuses ambiguous migration and missing initialized databases', (t) => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ams-datasets-'));
  t.after(() => fs.rmSync(dataDir, { recursive: true, force: true }));
  fs.mkdirSync(path.join(dataDir, 'datasets'));
  fs.writeFileSync(path.join(dataDir, 'ads.db'), 'legacy');
  fs.writeFileSync(path.join(dataDir, 'datasets', 'default.db'), 'existing');
  assert.throws(() => open(dataDir), /Both legacy and dataset databases exist/);
  assert.equal(fs.readFileSync(path.join(dataDir, 'ads.db'), 'utf8'), 'legacy');

  fs.rmSync(path.join(dataDir, 'datasets', 'default.db'));
  const catalog = open(dataDir);
  catalog.markInitialized('default');
  fs.rmSync(catalog.databasePath());
  assert.throws(() => open(dataDir), /Dataset database is missing/);
});

test('restores staged database files when deletion was interrupted before catalog commit', (t) => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ams-datasets-'));
  t.after(() => fs.rmSync(dataDir, { recursive: true, force: true }));
  const catalog = open(dataDir);
  const dbPath = catalog.databasePath();
  catalog.markInitialized('default');
  fs.writeFileSync(`${dbPath}.delete-interrupted`, 'database');
  fs.writeFileSync(`${dbPath}-wal.delete-interrupted`, 'wal');

  assert.equal(open(dataDir).isInitialized('default'), true);
  assert.equal(fs.readFileSync(dbPath, 'utf8'), 'database');
  assert.equal(fs.readFileSync(`${dbPath}-wal`, 'utf8'), 'wal');
  assert.equal(fs.readdirSync(path.dirname(dbPath)).some((name) => name.includes('.delete-')), false);
});

test('keeps dataset metadata persistent and rejects blank or duplicate names', (t) => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ams-datasets-'));
  t.after(() => fs.rmSync(dataDir, { recursive: true, force: true }));
  const catalog = open(dataDir);
  const created = catalog.create('  Research  ', 'First line\nSecond line');

  assert.match(created.id, /^ds-[a-f0-9-]+$/);
  assert.equal(path.basename(catalog.databasePath(created.id)), `${created.id}.db`);
  assert.throws(() => catalog.create('  ', ''), /cannot be blank/);
  assert.throws(() => catalog.create('research', ''), /already exists/);
  catalog.update(created.id, 'Corpus', 'Updated\ndescription');
  catalog.activate(created.id);

  const reopened = open(dataDir);
  assert.equal(reopened.active().name, 'Corpus');
  assert.equal(reopened.active().description, 'Updated\ndescription');
  assert.equal(reopened.databasePath(), catalog.databasePath(created.id));
});

test('deleting active dataset selects oldest remaining and last deletion restores default', (t) => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ams-datasets-'));
  t.after(() => fs.rmSync(dataDir, { recursive: true, force: true }));
  const catalog = open(dataDir);
  const first = catalog.create('First');
  const second = catalog.create('Second');
  catalog.activate(second.id);

  catalog.remove(second.id);
  assert.equal(catalog.active().id, 'default');
  catalog.remove(first.id);
  catalog.remove('default');
  assert.deepEqual(catalog.list(), [{ id: 'default', name: 'default', description: '' }]);
  assert.equal(catalog.active().id, 'default');
});

test('separate dataset databases isolate identical ad IDs', (t) => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ams-datasets-'));
  const catalog = open(dataDir);
  const second = catalog.create('Second');
  const firstDb = dbm.open(catalog.databasePath());
  const secondDb = dbm.open(catalog.databasePath(second.id));
  t.after(() => { secondDb.close(); firstDb.close(); fs.rmSync(dataDir, { recursive: true, force: true }); });
  const insert = (db, headline) => {
    const row = dbm.toRow({ id: 'same-id', headline }, 'same-source.jsonl');
    db.prepare(dbm.INSERT_SQL).run(...row.values);
  };

  insert(firstDb, 'First dataset ad');
  insert(secondDb, 'Second dataset ad');
  assert.equal(firstDb.prepare('SELECT COUNT(*) n FROM ads').get().n, 1);
  assert.equal(secondDb.prepare('SELECT COUNT(*) n FROM ads').get().n, 1);
  assert.equal(firstDb.prepare('SELECT headline FROM ads').get().headline, 'First dataset ad');
  assert.equal(secondDb.prepare('SELECT headline FROM ads').get().headline, 'Second dataset ad');
});

test('read worker closes its SQLite connection before exit', async (t) => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ams-datasets-'));
  t.after(() => fs.rmSync(dataDir, { recursive: true, force: true }));
  const databasePath = path.join(dataDir, 'worker.db');
  const db = dbm.open(databasePath);
  db.close();
  const worker = new Worker(path.join(__dirname, 'read-worker.js'), { workerData: { dbPath: databasePath } });
  t.after(() => worker.terminate());

  await new Promise((resolve, reject) => {
    worker.on('message', (message) => {
      if (message.type === 'ready') worker.postMessage({ type: 'close' });
      if (message.type === 'closed') resolve();
      if (message.type === 'close-error') reject(new Error(message.error));
    });
    worker.on('error', reject);
  });
  await new Promise((resolve, reject) => worker.once('exit', (code) => code === 0 ? resolve() : reject(new Error(`Worker exit ${code}`))));
  fs.renameSync(databasePath, `${databasePath}.moved`);
  assert.equal(fs.existsSync(`${databasePath}.moved`), true);
});