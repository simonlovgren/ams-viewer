'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const theme = require('./theme');
const darkText = fs.readFileSync(path.join(__dirname, '../themes/ams-dark.json'), 'utf8');
const dark = JSON.parse(darkText);

test('ams-dark exactly matches the documented version-1 contract', () => {
  assert.deepEqual(theme.parse(darkText), dark);
  const reference = fs.readFileSync(path.join(__dirname, '../../docs/theming.md'), 'utf8');
  const section = reference.split('## Color reference')[1].split('## Font reference')[0];
  const documented = [...section.matchAll(/^\| `([a-zA-Z]+)` \|/gm)].map((match) => match[1]);
  assert.deepEqual([...theme.colorTokens].sort(), documented.sort());
  assert.equal(dark.name, 'ams-dark');
  assert.equal(dark.colors.background, '#0a0d18');
});

test('theme validation rejects incomplete, unknown, unsafe and incompatible values', () => {
  for (const change of [
    (value) => { value.schemaVersion = 2; },
    (value) => { value.colors.extra = '#ffffff'; },
    (value) => { delete value.colors.border; },
    (value) => { value.colors.background = '#00000080'; },
    (value) => { value.colors.border = 'url(https://example.com)'; },
    (value) => { value.fonts.default = 'Arial; color: red'; },
    (value) => { value.fonts.default = 'inherit, sans-serif'; },
    (value) => { value.fonts.default = '"Bad\u0085Font", sans-serif'; },
    (value) => { value.fonts.monospace = 'Arial, sans-serif'; },
    (value) => { value.name = ' '; },
    (value) => { value.colorScheme = 'auto'; },
  ]) {
    const value = structuredClone(dark);
    change(value);
    assert.throws(() => theme.validate(value));
  }
  assert.throws(() => theme.parse(darkText.replace('"schemaVersion": 1', '"schemaVersion": 1, "schemaVersion": 1')), /Duplicate/);
  assert.throws(() => theme.parse(' '.repeat(65537)), /64 KiB/);
  assert.throws(() => theme.parse('{'));
});

test('theme application sets only allowlisted properties without changing font mode or context', () => {
  const properties = new Map();
  const element = { style: { setProperty: (key, value) => properties.set(key, value) }, dataset: { monospace: 'false' } };
  theme.apply(dark, element);
  assert.equal(properties.size, theme.colorTokens.length + 3);
  assert.equal(properties.get('--theme-background'), '#0a0d18');
  assert.equal(properties.get('--theme-font-default'), dark.fonts.default);
  assert.equal(properties.get('--theme-font-monospace'), dark.fonts.monospace);
  assert.equal(properties.get('color-scheme'), 'dark');
  assert.deepEqual(element.dataset, { monospace: 'false', theme: 'ams-dark' });
  const invalid = structuredClone(dark);
  invalid.colors.border = 'bad';
  assert.throws(() => theme.apply(invalid, element));
  assert.equal(properties.size, theme.colorTokens.length + 3);
});

test('all runtime color consumers use documented theme properties and both font tokens', () => {
  const files = ['renderer/styles.css', 'renderer/splash.css', 'renderer/app.js', 'main/main.js'];
  const source = files.map((file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8')).join('\n');
  assert.doesNotMatch(source, /#[\da-f]{3,8}\b|\brgba?\(|\bhsla?\(/i);
  const used = new Set([...source.matchAll(/var\((--theme-[a-z-]+)\)/g)].map((match) => match[1]));
  const expected = new Set([...theme.colorTokens.map(theme.property), '--theme-font-default', '--theme-font-monospace']);
  assert.deepEqual([...used].sort(), [...expected].sort());
  assert.equal((source.match(/backgroundColor: currentTheme.colors.background/g) || []).length, 2);
  assert.doesNotMatch(source, /color-scheme:\s*dark/);
});

test('both windows bootstrap the validated theme before loading styles without changing font mode', () => {
  const core = fs.readFileSync(path.join(__dirname, 'theme.js'), 'utf8');
  const bootstrap = fs.readFileSync(path.join(__dirname, '../renderer/theme.js'), 'utf8');
  for (const bridge of ['api', 'splash']) {
    const properties = new Map();
    const element = { style: { setProperty: (key, value) => properties.set(key, value) }, dataset: { monospace: 'true' } };
    const context = vm.createContext({ window: { [bridge]: { theme: dark } }, document: { documentElement: element } });
    vm.runInContext(core, context);
    vm.runInContext(bootstrap, context);
    assert.equal(properties.get('--theme-background'), dark.colors.background);
    assert.equal(element.dataset.monospace, 'true');
    const html = fs.readFileSync(path.join(__dirname, '../renderer', bridge === 'api' ? 'index.html' : 'splash.html'), 'utf8');
    assert.ok(html.indexOf('src="../shared/theme.js"') < html.indexOf('src="theme.js"'));
    assert.ok(html.indexOf('src="theme.js"') < html.indexOf('rel="stylesheet"'));
    const preload = fs.readFileSync(path.join(__dirname, '../main', bridge === 'api' ? 'preload.js' : 'splash-preload.js'), 'utf8');
    assert.match(preload, /theme: ipcRenderer.sendSync\('theme:current'\)/);
  }
});