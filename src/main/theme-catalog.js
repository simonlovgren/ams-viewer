'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const contract = require('../shared/theme');

const CUSTOM_ID = /^theme-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const LIMIT = 65536;
const READ_FLAGS = fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0) | (fs.constants.O_NONBLOCK || 0);

function readText(file) {
  if (!fs.lstatSync(file).isFile()) throw new Error('Theme file must be a regular file');
  const descriptor = fs.openSync(file, READ_FLAGS);
  try {
    const stat = fs.fstatSync(descriptor);
    if (!stat.isFile() || stat.size > LIMIT) throw new Error('Theme file must be a regular file no larger than 64 KiB');
    const buffer = Buffer.alloc(LIMIT + 1);
    let length = 0;
    let count;
    while (length < buffer.length && (count = fs.readSync(descriptor, buffer, length, buffer.length - length, null))) length += count;
    if (length > LIMIT) throw new Error('Theme file exceeds 64 KiB');
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer.subarray(0, length));
  } finally {
    fs.closeSync(descriptor);
  }
}

async function readTheme(file) {
  if (!(await fs.promises.lstat(file)).isFile()) throw new Error('Theme file must be a regular file');
  const descriptor = await fs.promises.open(file, READ_FLAGS);
  try {
    const stat = await descriptor.stat();
    if (!stat.isFile() || stat.size > LIMIT) throw new Error('Theme file must be a regular file no larger than 64 KiB');
    const buffer = Buffer.alloc(LIMIT + 1);
    let length = 0;
    let count;
    while (length < buffer.length && (count = (await descriptor.read(buffer, length, buffer.length - length, null)).bytesRead)) length += count;
    if (length > LIMIT) throw new Error('Theme file exceeds 64 KiB');
    return contract.parse(new TextDecoder('utf-8', { fatal: true }).decode(buffer.subarray(0, length)));
  } finally {
    await descriptor.close();
  }
}

async function writeAtomic(file, text) {
  const temporary = `${file}.${randomUUID()}.tmp`;
  try {
    await fs.promises.writeFile(temporary, text, { mode: 0o600, flag: 'wx' });
    await fs.promises.rename(temporary, file);
  } finally {
    await fs.promises.rm(temporary, { force: true }).catch(() => {});
  }
}

function open(dataDir) {
  const builtins = new Map(['ams-dark', 'ams-light'].map((id) => {
    const theme = contract.parse(readText(path.join(__dirname, '../themes', `${id}.json`)));
    if (theme.name !== id) throw new Error(`Invalid built-in theme name: ${id}`);
    return [id, theme];
  }));
  const file = path.join(dataDir, 'themes.json');
  const directory = path.join(dataDir, 'themes');
  const customs = new Map();
  const themePath = (id) => path.join(directory, `${id}.json`);
  let activeId = 'ams-dark';
  let warning = null;
  let tail = Promise.resolve();
  try {
    const saved = JSON.parse(readText(file));
    if (!saved || saved.version !== 1 || typeof saved.activeId !== 'string'
      || Object.keys(saved).some((key) => !['version', 'activeId', 'themes'].includes(key))
      || (Object.hasOwn(saved, 'themes') && !Array.isArray(saved.themes))) throw new Error('Invalid theme catalog');
    const names = new Set([...builtins.keys()]);
    for (const entry of saved.themes || []) {
      if (!entry || Object.keys(entry).length !== 2 || typeof entry.id !== 'string' || !CUSTOM_ID.test(entry.id)
        || typeof entry.name !== 'string' || entry.name !== entry.name.trim() || !entry.name || entry.name.length > 80
        || /[\x00-\x1f\x7f-\x9f]/.test(entry.name) || customs.has(entry.id) || names.has(entry.name.toLowerCase())) {
        throw new Error('Invalid custom theme catalog entry');
      }
      names.add(entry.name.toLowerCase());
      customs.set(entry.id, { ...entry, theme: null, error: null });
    }
    let storageError = null;
    if (customs.size) {
      try {
        if (!fs.lstatSync(directory).isDirectory()) throw new Error('Theme storage is not a regular directory');
      } catch (error) { storageError = error; }
    }
    for (const entry of customs.values()) {
      try {
        if (storageError) throw storageError;
        const stored = themePath(entry.id);
        if (!fs.existsSync(stored) && fs.existsSync(stored + '.removing')) fs.renameSync(stored + '.removing', stored);
        entry.theme = contract.parse(readText(stored));
        if (entry.theme.name !== entry.name) throw new Error('Stored theme name does not match catalog');
      } catch (error) {
        entry.theme = null;
        entry.error = String(error.message || error);
      }
    }
    if (builtins.has(saved.activeId) || customs.get(saved.activeId)?.theme) activeId = saved.activeId;
    else warning = 'Could not restore the saved theme. Using ams-dark. Select a theme again to save a new preference.';
    if ([...customs.values()].some((entry) => entry.error)) warning ||= 'Some saved themes could not be loaded. Unavailable themes can be removed or re-imported with a different name.';
    if (fs.existsSync(directory) && fs.lstatSync(directory).isDirectory()) {
      for (const name of fs.readdirSync(directory)) {
        const id = name.replace(/\.json\.removing$/, '');
        if (name === `${id}.json.removing` && CUSTOM_ID.test(id) && !customs.has(id)) {
          try { fs.rmSync(path.join(directory, name), { force: true }); } catch {}
        }
      }
    }
  } catch (error) {
    customs.clear();
    if (error.code !== 'ENOENT') warning = 'Could not restore the saved theme. Using ams-dark. Select a theme again to save a new preference.';
  }

  const queue = (operation) => {
    const pending = tail.then(operation);
    tail = pending.catch(() => {});
    return pending;
  };
  const get = (id) => {
    if (typeof id !== 'string' || (!builtins.has(id) && !customs.has(id))) throw new Error('Theme not found');
    return builtins.get(id) || customs.get(id).theme;
  };
  const current = () => structuredClone(get(activeId));
  const list = () => [
    ...[...builtins].map(([id, theme]) => ({ id, name: theme.name, colorScheme: theme.colorScheme, builtIn: true, theme: structuredClone(theme), error: null })),
    ...[...customs.values()].map((entry) => ({ id: entry.id, name: entry.name, colorScheme: entry.theme?.colorScheme || null, builtIn: false, theme: structuredClone(entry.theme), error: entry.error })),
  ];
  const save = async (id, entries) => {
    const snapshot = { version: 1, activeId: id };
    if (entries.length) snapshot.themes = entries.map((entry) => ({ id: entry.id, name: entry.name }));
    const text = JSON.stringify(snapshot) + '\n';
    if (Buffer.byteLength(text) > LIMIT) throw new Error('Theme catalog exceeds 64 KiB');
    await fs.promises.mkdir(dataDir, { recursive: true });
    await writeAtomic(file, text);
  };
  const clearWarning = () => { warning = [...customs.values()].some((entry) => entry.error) ? 'Some saved themes could not be loaded. Remove unavailable themes before importing replacements.' : null; };
  const ensureStorage = async () => {
    await fs.promises.mkdir(directory, { recursive: true });
    const stat = await fs.promises.lstat(directory);
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('Theme storage is not a regular directory');
  };
  const readCustom = async (id) => {
    await ensureStorage();
    const theme = await readTheme(themePath(id));
    if (theme.name !== customs.get(id).name) throw new Error('Stored theme name does not match catalog');
    return theme;
  };
  return {
    current,
    list,
    activeId: () => activeId,
    warning: () => warning,
    activate(id) {
      return queue(async () => {
        get(id);
        const theme = builtins.get(id) || await readCustom(id);
        await save(id, [...customs.values()]);
        if (customs.has(id)) Object.assign(customs.get(id), { theme, error: null });
        activeId = id;
        clearWarning();
        return current();
      });
    },
    importFile(source) {
      return queue(async () => {
        if (typeof source !== 'string' || !/\.json$/i.test(source)) throw new Error('Select a .json theme file');
        const theme = await readTheme(source);
        if (list().some((entry) => entry.name.toLowerCase() === theme.name.toLowerCase())) throw new Error('Theme name already exists or is reserved');
        await ensureStorage();
        const entry = { id: `theme-${randomUUID()}`, name: theme.name, theme, error: null };
        const target = themePath(entry.id);
        await writeAtomic(target, JSON.stringify(theme, null, 2) + '\n');
        try {
          await save(activeId, [...customs.values(), entry]);
        } catch (error) {
          await fs.promises.rm(target, { force: true }).catch(() => {});
          throw error;
        }
        customs.set(entry.id, entry);
        clearWarning();
        return list().find((item) => item.id === entry.id);
      });
    },
    exportFile(id, destination) {
      return queue(async () => {
        get(id);
        if (typeof destination !== 'string' || !/\.json$/i.test(destination)) throw new Error('Save the theme as a .json file');
        const parent = await fs.promises.realpath(path.dirname(path.resolve(destination)));
        const target = path.join(parent, path.basename(destination));
        for (const protectedDirectory of [dataDir, path.join(__dirname, '..')]) {
          const protectedPath = await fs.promises.realpath(protectedDirectory).catch(() => path.resolve(protectedDirectory));
          const relative = path.relative(protectedPath, target);
          if (relative === '' || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative))) {
            throw new Error('Export outside application storage and bundled source files');
          }
        }
        const theme = builtins.get(id) || await readCustom(id);
        await writeAtomic(target, JSON.stringify(theme, null, 2) + '\n');
        return { id };
      });
    },
    remove(id) {
      return queue(async () => {
        get(id);
        if (builtins.has(id)) throw new Error('Built-in themes cannot be removed');
        await ensureStorage();
        const stored = themePath(id);
        const staged = stored + '.removing';
        let moved = false;
        try { await fs.promises.rename(stored, staged); moved = true; }
        catch (error) { if (error.code !== 'ENOENT') throw error; }
        const nextId = activeId === id ? 'ams-dark' : activeId;
        try {
          await save(nextId, [...customs.values()].filter((entry) => entry.id !== id));
        } catch (error) {
          if (moved) await fs.promises.rename(staged, stored);
          throw error;
        }
        customs.delete(id);
        activeId = nextId;
        clearWarning();
        if (moved) await fs.promises.rm(staged, { force: true }).catch(() => {});
        return { removedId: id, activeId, theme: current() };
      });
    },
  };
}

module.exports = { open };