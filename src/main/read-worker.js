'use strict';
const { parentPort, workerData } = require('worker_threads');
const dbm = require('./db');

// All database reads (and source removal) run here, never on the main process (a blocked main
// process makes the OS flag the window as not responding). Two workers run: `list` (rows, ad, summary)
// and `stats` (facets, counts, removal), so a slow count never delays the list.
const db = dbm.open(workerData.dbPath);
const cache = {};

const handlers = {
  search: ({ f, offset, limit }) => dbm.search(db, f || {}, offset, limit, false),
  count: ({ f }) => ({ total: dbm.count(db, f || {}) }),
  get: ({ id }) => dbm.getAd(db, id),
  info: () => dbm.info(db),
  facets: ({ f }) => dbm.facets(db, f || {}, cache),
  remove: ({ name }) => { dbm.removeSource(db, name); return true; },
};

parentPort.on('message', ({ id, type, payload }) => {
  try {
    parentPort.postMessage({ id, data: handlers[type](payload || {}) });
  } catch (e) {
    parentPort.postMessage({ id, error: String(e.message || e) });
  }
});
