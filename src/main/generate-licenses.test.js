'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const { generateManifest } = require('../../generate-licenses');

async function fixture(run) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ams-licenses-'));
  const write = (file, content) => {
    const target = path.join(root, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  };
  const packageFiles = (directory, name, license, files = { LICENSE: `${name} license` }) => {
    write(`${directory}/package.json`, JSON.stringify({ name, version: '1.2.3', license }));
    for (const [file, text] of Object.entries(files)) write(`${directory}/${file}`, text);
  };
  const lock = (packages) => write('package-lock.json', JSON.stringify({ lockfileVersion: 3, packages }));
  packageFiles('node_modules/electron', 'electron', 'MIT');
  write('node_modules/electron/dist/LICENSE', 'Electron license text');
  write('node_modules/electron/dist/LICENSES.chromium.html', '<html>Chromium notices</html>');
  try { await run({ root, write, packageFiles, lock }); }
  finally { fs.rmSync(root, { recursive: true, force: true }); }
}

test('manifest includes installed production packages and all root license/notice texts only', async () => {
  await fixture(({ root, packageFiles, lock }) => {
    packageFiles('node_modules/runtime', 'runtime', 'MIT', { LICENSE: 'MIT text', NOTICE: 'Copyright notices' });
    packageFiles('node_modules/runtime/node_modules/nested', 'nested', 'BSD-2-Clause');
    packageFiles('node_modules/dev-tool', 'dev-tool', 'ISC');
    lock({
      '': { devDependencies: { electron: '^44', 'dev-tool': '^1' }, dependencies: { runtime: '^1' } },
      'node_modules/electron': { version: '44.0.0', dev: true },
      'node_modules/runtime': { version: '1.2.3' },
      'node_modules/runtime/node_modules/nested': { version: '1.2.3' },
      'node_modules/dev-tool': { version: '1.2.3', dev: true },
    });

    const manifest = generateManifest(root);
    assert.deepEqual(manifest.components.map(({ name }) => name), ['Electron', 'nested', 'runtime']);
    assert.deepEqual(manifest.components.find(({ name }) => name === 'runtime').texts.map(({ file }) => file), ['LICENSE', 'NOTICE']);
    assert.equal(manifest.components.find(({ name }) => name === 'Electron').texts[0].text, 'Electron license text');
    assert.equal(manifest.chromiumNotices, 'LICENSES.chromium.html');
  });
});

test('manifest fails when a shipped component lacks license metadata or text', async () => {
  await fixture(({ root, packageFiles, lock, write }) => {
    packageFiles('node_modules/runtime', 'runtime', 'MIT', {});
    lock({ 'node_modules/electron': { version: '44.0.0', dev: true }, 'node_modules/runtime': { version: '1.2.3' } });
    assert.throws(() => generateManifest(root), /runtime: no license or notice text found/);
    write('node_modules/runtime/LICENSE', 'Runtime license');
    write('node_modules/runtime/package.json', JSON.stringify({ name: 'runtime', version: '1.2.3' }));
    assert.throws(() => generateManifest(root), /runtime: license metadata is missing/);
  });
});

test('manifest fails when Electron bundled notices are missing', async () => {
  await fixture(({ root, lock }) => {
    lock({ 'node_modules/electron': { version: '44.0.0', dev: true } });
    fs.rmSync(path.join(root, 'node_modules/electron/dist/LICENSES.chromium.html'));
    assert.throws(() => generateManifest(root), /Electron Chromium license notices are missing/);
  });
});