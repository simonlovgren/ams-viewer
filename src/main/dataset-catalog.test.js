'use strict';
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Worker } = require('node:worker_threads');
const vm = require('node:vm');
const { open } = require('./dataset-catalog');
const dbm = require('./db');

test('enrichment notices stack after their parent, update counters and clear on every exit', () => {
  const source = fs.readFileSync(require.resolve('./main'), 'utf8');
  const events = [];
  const context = vm.createContext({
    win: { isDestroyed: () => false, webContents: { send: (_channel, event) => events.push(event) } },
  });
  vm.runInContext(source.slice(source.indexOf('const tasks = new Map();'), source.indexOf('const errorText =')), context);
  for (const key of ['summary', 'import', 'reprocess']) {
    context.key = key;
    vm.runInContext("sendWorkProgress(key, {phase:'enrichment', text:'Enriching data: 200 checks · 10 newly enriched ads', pct:null})", context);
    assert.deepEqual(Array.from(vm.runInContext('[...tasks.keys()]', context)), [key, `${key}:enrichment`]);
    assert.equal(events.at(-1).pct, null);
    assert.match(events.at(-1).text, /10 newly enriched/);
    vm.runInContext("sendWorkProgress(key, {phase:'enrichment', text:'Enriching data: 400 checks · 20 newly enriched ads', pct:null})", context);
    assert.equal(vm.runInContext('tasks.size', context), 2);
    assert.match(events.at(-1).text, /20 newly enriched/);
    vm.runInContext("sendWorkProgress(key, {text:'Updating filters', pct:50})", context);
    assert.equal(vm.runInContext('tasks.size', context), 1);
    for (const state of ['done', 'error']) {
      context.state = state;
      vm.runInContext("sendWorkProgress(key, {phase:'enrichment', text:'Enriching data', pct:null}); sendTask(key, state, 'Outcome')", context);
      assert.equal(vm.runInContext('tasks.size', context), 0);
      assert.equal(events.at(-2).key, `${key}:enrichment`);
      assert.equal(events.at(-2).state, 'done');
      assert.equal(events.at(-1).state, state);
    }
  }
});

test('ad source IPC validates IDs and sender before dispatching to the read worker', async () => {
  const source = fs.readFileSync(require.resolve('./main'), 'utf8');
  const handlers = new Map();
  const requests = [];
  const sender = {};
  let stable = true;
  const context = vm.createContext({
    ipcMain: { handle: (name, handler) => handlers.set(name, handler) },
    win: { webContents: sender },
    assertStableDataset: () => { if (!stable) throw new Error('Dataset changing'); },
    lists: { request: (...args) => { requests.push(args); return Promise.resolve({ source: {}, enrichment: {} }); } },
  });
  vm.runInContext(source.slice(source.indexOf("  ipcMain.handle('ads:source'"), source.indexOf("  ipcMain.handle('datasets:list'")), context);
  const read = handlers.get('ads:source');
  assert.throws(() => read({ sender: {} }, 'id'), /main window/);
  for (const id of [null, {}, 5, '', '   ']) assert.throws(() => read({ sender }, id), /Invalid ad ID/);
  stable = false;
  assert.throws(() => read({ sender }, 'id'), /Dataset changing/);
  assert.equal(requests.length, 0);
  stable = true;
  await read({ sender }, 'h-legacy');
  assert.equal(requests[0][0], 'source');
  assert.equal(requests[0][1].id, 'h-legacy');
});

test('manual reprocessing gates dataset mutations and reports progress, completion and failures', async () => {
  const source = fs.readFileSync(require.resolve('./main'), 'utf8');
  const code = source.slice(source.indexOf('async function reprocessDataset(id)'), source.indexOf('async function deleteDataset(id)'));
  for (const outcome of ['success', 'error']) {
    const events = [];
    let calls = 0;
    const context = vm.createContext({
      datasets: { active: () => ({ id: 'active' }), updateStats: (id, info) => events.push(['stats', id, info.total]) },
      sendSummary: state => events.push(['summary', state]),
      sendTask: (...args) => events.push(['task', ...args]),
      errorText: error => error.message,
      build: { request: async (type, _payload, _latest, progress) => {
        calls++;
        assert.equal(type, 'reprocess');
        assert.equal(vm.runInContext('buildBusy', context), true);
        progress({ pct: 50, text: 'Halfway' });
        if (outcome === 'error') throw new Error('Rebuild failed');
        return { processed: 7 };
      } },
      lists: { request: async () => ({ total: 7 }) },
    });
    vm.runInContext("let summaryState = {state:'ready'}; let buildBusy = false, datasetChanging = false, datasetStatsBusy = false, importing = false;" + code, context);
    for (const id of ['other', null, {}]) {
      context.id = id;
      assert.equal((await vm.runInContext('reprocessDataset(id)', context)).ok, false);
    }
    for (const flag of ['buildBusy', 'datasetChanging', 'datasetStatsBusy', 'importing']) {
      vm.runInContext(`${flag} = true`, context);
      assert.equal((await vm.runInContext("reprocessDataset('active')", context)).ok, false);
      vm.runInContext(`${flag} = false`, context);
    }
    assert.equal(calls, 0);
    const result = await vm.runInContext("reprocessDataset('active')", context);
    assert.equal(result.ok, outcome === 'success');
    assert.equal(calls, 1);
    assert.equal(vm.runInContext('buildBusy', context), false);
    assert.ok(events.some(event => event[0] === 'task' && event[2] === 'running' && event[4] === 50));
    assert.deepEqual(events.at(-1), ['task', 'reprocess', 'done']);
    if (outcome === 'success') {
      assert.equal(result.processed, 7);
      assert.equal(events.some(event => event[0] === 'task' && event[2] === 'error'), false);
      assert.ok(events.some(event => event[0] === 'stats' && event[1] === 'active' && event[2] === 7));
      assert.ok(events.some(event => event[0] === 'summary' && event[1].state === 'ready'));
    } else {
      assert.equal(result.error, 'Rebuild failed');
      assert.deepEqual(events.find(event => event[0] === 'task' && event[2] === 'error'),
        ['task', 'reprocess', 'error', 'Dataset reprocessing failed: Rebuild failed']);
      assert.equal(events.filter(event => event[0] === 'summary').at(-1)[1].state, 'ready');
    }
  }
});

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

test('persists cheap dataset statistics for chooser entries', (t) => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ams-datasets-'));
  t.after(() => fs.rmSync(dataDir, { recursive: true, force: true }));
  const catalog = open(dataDir);
  const dataset = catalog.create('Research');
  catalog.updateStats(dataset.id, { total: 12, sources: [{ name: 'one.jsonl' }, { name: 'two.jsonl' }], min: '2020-01-01', max: '2021-12-31' });

  const reopened = open(dataDir);
  assert.deepEqual(reopened.list().find(item => item.id === dataset.id).stats, {
    total: 12, sourceCount: 2, min: '2020-01-01', max: '2021-12-31',
  });
  assert.equal(reopened.list().find(item => item.id === 'default').stats, null);
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
  assert.deepEqual(catalog.list(), [{
    id: 'default', name: 'default', description: '', stats: { total: 0, sourceCount: 0, min: null, max: null },
  }]);
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

test('read worker reprocesses multiple batches and reports progress before completion', { timeout: 10000 }, async (t) => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ams-reprocess-'));
  t.after(() => fs.rmSync(dataDir, { recursive: true, force: true }));
  const databasePath = path.join(dataDir, 'worker.db');
  const db = dbm.open(databasePath);
  const insert = db.prepare(dbm.INSERT_SQL);
  for (let index = 0; index < 501; index++) {
    insert.run(...dbm.toRow({ id: String(index), headline: 'Engineer', publication_date: '2026-01-01' }, 'test').values);
  }
  db.prepare("INSERT INTO sources(name, ads) VALUES ('test', 0)").run();
  db.close();
  const worker = new Worker(path.join(__dirname, 'read-worker.js'), { workerData: { dbPath: databasePath } });
  t.after(() => worker.terminate());
  const events = [];
  await new Promise((resolve, reject) => {
    worker.on('message', message => {
      if (message.type === 'ready') worker.postMessage({ id: 1, type: 'reprocess' });
      if (message.error) return reject(new Error(message.error));
      if (message.progress) events.push(message.progress);
      else if (message.id === 1) {
        assert.equal(message.data.processed, 501);
        assert.equal(events.at(-1).pct, 100);
        worker.postMessage({ type: 'close' });
      }
      if (message.type === 'closed') resolve();
    });
    worker.on('error', reject);
  });
  assert.ok(events.some(event => /500 of 501/.test(event.text)));
  const rebuilt = dbm.open(databasePath);
  try {
    assert.equal(dbm.count(rebuilt, { q: 'Engineer' }), 501);
    assert.equal(dbm.datasetStats(rebuilt).total, 501);
    assert.equal(dbm.facets(rebuilt, {}).year[0].n, 501);
  } finally {
    rebuilt.close();
  }
});

test('read worker closes its SQLite connection before exit', async (t) => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ams-datasets-'));
  t.after(() => fs.rmSync(dataDir, { recursive: true, force: true }));
  const databasePath = path.join(dataDir, 'worker.db');
  const db = dbm.open(databasePath);
  db.prepare('INSERT INTO sources(name, ads) VALUES (?, ?), (?, ?)').run('one.jsonl', 3, 'two.jsonl', 4);
  db.close();
  const worker = new Worker(path.join(__dirname, 'read-worker.js'), { workerData: { dbPath: databasePath } });
  t.after(() => worker.terminate());

  await new Promise((resolve, reject) => {
    worker.on('message', (message) => {
      if (message.type === 'ready') worker.postMessage({ id: 1, type: 'datasetStats' });
      if (message.id === 1) {
        assert.deepEqual(message.data, { total: 7, sourceCount: 2 });
        worker.postMessage({ type: 'close' });
      }
      if (message.type === 'closed') resolve();
      if (message.type === 'close-error') reject(new Error(message.error));
    });
    worker.on('error', reject);
  });
  await new Promise((resolve, reject) => worker.once('exit', (code) => code === 0 ? resolve() : reject(new Error(`Worker exit ${code}`))));
  fs.renameSync(databasePath, `${databasePath}.moved`);
  assert.equal(fs.existsSync(`${databasePath}.moved`), true);
});