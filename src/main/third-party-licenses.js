'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');

function noticeCandidates(resourcesPath, electronDistPath) {
  const roots = [
    resourcesPath,
    path.resolve(resourcesPath, '..'),
    path.resolve(resourcesPath, '../Frameworks/Electron Framework.framework/Resources'),
    path.resolve(resourcesPath, '../Frameworks/Electron Framework.framework/Versions/A/Resources'),
    electronDistPath,
  ].filter(Boolean);
  return roots.map((root) => path.join(root, 'LICENSES.chromium.html'));
}

async function load({ manifestPath, resourcesPath, electronDistPath }) {
  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
  if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.components) || !manifest.components.length) {
    throw new Error('Generated third-party license manifest is invalid');
  }
  let chromiumPath;
  for (const candidate of noticeCandidates(resourcesPath, electronDistPath)) {
    try { await fs.access(candidate); chromiumPath = candidate; break; }
    catch { /* try the next Electron resource location */ }
  }
  if (!chromiumPath) throw new Error('Bundled Chromium license notices are missing');
  const chromiumNoticesHtml = await fs.readFile(chromiumPath, 'utf8');
  if (!chromiumNoticesHtml.includes('class="product"')) throw new Error('Bundled Chromium license notices are invalid');
  return { components: manifest.components, chromiumNoticesHtml };
}

module.exports = { load, noticeCandidates };