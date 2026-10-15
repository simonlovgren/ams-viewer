'use strict';
const { parentPort, workerData } = require('worker_threads');
const { open, facets } = require('./db');

// Facet counts scan many rows; keep them off the main thread.
const db = open(workerData.dbPath);
parentPort.on('message', ({ id, f }) => {
  try {
    parentPort.postMessage({ id, data: facets(db, f || {}) });
  } catch (e) {
    parentPort.postMessage({ id, error: String(e.message || e) });
  }
});
