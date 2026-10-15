'use strict';
const { parentPort, workerData } = require('worker_threads');
const { open, facets, info } = require('./db');

// Facet counts scan many rows; keep them off the main thread. Also answers the database summary and the startup warm-up.
const db = open(workerData.dbPath);
const cache = {};
parentPort.on('message', ({ id, type, f }) => {
  try {
    let data;
    if (type === 'info') data = info(db);
    else if (type === 'warm') {
      const names = ['occ', 'loc', 'year', 'emp', 'hours', 'timeline'];
      facets(db, {}, cache, (name) => parentPort.postMessage({ id, progress: { step: names.indexOf(name) + 1, total: names.length, name } }));
      data = true;
    }
    else data = facets(db, f || {}, cache);
    parentPort.postMessage({ id, data });
  } catch (e) {
    parentPort.postMessage({ id, error: String(e.message || e) });
  }
});
