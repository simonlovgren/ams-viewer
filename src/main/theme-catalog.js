'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const contract = require('../shared/theme');

function open(dataDir) {
  const builtins = new Map(['ams-dark', 'ams-light'].map((id) => {
    const theme = contract.parse(fs.readFileSync(path.join(__dirname, '../themes', `${id}.json`), 'utf8'));
    if (theme.name !== id) throw new Error(`Invalid built-in theme name: ${id}`);
    return [id, theme];
  }));
  const file = path.join(dataDir, 'themes.json');
  let activeId = 'ams-dark';
  let warning = null;
  let tail = Promise.resolve();
  try {
    if (fs.statSync(file).size > 65536) throw new Error('Theme catalog exceeds 64 KiB');
    const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!saved || saved.version !== 1 || typeof saved.activeId !== 'string'
      || Object.keys(saved).length !== 2 || !builtins.has(saved.activeId)) throw new Error('Invalid or unavailable saved theme');
    activeId = saved.activeId;
  } catch (error) {
    if (error.code !== 'ENOENT') warning = 'Could not restore the saved theme. Using ams-dark. Select a theme again to save a new preference.';
  }

  const current = () => structuredClone(builtins.get(activeId));
  return {
    current,
    list: () => [...builtins].map(([id, theme]) => ({ id, name: theme.name, colorScheme: theme.colorScheme })),
    warning: () => warning,
    activate(id) {
      const operation = tail.then(async () => {
        if (typeof id !== 'string' || !builtins.has(id)) throw new Error('Theme not found');
        const temporary = `${file}.${randomUUID()}.tmp`;
        try {
          await fs.promises.mkdir(dataDir, { recursive: true });
          await fs.promises.writeFile(temporary, JSON.stringify({ version: 1, activeId: id }) + '\n', { mode: 0o600, flag: 'wx' });
          await fs.promises.rename(temporary, file);
        } finally {
          await fs.promises.rm(temporary, { force: true }).catch(() => {});
        }
        activeId = id;
        warning = null;
        return current();
      });
      tail = operation.catch(() => {});
      return operation;
    },
  };
}

module.exports = { open };