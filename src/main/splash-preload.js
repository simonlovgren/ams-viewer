'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('splash', {
  theme: ipcRenderer.sendSync('theme:current'),
  onTheme: (cb) => ipcRenderer.on('theme:changed', (_e, theme) => cb(theme)),
  onProgress: (cb) => ipcRenderer.on('splash:progress', (_e, m) => cb(m)),
});
