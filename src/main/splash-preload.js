'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('splash', {
  theme: ipcRenderer.sendSync('theme:current'),
  datasets: () => ipcRenderer.invoke('splash:datasets'),
  openDataset: (id) => ipcRenderer.invoke('splash:open', id),
  cancel: () => ipcRenderer.invoke('splash:cancel'),
  onTheme: (cb) => ipcRenderer.on('theme:changed', (_e, theme) => cb(theme)),
  onProgress: (cb) => ipcRenderer.on('splash:progress', (_e, m) => cb(m)),
});
