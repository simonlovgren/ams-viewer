'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const { load } = require('./third-party-licenses');

async function fixture(run) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ams-license-load-'));
  const write = async (file, content) => {
    const target = path.join(root, file);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, content);
  };
  try { await run({ root, write }); }
  finally { await fs.rm(root, { recursive: true, force: true }); }
}

test('loads manifest and Chromium notices from packaged Linux resources', async () => {
  await fixture(async ({ root, write }) => {
    await write('resources/third-party-licenses.json', JSON.stringify({ schemaVersion: 1, components: [{ name: 'Electron' }] }));
    await write('resources/LICENSES.chromium.html', '<div class="product">notices</div>');
    const result = await load({
      manifestPath: path.join(root, 'resources/third-party-licenses.json'),
      resourcesPath: path.join(root, 'resources'),
    });
    assert.deepEqual(result.components, [{ name: 'Electron' }]);
    assert.match(result.chromiumNoticesHtml, /class="product"/);
  });
});

test('finds Electron notices beside Linux and Windows resources directories', async () => {
  await fixture(async ({ root, write }) => {
    const resourcesPath = path.join(root, 'app/resources');
    await write('manifest.json', JSON.stringify({ schemaVersion: 1, components: [{ name: 'Electron' }] }));
    await write('app/LICENSES.chromium.html', '<div class="product"></div>');
    const result = await load({ manifestPath: path.join(root, 'manifest.json'), resourcesPath });
    assert.match(result.chromiumNoticesHtml, /class="product"/);
  });
});

test('finds Chromium notices in the macOS framework resource directory', async () => {
  await fixture(async ({ root, write }) => {
    const resourcesPath = path.join(root, 'App.app/Contents/Resources');
    await write('manifest.json', JSON.stringify({ schemaVersion: 1, components: [{ name: 'Electron' }] }));
    await write('App.app/Contents/Frameworks/Electron Framework.framework/Resources/LICENSES.chromium.html', '<div class="product"></div>');
    const result = await load({ manifestPath: path.join(root, 'manifest.json'), resourcesPath });
    assert.match(result.chromiumNoticesHtml, /class="product"/);
  });
});

test('rejects invalid manifests and missing Chromium notices', async () => {
  await fixture(async ({ root, write }) => {
    const manifestPath = path.join(root, 'manifest.json');
    await write('manifest.json', JSON.stringify({ schemaVersion: 2, components: [] }));
    await assert.rejects(load({ manifestPath, resourcesPath: root }), /manifest is invalid/);
    await write('manifest.json', JSON.stringify({ schemaVersion: 1, components: [{ name: 'Electron' }] }));
    await assert.rejects(load({ manifestPath, resourcesPath: root }), /Chromium license notices are missing/);
  });
});