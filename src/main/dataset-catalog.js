'use strict';
const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

const CATALOG_VERSION = 1;

function readCatalog(file) {
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (data.version !== CATALOG_VERSION || !Array.isArray(data.datasets)) throw new Error('Invalid dataset catalog');
  const ids = new Set();
  const names = new Set();
  for (const dataset of data.datasets) {
    if (!dataset || !/^(default|ds-[a-f0-9-]+)$/.test(dataset.id) || ids.has(dataset.id)) throw new Error('Invalid dataset catalog');
    if (typeof dataset.name !== 'string' || !dataset.name.trim() || typeof dataset.description !== 'string' || typeof dataset.initialized !== 'boolean') throw new Error('Invalid dataset catalog');
    const normalized = dataset.name.trim().toLowerCase();
    if (names.has(normalized)) throw new Error('Duplicate dataset name in catalog');
    ids.add(dataset.id);
    names.add(normalized);
  }
  if (!data.datasets.length || !ids.has(data.activeId)) throw new Error('Invalid active dataset in catalog');
  return data;
}

function open(dataDir) {
  const catalogFile = path.join(dataDir, 'datasets.json');
  const migrationFile = path.join(dataDir, 'datasets-migration.json');
  const databasesDir = path.join(dataDir, 'datasets');
  fs.mkdirSync(databasesDir, { recursive: true });
  let data;

  if (fs.existsSync(catalogFile)) {
    data = readCatalog(catalogFile);
    fs.rmSync(migrationFile, { force: true });
    recoverDatabaseStages(databasesDir, data);
  } else {
    const legacyPath = path.join(dataDir, 'ads.db');
    const defaultPath = path.join(databasesDir, 'default.db');
    const legacySidecars = ['-wal', '-shm'].filter((suffix) => fs.existsSync(legacyPath + suffix));
    if (fs.existsSync(legacyPath) && fs.existsSync(defaultPath)) throw new Error('Both legacy and dataset databases exist; refusing migration');
    if (!fs.existsSync(legacyPath) && legacySidecars.length && !fs.existsSync(defaultPath)) throw new Error('Legacy database sidecars exist without ads.db; refusing migration');
    if (fs.existsSync(legacyPath) || fs.existsSync(defaultPath) || fs.existsSync(migrationFile)) {
      if (!fs.existsSync(migrationFile)) fs.writeFileSync(migrationFile, JSON.stringify({ version: CATALOG_VERSION, dataset: 'default' }) + '\n', { mode: 0o600 });
      for (const suffix of ['', '-wal', '-shm']) {
        const source = legacyPath + suffix;
        const target = defaultPath + suffix;
        if (!fs.existsSync(source)) continue;
        if (fs.existsSync(target)) throw new Error(`Both legacy and dataset database files exist (${suffix || 'main'}); refusing migration`);
        fs.renameSync(source, target);
      }
    }
    data = { version: CATALOG_VERSION, activeId: 'default', datasets: [{ id: 'default', name: 'default', description: '' }] };
    data.datasets[0].initialized = fs.existsSync(defaultPath);
    writeCatalog(catalogFile, data);
    fs.rmSync(migrationFile, { force: true });
  }

  for (const dataset of data.datasets) {
    const databasePath = path.join(databasesDir, dataset.id === 'default' ? 'default.db' : `${dataset.id}.db`);
    if (dataset.initialized && !fs.existsSync(databasePath)) throw new Error(`Dataset database is missing: ${dataset.name}`);
  }

  const save = () => writeCatalog(catalogFile, data);
  const copy = () => JSON.parse(JSON.stringify(data));
  const publicDataset = ({ id, name, description }) => ({ id, name, description });
  const find = (id) => {
    const dataset = data.datasets.find((entry) => entry.id === id);
    if (!dataset) throw new Error('Dataset not found');
    return dataset;
  };
  const validateName = (name, exceptId) => {
    if (typeof name !== 'string' || !name.trim()) throw new Error('Dataset name cannot be blank');
    const clean = name.trim();
    if (data.datasets.some((entry) => entry.id !== exceptId && entry.name.trim().toLowerCase() === clean.toLowerCase())) {
      throw new Error('Dataset name already exists');
    }
    return clean;
  };

  return {
    snapshot: copy,
    restore(snapshot) {
      data = snapshot;
      save();
    },
    list: () => data.datasets.map(publicDataset),
    active: () => publicDataset(find(data.activeId)),
    isInitialized: (id) => find(id).initialized,
    databasePath: (id = data.activeId) => {
      find(id);
      return path.join(databasesDir, id === 'default' ? 'default.db' : `${id}.db`);
    },
    markInitialized(id) {
      const dataset = find(id);
      dataset.initialized = true;
      save();
    },
    ensureResetDefault() {
      if (!data.datasets.some((entry) => entry.id === 'default')) {
        data.datasets.push({ id: 'default', name: 'default', description: '', initialized: false });
        save();
      }
    },
    create(name, description = '') {
      const clean = validateName(name);
      if (typeof description !== 'string') throw new Error('Dataset description must be text');
      const dataset = { id: `ds-${randomUUID()}`, name: clean, description, initialized: false };
      data.datasets.push(dataset);
      save();
      return publicDataset(dataset);
    },
    update(id, name, description) {
      const current = find(id);
      const clean = validateName(name, id);
      if (typeof description !== 'string') throw new Error('Dataset description must be text');
      Object.assign(current, { name: clean, description });
      save();
      return publicDataset(current);
    },
    activate(id) {
      find(id);
      data.activeId = id;
      save();
      return publicDataset(find(id));
    },
    remove(id) {
      const removed = find(id);
      const remaining = data.datasets.filter((entry) => entry.id !== id);
      if (remaining.length) {
        if (data.activeId === id) data.activeId = remaining[0].id;
        data.datasets = remaining;
      } else {
        data.datasets = [{ id: 'default', name: 'default', description: '', initialized: false }];
        data.activeId = 'default';
      }
      save();
      return { dataset: publicDataset(removed), databasePath: path.join(databasesDir, id === 'default' ? 'default.db' : `${id}.db`) };
    },
  };
}

function writeCatalog(file, data) {
  const temporary = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(data, null, 2) + '\n', { mode: 0o600 });
  fs.renameSync(temporary, file);
}

function recoverDatabaseStages(databasesDir, data) {
  const files = fs.readdirSync(databasesDir);
  const referenced = new Set(data.datasets.map((dataset) => dataset.id === 'default' ? 'default.db' : `${dataset.id}.db`));
  for (const name of files) {
    const marker = name.indexOf('.delete-');
    if (marker < 0) continue;
    const originalName = name.slice(0, marker);
    const databaseName = originalName.replace(/-(wal|shm)$/, '');
    if (referenced.has(databaseName) && !fs.existsSync(path.join(databasesDir, originalName))) {
      fs.renameSync(path.join(databasesDir, name), path.join(databasesDir, originalName));
    } else {
      fs.rmSync(path.join(databasesDir, name), { force: true });
    }
  }
}

module.exports = { open };