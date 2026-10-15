'use strict';
const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const { Worker } = require('worker_threads');
const dbm = require('./db');

let db;
let win;
let importing = false;

const DATA_EXT = /\.(jsonl|ndjson|json)$/i;

function createWindow() {
  win = new BrowserWindow({
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

app.whenReady().then(() => {
  db = dbm.open(dbPath());

  ipcMain.handle('db:info', () => dbm.info(db));
  ipcMain.handle('ads:search', (_e, f, offset, limit, wantTotal) =>
    dbm.search(db, f || {}, Math.max(0, offset | 0), Math.min(200, Math.max(1, limit | 0)), !!wantTotal));
  const fw = new Worker(path.join(__dirname, 'facets-worker.js'), { workerData: { dbPath: dbPath() } });
  const pending = new Map();
  let fid = 0;
  fw.on('message', ({ id, data, error }) => {
    const p = pending.get(id);
    pending.delete(id);
    if (p) error ? p.reject(new Error(error)) : p.resolve(data);
  });
  ipcMain.handle('ads:facets', (_e, f) => new Promise((resolve, reject) => {
    pending.set(++fid, { resolve, reject });
    fw.postMessage({ id: fid, f: f || {} });
  }));
  ipcMain.handle('ads:get', (_e, id) => dbm.getAd(db, id));
  ipcMain.handle('import:dialog', async () => {
    const r = await dialog.showOpenDialog(win, {
      title: 'Import job ad files',
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Job ads (JSON / JSONL)', extensions: ['jsonl', 'ndjson', 'json'] }],
    });
    return r.canceled ? { ok: false, canceled: true } : startImport(r.filePaths);
  });
  ipcMain.handle('import:start', (_e, files) => (Array.isArray(files) ? startImport(files) : { ok: false }));
  ipcMain.handle('source:remove', (_e, name) => {
    if (importing) return { ok: false, error: 'Import running' };
    dbm.removeSource(db, String(name));
    return { ok: true };
  });
  ipcMain.handle('open:external', (_e, url) => {
    if (typeof url === 'string' && /^https?:\/\//i.test(url)) shell.openExternal(url);
  });

  createWindow();
  app.on('activate', () => BrowserWindow.getAllWindows().length === 0 && createWindow());
});

app.on('window-all-closed', () => app.quit());
