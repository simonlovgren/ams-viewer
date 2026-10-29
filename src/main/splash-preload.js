'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('splash', {
  theme: ipcRenderer.sendSync('theme:current'),
  onProgress: (cb) => ipcRenderer.on('splash:progress', (_e, m) => cb(m)),
});
