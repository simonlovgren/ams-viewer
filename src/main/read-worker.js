'use strict';
const { parentPort, workerData } = require('worker_threads');
const dbm = require('./db');

// All database reads (and source removal / statistics building) run in these workers, never in the main
// process (a blocked main process makes the OS flag the window as not responding). The main process runs
// several instances, one per kind of request, so a slow request never delays the others.
const db = dbm.open(workerData.dbPath);
parentPort.postMessage({ type: 'ready' });

const handlers = {
  search: ({ f, offset, limit }) => dbm.search(db, f || {}, offset, limit, false),
  count: ({ f }) => ({ total: dbm.count(db, f || {}) }),
  get: ({ id }) => dbm.getAd(db, id),
  info: () => dbm.info(db),
  datasetStats: () => dbm.datasetStats(db),
  facets: ({ f }) => dbm.facets(db, f || {}),
  timeline: ({ f }) => (dbm.isBuilt(db) ? dbm.timeline(db, f || {}) : { building: true }),
  remove: ({ name }) => { dbm.removeSource(db, name); return true; },
  ensure: (_p, progress) => dbm.ensureSummary(db, progress),
};

parentPort.on('message', ({ id, type, payload }) => {
  if (type === 'close') {
    try {
      db.close();
      parentPort.postMessage({ type: 'closed' });
      parentPort.close();
    } catch (e) {
      parentPort.postMessage({ type: 'close-error', error: String(e.message || e) });
    }
    return;
  }
  const started = performance.now();
  try {
    const data = handlers[type](payload || {}, (p) => parentPort.postMessage({ id, progress: p }));
    parentPort.postMessage({ id, data, workMs: performance.now() - started });
  } catch (e) {
    parentPort.postMessage({ id, error: String(e.message || e), workMs: performance.now() - started });
  }
});
