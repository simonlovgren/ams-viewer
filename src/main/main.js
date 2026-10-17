'use strict';
const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const { Worker } = require('worker_threads');

let win;
let importing = false;

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
const dbPath = () => path.join(app.getPath('userData'), 'ads.db');

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
  const fail = (e) => {
    dead = e;
    if (cur) cur.reject(e);
    cur = null;
    for (const q of queue) q.reject(e);
    queue.length = 0;
  };
  const next = () => {
    if (cur || !queue.length) return;
    cur = queue.shift();
    cur.started = performance.now();
    worker.postMessage({ id: cur.id, type: cur.type, payload: cur.payload });
  };
  return {
    start() {
      worker = new Worker(path.join(__dirname, 'read-worker.js'), { workerData: { dbPath: dbPath() } });
      worker.on('message', ({ id, data, error, progress: prog, workMs }) => {
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
      worker.on('error', fail);
      worker.on('exit', () => fail(new Error('Read worker stopped')));
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
}
const lists = lane(); // result rows, single ad, database summary
const counts = lane(); // total counts
const timelines = lane(); // ads-over-time chart
const facetLane = lane(); // filter option counts
const build = lane(); // building the statistics tables, source removal

// The summary tables (filter options, chart, totals) are built once in the background, then kept current by the importer.
let summaryState = { state: 'unknown' };
let buildBusy = false;
const sendSummary = (s) => {
  summaryState = s;
  if (win && !win.isDestroyed()) win.webContents.send('summary:state', s);
};
function ensureSummary() {
  if (buildBusy) return;
  buildBusy = true;
  build.request('ensure', {}, false, (p) => sendSummary({ state: p.ready ? 'ready' : 'building', pct: p.pct, text: p.text }))
    .then(() => sendSummary({ state: 'ready' }))
    .catch((e) => sendSummary({ state: 'error', text: String(e.message || e) }))
    .finally(() => { buildBusy = false; });
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
    lap(`summary read (${info.total} ads)`);
    progress(50, 'Loading the first results…');
    await lists.request('search', { f: {}, offset: 0, limit: 1 });
    lap('first query done');
    progress(75, 'Loading the window…');
    ensureSummary();
  } catch (e) {
    console.error('[startup] failed:', e);
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
  ipcMain.handle('db:info', timed('info', () => lists.request('info')));
  ipcMain.handle('ads:search', timed('search', (_e, f, offset, limit) =>
    lists.request('search', { f: f || {}, offset: Math.max(0, offset | 0), limit: Math.min(200, Math.max(1, limit | 0)) }, true)));
  ipcMain.handle('ads:count', timed('count', (_e, f) => counts.request('count', { f: f || {} }, true)));
  ipcMain.handle('ads:timeline', timed('timeline', (_e, f) => timelines.request('timeline', { f: f || {} }, true)));
  ipcMain.handle('ads:facets', timed('facets', (_e, f) => facetLane.request('facets', { f: f || {} }, true)));
  ipcMain.handle('summary:get', () => summaryState);
  ipcMain.handle('ads:get', (_e, id) => lists.request('get', { id }));
  ipcMain.handle('import:dialog', async () => {
    const r = await dialog.showOpenDialog(win, {
      title: 'Import job ad files',
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Job ads (JSON / JSONL)', extensions: ['jsonl', 'ndjson', 'json'] }],
    });
    return r.canceled ? { ok: false, canceled: true } : startImport(r.filePaths);
  });
  ipcMain.handle('import:start', (_e, files) => (Array.isArray(files) ? startImport(files) : { ok: false }));
  ipcMain.handle('source:remove', async (_e, name) => {
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
