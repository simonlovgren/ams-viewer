'use strict';
const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const fs = require('fs');
const path = require('path');
const { Worker } = require('worker_threads');
const { randomUUID } = require('crypto');
const datasetCatalog = require('./dataset-catalog');

let win;
let importing = false;
let datasets;
let datasetChanging = false;

const DATA_EXT = /\.(jsonl|ndjson|json)$/i;

function createWindow(show = true) {
  win = new BrowserWindow({
    show,
    width: 1400,
    height: 900,
    minWidth: 960,
    minHeight: 600,
    backgroundColor: '#0a0d18',
    title: 'AMS Viewer',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  win.setMenuBarVisibility(false);
  win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e) => e.preventDefault());
}

function startImport(files) {
  if (datasetChanging) return { ok: false, error: 'Dataset transition in progress' };
  if (importing) return { ok: false, error: 'Import already running' };
  if (buildBusy) return { ok: false, error: 'Statistics are being built (one-time); try again when it has finished.' };
  const valid = files.filter((f) => typeof f === 'string' && DATA_EXT.test(f));
  if (!valid.length) return { ok: false, error: 'No .jsonl/.ndjson/.json files' };
  importing = true;
  const send = (m) => win && !win.isDestroyed() && win.webContents.send('import:event', m);
  const w = new Worker(path.join(__dirname, 'import-worker.js'), {
    workerData: { dbPath: dbPath(), files: valid },
    resourceLimits: { maxOldGenerationSizeMb: 3072 },
  });
  let finished = false;
  w.on('message', (m) => {
    if (m.type === 'done' || m.type === 'error') { importing = false; finished = true; }
    if (m.type === 'done') ensureSummary();
    send(m);
  });
  w.on('error', (e) => {
    importing = false;
    finished = true;
    send({ type: 'error', message: String(e.message || e) });
  });
  w.on('exit', () => {
    if (finished) return;
    importing = false;
    send({ type: 'error', message: 'Import worker stopped unexpectedly' });
  });
  return { ok: true, count: valid.length };
}

// Fixed folder: the default follows package.json (name vs productName) and once split the data across two folders.
app.setPath('userData', path.join(app.getPath('appData'), 'AMS Viewer'));
const dbPath = () => datasets.databasePath();

let splash;
function createSplash() {
  splash = new BrowserWindow({
    width: 460,
    height: 270,
    frame: false,
    resizable: false,
    show: false,
    center: true,
    backgroundColor: '#0a0d18',
    title: 'AMS Viewer',
    webPreferences: {
      preload: path.join(__dirname, 'splash-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  splash.loadFile(path.join(__dirname, '..', 'renderer', 'splash.html'));
  return new Promise((resolve) => splash.once('ready-to-show', () => { splash.show(); resolve(); }));
}
const progress = (pct, text) => splash && !splash.isDestroyed() && splash.webContents.send('splash:progress', { pct, text });

// Database reads run in workers, never in the main process: a blocked main process makes the OS flag the window as not responding.
function lane() {
  let worker;
  let dead = null;
  const queue = [];
  let cur = null;
  let seq = 0;
  let restarting = false;
  let closeWaiter;
  const idleWaiters = [];
  const signalIdle = () => {
    if (cur || queue.length) return;
    while (idleWaiters.length) idleWaiters.shift()();
  };
  const waitIdle = () => new Promise((resolve) => {
    if (!cur && !queue.length) resolve();
    else idleWaiters.push(resolve);
  });
  const fail = (e) => {
    dead = e;
    if (cur) cur.reject(e);
    cur = null;
    for (const q of queue) q.reject(e);
    queue.length = 0;
    signalIdle();
  };
  const next = () => {
    if (cur || !queue.length) { signalIdle(); return; }
    cur = queue.shift();
    cur.started = performance.now();
    worker.postMessage({ id: cur.id, type: cur.type, payload: cur.payload });
  };
  const start = (dbPath) => new Promise((resolve, reject) => {
    const instance = new Worker(path.join(__dirname, 'read-worker.js'), { workerData: { dbPath } });
    worker = instance;
    let ready = false;
    instance.on('message', ({ id, type, data, error, progress: prog, workMs }) => {
      if (type === 'ready') { ready = true; resolve(); return; }
      if (type === 'closed') { if (closeWaiter) closeWaiter(); return; }
      if (type === 'close-error') { if (closeWaiter) closeWaiter(new Error(error)); return; }
      if (prog) {
        if (cur && cur.id === id && cur.onProgress) cur.onProgress(prog);
        return;
      }
      if (!cur || cur.id !== id) return;
      const c = cur;
      cur = null;
      const queueMs = Math.round(c.started - c.queued);
      if (process.env.AMS_TRACE || queueMs + workMs > 500) {
        console.log(`[query] ${c.type} queue ${queueMs} ms, work ${Math.round(workMs)} ms${error ? ', failed' : ''}`);
      }
      if (error) c.reject(new Error(error)); else c.resolve(data);
      next();
    });
    instance.on('error', (e) => {
      if (!ready) reject(e);
      if (!restarting) fail(e);
    });
    instance.on('exit', () => {
      if (worker === instance) worker = null;
      if (!ready) reject(new Error('Read worker stopped before opening database'));
      if (!restarting) fail(new Error('Read worker stopped'));
    });
  });
  return {
    start() { start(dbPath()).catch(() => {}); },
    async restart(dbPath) {
      await waitIdle();
      restarting = true;
      try {
        await closeWorker();
        worker = null;
        dead = null;
        await start(dbPath);
      } catch (error) {
        dead = error;
        if (worker) await worker.terminate();
        worker = null;
        throw error;
      }
      finally { restarting = false; }
    },
    async stop() {
      await waitIdle();
      restarting = true;
      try {
        await closeWorker();
        worker = null;
        dead = new Error('Dataset transition in progress');
      } catch (error) {
        dead = error;
        if (worker) await worker.terminate();
        worker = null;
        throw error;
      } finally { restarting = false; }
    },
    // latest: a queued request of the same type is superseded (resolves as stale) so slow outdated work never piles up.
    request(type, payload, latest = false, onProgress = null) {
      return new Promise((resolve, reject) => {
        if (dead) { reject(dead); return; }
        if (latest) {
          for (let i = queue.length - 1; i >= 0; i--) {
            if (queue[i].type === type) { queue[i].resolve({ stale: true }); queue.splice(i, 1); }
          }
        }
        queue.push({ id: ++seq, type, payload, resolve, reject, onProgress, queued: performance.now() });
        next();
      });
    },
  };

  function closeWorker() {
    if (!worker) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const closingWorker = worker;
      const onError = (error) => finish(error);
      const onExit = (code) => finish(new Error(`Read worker exited before closing (${code})`));
      const finish = (error) => {
        if (!closeWaiter) return;
        closeWaiter = null;
        closingWorker.removeListener('error', onError);
        closingWorker.removeListener('exit', onExit);
        if (error) reject(error); else resolve();
      };
      closeWaiter = finish;
      closingWorker.once('error', onError);
      closingWorker.once('exit', onExit);
      try { closingWorker.postMessage({ type: 'close' }); }
      catch (error) { finish(error); }
    });
  }
}
const lists = lane(); // result rows, single ad, database summary
const counts = lane(); // total counts
const timelines = lane(); // ads-over-time chart
const facetLane = lane(); // filter option counts
const build = lane(); // building the statistics tables, source removal
const allLanes = [lists, counts, timelines, facetLane, build];

// The summary tables (filter options, chart, totals) are built once in the background, then kept current by the importer.
let summaryState = { state: 'unknown' };
let buildBusy = false;
const sendSummary = (s) => {
  summaryState = s;
  if (win && !win.isDestroyed()) win.webContents.send('summary:state', s);
};
function ensureSummary() {
  if (buildBusy) return Promise.resolve();
  buildBusy = true;
  return build.request('ensure', {}, false, (p) => sendSummary({ state: p.ready ? 'ready' : 'building', pct: p.pct, text: p.text }))
    .then(() => sendSummary({ state: 'ready' }))
    .catch((e) => sendSummary({ state: 'error', text: String(e.message || e) }))
    .finally(() => { buildBusy = false; });
}

async function switchDataset(id, force = false) {
  const previous = datasets.active();
  if (previous.id === id && !force) return previous;
  const targetPath = datasets.databasePath(id);
  try {
    await restartLanes(targetPath);
    const info = await lists.request('info');
    if (!Number.isSafeInteger(info.total)) throw new Error('Dataset database could not be opened');
    datasets.markInitialized(id);
    datasets.activate(id);
  } catch (error) {
    try { await restartLanes(datasets.databasePath(previous.id)); }
    catch (rollbackError) { throw new Error(`${error.message}; rollback failed: ${rollbackError.message}`); }
    throw error;
  }
  summaryState = { state: 'unknown' };
  sendSummary(summaryState);
  ensureSummary();
  return datasets.active();
}

async function restartLanes(databasePath) {
  await lists.restart(databasePath);
  const starts = await Promise.allSettled(allLanes.slice(1).map((workerLane) => workerLane.restart(databasePath)));
  const failed = starts.find((result) => result.status === 'rejected');
  if (failed) throw failed.reason;
}

function stageDatabase(databasePath) {
  const staged = [];
  try {
    for (const suffix of ['', '-wal', '-shm']) {
      const source = databasePath + suffix;
      if (!fs.existsSync(source)) continue;
      const target = `${source}.delete-${randomUUID()}`;
      fs.renameSync(source, target);
      staged.push({ source, target });
    }
    return staged;
  } catch (error) {
    restoreStaged(staged);
    throw error;
  }
}

function restoreStaged(staged) {
  for (const item of [...staged].reverse()) {
    if (fs.existsSync(item.target)) fs.renameSync(item.target, item.source);
  }
}

function removeStaged(staged) {
  for (const item of staged) {
    try { fs.rmSync(item.target, { force: true }); } catch { /* an orphaned staged file is harmless */ }
  }
}

function removeDatabase(databasePath) {
  for (const suffix of ['', '-wal', '-shm']) fs.rmSync(databasePath + suffix, { force: true });
}

async function datasetOperation(fn) {
  if (datasetChanging) return { ok: false, error: 'Dataset transition already running' };
  if (importing) return { ok: false, error: 'Import running' };
  if (buildBusy) return { ok: false, error: 'Statistics are being built; try again when it has finished.' };
  datasetChanging = true;
  try { return { ok: true, ...(await fn()) }; }
  catch (error) { return { ok: false, error: String(error.message || error) }; }
  finally { datasetChanging = false; }
}

async function createDataset(name, description) {
  const snapshot = datasets.snapshot();
  const previousId = datasets.active().id;
  const dataset = datasets.create(name, description);
  try {
    await switchDataset(dataset.id);
    return { dataset: datasets.active() };
  } catch (error) {
    datasets.restore(snapshot);
    try {
      await switchDataset(previousId, true);
      removeDatabase(datasets.databasePath(dataset.id));
    } catch (rollbackError) {
      throw new Error(`${error.message}; rollback failed: ${rollbackError.message}`);
    }
    throw error;
  }
}

async function deleteDataset(id) {
  if (typeof id !== 'string') throw new Error('Invalid dataset id');
  const snapshot = datasets.snapshot();
  const dataset = datasets.list().find((entry) => entry.id === id);
  if (!dataset) throw new Error('Dataset not found');
  const databasePath = datasets.databasePath(id);
  const wasActive = datasets.active().id === id;
  const remaining = datasets.list().filter((entry) => entry.id !== id);
  const previousId = datasets.active().id;
  let staged = [];
  let workersStopped = false;
  let replacementStarted = false;

  try {
    if (wasActive && remaining.length) await switchDataset(remaining[0].id);
    if (wasActive && !remaining.length && id !== 'default') {
      datasets.ensureResetDefault();
      await switchDataset('default');
    }
    if (wasActive && !remaining.length && id === 'default') {
      await Promise.all(allLanes.map((workerLane) => workerLane.stop()));
      workersStopped = true;
      staged = stageDatabase(databasePath);
      datasets.remove(id);
      replacementStarted = true;
      await restartLanes(datasets.databasePath());
      const info = await lists.request('info');
      if (!Number.isSafeInteger(info.total)) throw new Error('Replacement default database could not be opened');
      datasets.markInitialized('default');
      ensureSummary();
    } else {
      staged = stageDatabase(databasePath);
      datasets.remove(id);
    }
    removeStaged(staged);
    return { dataset: { ...dataset }, active: datasets.active() };
  } catch (error) {
    if (workersStopped) {
      await Promise.allSettled(allLanes.map((workerLane) => workerLane.stop()));
      if (replacementStarted) removeDatabase(databasePath);
    }
    restoreStaged(staged);
    datasets.restore(snapshot);
    if (datasets.active().id !== previousId || wasActive) await switchDataset(previousId, true);
    throw error;
  }
}

app.whenReady().then(async () => {
  const t0 = Date.now();
  const lap = (what) => console.log(`[startup] ${what} +${Date.now() - t0} ms`);
  let last = Date.now();
  setInterval(() => {
    const now = Date.now();
    if (now - last > 1500) console.log(`[perf] main process blocked ${now - last - 250} ms`);
    last = now;
  }, 250).unref();
  try {
    datasets = datasetCatalog.open(app.getPath('userData'));
    await createSplash();
    progress(5, 'Opening the database…');
    registerHandlers();
    lists.start();
    counts.start();
    timelines.start();
    facetLane.start();
    build.start();
    progress(15, 'Reading the database summary…');
    const info = await lists.request('info');
    datasets.markInitialized(datasets.active().id);
    lap(`summary read (${info.total} ads)`);
    progress(50, 'Loading the first results…');
    await lists.request('search', { f: {}, offset: 0, limit: 1 });
    lap('first query done');
    progress(75, 'Loading the window…');
    ensureSummary();
  } catch (e) {
    console.error('[startup] failed:', e);
    dialog.showErrorBox('AMS Viewer could not start', String(e.message || e));
    app.quit();
    return;
  }

  let shown = false;
  const showMain = () => {
    if (shown) return;
    shown = true;
    progress(100, 'Ready');
    if (win && !win.isDestroyed()) win.show();
    setTimeout(() => splash && !splash.isDestroyed() && splash.close(), 200);
    lap('window shown');
  };
  ipcMain.once('app:ready', showMain);
  setTimeout(showMain, 120000);
  createWindow(false);
  app.on('activate', () => BrowserWindow.getAllWindows().length === 0 && createWindow());
});

function registerHandlers() {
  // Slow calls (over 0.5 s) are logged; set AMS_TRACE=1 to log every call.
  const trace = !!process.env.AMS_TRACE;
  const timed = (name, fn) => async (...a) => {
    const t = Date.now();
    if (trace) console.log(`[trace] ${name} start`);
    try { return await fn(...a); } finally {
      const ms = Date.now() - t;
      if (trace) console.log(`[trace] ${name} done ${ms} ms`);
      else if (ms > 500) console.log(`[perf] ${name} ${ms} ms`);
    }
  };
  const assertStableDataset = () => { if (datasetChanging) throw new Error('Dataset transition in progress'); };
  ipcMain.handle('db:info', timed('info', () => { assertStableDataset(); return lists.request('info'); }));
  ipcMain.handle('ads:search', timed('search', (_e, f, offset, limit) => {
    assertStableDataset();
    return lists.request('search', { f: f || {}, offset: Math.max(0, offset | 0), limit: Math.min(200, Math.max(1, limit | 0)) }, true);
  }));
  ipcMain.handle('ads:count', timed('count', (_e, f) => { assertStableDataset(); return counts.request('count', { f: f || {} }, true); }));
  ipcMain.handle('ads:timeline', timed('timeline', (_e, f) => { assertStableDataset(); return timelines.request('timeline', { f: f || {} }, true); }));
  ipcMain.handle('ads:facets', timed('facets', (_e, f) => { assertStableDataset(); return facetLane.request('facets', { f: f || {} }, true); }));
  ipcMain.handle('summary:get', () => { assertStableDataset(); return summaryState; });
  ipcMain.handle('ads:get', (_e, id) => { assertStableDataset(); return lists.request('get', { id }); });
  ipcMain.handle('datasets:list', () => { assertStableDataset(); return { datasets: datasets.list(), active: datasets.active() }; });
  ipcMain.handle('datasets:create', (_e, name, description) => datasetOperation(() => createDataset(name, description)));
  ipcMain.handle('datasets:update', (_e, id, name, description) => datasetOperation(() => ({ dataset: datasets.update(id, name, description) })));
  ipcMain.handle('datasets:activate', (_e, id) => datasetOperation(async () => ({ dataset: await switchDataset(id) })));
  ipcMain.handle('datasets:delete', (_e, id) => datasetOperation(() => deleteDataset(id)));
  ipcMain.handle('import:dialog', async () => {
    if (datasetChanging) return { ok: false, error: 'Dataset transition in progress' };
    const r = await dialog.showOpenDialog(win, {
      title: 'Import job ad files',
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Job ads (JSON / JSONL)', extensions: ['jsonl', 'ndjson', 'json'] }],
    });
    return r.canceled ? { ok: false, canceled: true } : startImport(r.filePaths);
  });
  ipcMain.handle('import:start', (_e, files) => {
    if (datasetChanging) return { ok: false, error: 'Dataset transition in progress' };
    return Array.isArray(files) ? startImport(files) : { ok: false };
  });
  ipcMain.handle('source:remove', async (_e, name) => {
    if (datasetChanging) return { ok: false, error: 'Dataset transition in progress' };
    if (importing) return { ok: false, error: 'Import running' };
    if (buildBusy) return { ok: false, error: 'Statistics are being built (one-time); try again when it has finished.' };
    try {
      await build.request('remove', { name: String(name) });
      return { ok: true };
    } catch (e) {
      return { ok: false, error: String(e.message || e) };
    }
  });
  ipcMain.handle('open:external', (_e, url) => {
    if (typeof url === 'string' && /^https?:\/\//i.test(url)) shell.openExternal(url);
  });
}

app.on('window-all-closed', () => app.quit());
