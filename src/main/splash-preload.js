'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('splash', {
  onProgress: (cb) => ipcRenderer.on('splash:progress', (_e, m) => cb(m)),
});
