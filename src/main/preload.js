'use strict';
const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('api', {
  info: () => ipcRenderer.invoke('db:info'),
  search: (filters, offset, limit, wantTotal) => ipcRenderer.invoke('ads:search', filters, offset, limit, wantTotal),
  facets: (filters) => ipcRenderer.invoke('ads:facets', filters),
  get: (id) => ipcRenderer.invoke('ads:get', id),
  importDialog: () => ipcRenderer.invoke('import:dialog'),
  importFiles: (paths) => ipcRenderer.invoke('import:start', paths),
  removeSource: (name) => ipcRenderer.invoke('source:remove', name),
  openExternal: (url) => ipcRenderer.invoke('open:external', url),
  pathFor: (file) => webUtils.getPathForFile(file),
  onImport: (cb) => ipcRenderer.on('import:event', (_e, m) => cb(m)),
});
