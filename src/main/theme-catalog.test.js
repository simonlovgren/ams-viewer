'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const catalog = require('./theme-catalog');
const contract = require('../shared/theme');

function temporary(context) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ams-theme-test-'));
  context.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return directory;
}

test('both built-ins have identical complete contracts and independent snapshots', (context) => {
  const themes = catalog.open(temporary(context));
  assert.deepEqual(themes.list().map((entry) => entry.id), ['ams-dark', 'ams-light']);
  const dark = themes.current();
  const light = contract.parse(fs.readFileSync(path.join(__dirname, '../themes/ams-light.json'), 'utf8'));
  assert.deepEqual(Object.keys(light.colors), Object.keys(dark.colors));
  assert.deepEqual(Object.keys(light.fonts), Object.keys(dark.fonts));
  assert.equal(light.colorScheme, 'light');
  dark.colors.background = '#000000';
  assert.equal(themes.current().colors.background, '#0a0d18');
  assert.equal(themes.warning(), null);
});

test('theme selection persists atomically across restarts without dataset or font settings', async (context) => {
  const directory = temporary(context);
  const themes = catalog.open(directory);
  fs.writeFileSync(path.join(directory, 'datasets.json'), 'dataset sentinel');
  assert.equal((await themes.activate('ams-light')).name, 'ams-light');
  assert.equal(catalog.open(directory).current().name, 'ams-light');
  assert.equal(fs.readFileSync(path.join(directory, 'datasets.json'), 'utf8'), 'dataset sentinel');
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(directory, 'themes.json'), 'utf8')), { version: 1, activeId: 'ams-light' });
  assert.deepEqual(fs.readdirSync(directory).sort(), ['datasets.json', 'themes.json']);
  await Promise.all([themes.activate('ams-dark'), themes.activate('ams-light')]);
  assert.equal(themes.current().name, 'ams-light');
  assert.equal(catalog.open(directory).current().name, 'ams-light');
});

test('corrupt, oversized and unavailable selections recover visibly without overwriting evidence', async (context) => {
  const directory = temporary(context);
  const file = path.join(directory, 'themes.json');
  for (const text of ['{', 'null', '{"version":2,"activeId":"ams-light"}', '{"version":1,"activeId":"missing"}', ' '.repeat(65537)]) {
    fs.writeFileSync(file, text);
    const themes = catalog.open(directory);
    assert.equal(themes.current().name, 'ams-dark');
    assert.match(themes.warning(), /Could not restore/);
    assert.equal(fs.readFileSync(file, 'utf8'), text);
    await themes.activate('ams-light');
    assert.equal(themes.warning(), null);
    assert.equal(catalog.open(directory).current().name, 'ams-light');
  }
});

test('invalid IDs and failed writes preserve current selection and allow subsequent recovery', async (context) => {
  const directory = temporary(context);
  const themes = catalog.open(directory);
  await assert.rejects(themes.activate('../ams-light'), /Theme not found/);
  await assert.rejects(themes.activate({ id: 'ams-light' }), /Theme not found/);
  fs.mkdirSync(path.join(directory, 'themes.json'));
  await assert.rejects(themes.activate('ams-light'));
  assert.equal(themes.current().name, 'ams-dark');
  assert.deepEqual(fs.readdirSync(directory), ['themes.json']);
  fs.rmdirSync(path.join(directory, 'themes.json'));
  await themes.activate('ams-light');
  assert.equal(themes.current().name, 'ams-light');
});

test('light palette keeps body, control, tag and gradient text readable', (context) => {
  const themes = catalog.open(temporary(context));
  const light = contract.parse(fs.readFileSync(path.join(__dirname, '../themes/ams-light.json'), 'utf8'));
  const colors = light.colors;
  const channels = (color) => [1, 3, 5].map((offset) => parseInt(color.slice(offset, offset + 2), 16) / 255);
  const luminance = (color) => channels(color).map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
    .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
  const contrast = (foreground, background) => {
    const values = [luminance(foreground), luminance(background)].sort((left, right) => right - left);
    return (values[0] + 0.05) / (values[1] + 0.05);
  };
  const composite = (foreground, background) => {
    const alpha = foreground.length === 9 ? parseInt(foreground.slice(-2), 16) / 255 : 1;
    const beneath = channels(background);
    return '#' + channels(foreground).map((value, index) => Math.round((value * alpha + beneath[index] * (1 - alpha)) * 255).toString(16).padStart(2, '0')).join('');
  };
  for (const surface of ['background', 'sidebarBackground', 'surface', 'surfaceHover']) {
    for (const text of ['textPrimary', 'textSecondary', 'textMuted', 'textDescription', 'error']) {
      assert.ok(contrast(colors[text], colors[surface]) >= 4.5, `${text} on ${surface}`);
    }
    for (const dimension of ['location', 'field', 'group', 'occupation', 'other']) {
      assert.ok(contrast(colors[dimension + 'Text'], composite(colors[dimension + 'Background'], colors[surface])) >= 4.5, `${dimension} on ${surface}`);
    }
  }
  for (const stop of ['gradientStart', 'gradientSecond', 'gradientThird', 'gradientEnd']) {
    assert.ok(contrast(colors.textOnAccent, colors[stop]) >= 4.5, `button text on ${stop}`);
    assert.ok(contrast(colors[stop], colors.sidebarBackground) >= 4.5, `chart/text gradient ${stop}`);
  }
  assert.ok(contrast(colors.findCurrentText, colors.findCurrentBackground) >= 4.5);
  assert.ok(contrast(colors.switchThumb, colors.switchTrack) >= 3);
  assert.equal(themes.current().name, 'ams-dark');
});

test('live theme events preserve font mode and renderer context in both windows', () => {
  const vm = require('node:vm');
  const core = fs.readFileSync(path.join(__dirname, '../shared/theme.js'), 'utf8');
  const bootstrap = fs.readFileSync(path.join(__dirname, '../renderer/theme.js'), 'utf8');
  const dark = contract.parse(fs.readFileSync(path.join(__dirname, '../themes/ams-dark.json'), 'utf8'));
  const light = contract.parse(fs.readFileSync(path.join(__dirname, '../themes/ams-light.json'), 'utf8'));
  for (const bridgeName of ['api', 'splash']) {
    let update;
    const properties = new Map();
    const root = { style: { setProperty: (key, value) => properties.set(key, value) }, dataset: { monospace: 'false' } };
    const context = vm.createContext({ window: { [bridgeName]: { theme: light, onTheme: (callback) => { update = callback; } } }, document: { documentElement: root } });
    vm.runInContext(core, context);
    vm.runInContext(bootstrap, context);
    assert.equal(root.dataset.theme, 'ams-light');
    assert.equal(properties.get('color-scheme'), 'light');
    update(dark);
    assert.equal(root.dataset.theme, 'ams-dark');
    assert.equal(root.dataset.monospace, 'false');
    assert.equal(properties.get('color-scheme'), 'dark');
    update(light);
    assert.equal(properties.get('--theme-background'), light.colors.background);
    assert.equal(root.dataset.monospace, 'false');
  }
});

test('theme IPC persists before updating windows, reports failures and replays recovery warnings', async (context) => {
  const vm = require('node:vm');
  const directory = temporary(context);
  const file = path.join(directory, 'themes.json');
  fs.writeFileSync(file, '{');
  const themes = catalog.open(directory);
  const source = fs.readFileSync(path.join(__dirname, 'main.js'), 'utf8');
  const handlers = new Map();
  const events = [];
  const webContents = { send: (channel, value) => events.push([channel, value.name]) };
  const window = {
    webContents,
    isDestroyed: () => false,
    setBackgroundColor: (value) => {
      assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).activeId, themes.current().name);
      events.push(['background', value]);
    },
  };
  const sandbox = vm.createContext({
    themes, win: window, BrowserWindow: { getAllWindows: () => [window, { isDestroyed: () => true }] },
    ipcMain: { handle: (name, callback) => handlers.set(name, callback), on() {} },
    process: { env: {} }, tasks: new Map(), summaryState: { state: 'ready' },
    errorText: (error) => error.message, sendTask: (...args) => events.push(args),
  });
  const code = source.slice(source.indexOf('function registerHandlers()'), source.indexOf("app.on('window-all-closed'"));
  vm.runInContext('let currentTheme = themes.current();\n' + code + '\nregisterHandlers();', sandbox);
  assert.match(handlers.get('tasks:list')()[0].text, /Could not restore/);
  assert.equal(handlers.get('tasks:list')()[0].state, 'error');
  await assert.rejects(handlers.get('themes:activate')({ sender: {} }, 'ams-light'), /main window/);
  assert.equal(events.length, 0);
  await handlers.get('themes:activate')({ sender: webContents }, 'ams-light');
  assert.deepEqual(events, [['background', '#f6f7f9'], ['theme:changed', 'ams-light']]);
  assert.equal(handlers.get('themes:list')().activeId, 'ams-light');
  assert.equal(handlers.get('tasks:list')().length, 0);
  fs.rmSync(file);
  fs.mkdirSync(file);
  await assert.rejects(handlers.get('themes:activate')({ sender: webContents }, 'ams-dark'));
  assert.equal(handlers.get('themes:list')().activeId, 'ams-light');
  assert.equal(events.length, 3);
  assert.deepEqual(events.at(-1).slice(0, 2), ['theme', 'error']);
  assert.match(events.at(-1)[2], /Could not change theme/);
  assert.ok(source.indexOf("app.setPath('userData'") < source.indexOf('themeCatalog.open('));
  assert.ok(source.indexOf('themeCatalog.open(') < source.indexOf('await createSplash()'));
});

test('custom themes import as isolated copies, activate after restart, export and delete safely', async (context) => {
  const directory = temporary(context);
  const dataDir = path.join(directory, 'config');
  const source = path.join(directory, 'custom.json');
  const output = path.join(directory, 'copy.json');
  const theme = { ...catalog.open(dataDir).current(), name: 'Custom palette' };
  const original = JSON.stringify(theme);
  fs.writeFileSync(source, original);
  const themes = catalog.open(dataDir);
  const imported = await themes.importFile(source);
  assert.match(imported.id, /^theme-[a-f0-9-]+$/);
  assert.equal(imported.builtIn, false);
  assert.deepEqual(imported.theme, theme);
  assert.equal(themes.activeId(), 'ams-dark');
  assert.equal(catalog.open(dataDir).list().length, 3);
  await themes.activate(imported.id);
  assert.equal(catalog.open(dataDir).current().name, theme.name);
  await themes.exportFile(imported.id, output);
  assert.deepEqual(contract.parse(fs.readFileSync(output, 'utf8')), theme);
  await themes.exportFile('ams-light', output);
  assert.equal(contract.parse(fs.readFileSync(output, 'utf8')).name, 'ams-light');
  const removed = await themes.remove(imported.id);
  assert.equal(removed.activeId, 'ams-dark');
  assert.equal(catalog.open(dataDir).list().length, 2);
  assert.deepEqual(fs.readdirSync(path.join(dataDir, 'themes')), []);
  assert.equal(fs.readFileSync(source, 'utf8'), original);
});

test('invalid theme imports and reserved names leave library and selection unchanged', async (context) => {
  const directory = temporary(context);
  const dataDir = path.join(directory, 'config');
  const source = path.join(directory, 'input.json');
  const themes = catalog.open(dataDir);
  await themes.activate('ams-light');
  const before = fs.readFileSync(path.join(dataDir, 'themes.json'), 'utf8');
  const base = themes.current();
  for (const text of ['{', ' '.repeat(65537), JSON.stringify(base), JSON.stringify({ ...base, name: 'AMS-DARK' }), JSON.stringify({ ...base, name: 'Unsafe', colors: { ...base.colors, background: 'url(file:///etc/passwd)' } })]) {
    fs.writeFileSync(source, text);
    await assert.rejects(themes.importFile(source));
    assert.equal(themes.list().length, 2);
    assert.equal(themes.activeId(), 'ams-light');
    assert.equal(fs.readFileSync(path.join(dataDir, 'themes.json'), 'utf8'), before);
  }
  fs.writeFileSync(source, JSON.stringify({ ...base, name: 'Distinct' }));
  await themes.importFile(source);
  fs.writeFileSync(source, JSON.stringify({ ...base, name: 'distinct' }));
  await assert.rejects(themes.importFile(source), /already exists/);
  await assert.rejects(themes.importFile(source + '.txt'), /\.json/);
  await assert.rejects(themes.remove('ams-dark'), /Built-in/);
  await assert.rejects(themes.remove('ams-light'), /Built-in/);
});

test('failed import and removal commits roll back files and preserve active state', async (context) => {
  const directory = temporary(context);
  const dataDir = path.join(directory, 'config');
  const source = path.join(directory, 'input.json');
  const themes = catalog.open(dataDir);
  fs.writeFileSync(source, JSON.stringify({ ...themes.current(), name: 'Rollback' }));
  fs.mkdirSync(path.join(dataDir, 'themes.json'), { recursive: true });
  await assert.rejects(themes.importFile(source));
  assert.equal(themes.list().length, 2);
  assert.deepEqual(fs.readdirSync(path.join(dataDir, 'themes')), []);
  fs.rmdirSync(path.join(dataDir, 'themes.json'));
  const imported = await themes.importFile(source);
  await themes.activate(imported.id);
  const previous = fs.readFileSync(path.join(dataDir, 'themes.json'), 'utf8');
  fs.rmSync(path.join(dataDir, 'themes.json'));
  fs.mkdirSync(path.join(dataDir, 'themes.json'));
  await assert.rejects(themes.remove(imported.id));
  assert.equal(themes.current().name, 'Rollback');
  assert.deepEqual(fs.readdirSync(path.join(dataDir, 'themes')), [`${imported.id}.json`]);
  fs.rmdirSync(path.join(dataDir, 'themes.json'));
  fs.writeFileSync(path.join(dataDir, 'themes.json'), previous);
  assert.equal(catalog.open(dataDir).current().name, 'Rollback');
});

test('damaged custom files remain listed without hiding valid themes or blocking recovery', async (context) => {
  const directory = temporary(context);
  const dataDir = path.join(directory, 'config');
  const source = path.join(directory, 'input.json');
  const themes = catalog.open(dataDir);
  const entries = [];
  for (const name of ['Healthy', 'Damaged']) {
    fs.writeFileSync(source, JSON.stringify({ ...themes.current(), name }));
    entries.push(await themes.importFile(source));
  }
  await themes.activate(entries[1].id);
  fs.writeFileSync(path.join(dataDir, 'themes', `${entries[1].id}.json`), '{');
  const restored = catalog.open(dataDir);
  assert.equal(restored.activeId(), 'ams-dark');
  assert.match(restored.warning(), /Could not restore/);
  assert.equal(restored.list().length, 4);
  assert.ok(restored.list().find((entry) => entry.id === entries[1].id).error);
  assert.ok(restored.list().find((entry) => entry.id === entries[0].id).theme);
  await restored.activate(entries[0].id);
  await restored.remove(entries[1].id);
  assert.equal(restored.current().name, 'Healthy');
  assert.equal(restored.warning(), null);
  fs.rmSync(path.join(dataDir, 'themes'), { recursive: true });
  const missing = catalog.open(dataDir);
  assert.equal(missing.list().length, 3);
  assert.equal(missing.activeId(), 'ams-dark');
  assert.ok(missing.warning());
  await missing.remove(entries[0].id);
  assert.equal(missing.list().length, 2);
});

test('interrupted deletion restores pre-commit files and cleans committed stages', async (context) => {
  const directory = temporary(context);
  const dataDir = path.join(directory, 'config');
  const source = path.join(directory, 'input.json');
  const themes = catalog.open(dataDir);
  fs.writeFileSync(source, JSON.stringify({ ...themes.current(), name: 'Recover me' }));
  const imported = await themes.importFile(source);
  await themes.activate(imported.id);
  const stored = path.join(dataDir, 'themes', `${imported.id}.json`);
  fs.renameSync(stored, stored + '.removing');
  assert.equal(catalog.open(dataDir).current().name, 'Recover me');
  assert.ok(fs.existsSync(stored));
  fs.renameSync(stored, stored + '.removing');
  fs.writeFileSync(path.join(dataDir, 'themes.json'), JSON.stringify({ version: 1, activeId: 'ams-dark' }));
  assert.equal(catalog.open(dataDir).list().length, 2);
  assert.equal(fs.existsSync(stored + '.removing'), false);
});

test('theme file operations reject invalid UTF-8, duplicate keys, links and protected export paths', async (context) => {
  const directory = temporary(context);
  const dataDir = path.join(directory, 'config');
  const source = path.join(directory, 'input.json');
  const output = path.join(directory, 'output.json');
  const themes = catalog.open(dataDir);
  await themes.activate('ams-dark');
  const text = JSON.stringify({ ...themes.current(), name: 'Safe' });
  for (const value of [Buffer.from([0xff, 0xfe]), text.replace('"schemaVersion":1', '"schemaVersion":1,"schemaVersion":1')]) {
    fs.writeFileSync(source, value);
    await assert.rejects(themes.importFile(source));
  }
  fs.writeFileSync(source, text);
  const linked = path.join(directory, 'linked.json');
  fs.symlinkSync(source, linked);
  await assert.rejects(themes.importFile(linked), /regular file/);
  await assert.rejects(themes.exportFile('ams-dark', path.join(dataDir, 'themes.json')), /outside/);
  await assert.rejects(themes.exportFile('ams-dark', path.join(__dirname, '../themes/ams-dark.json')), /outside/);
  await assert.rejects(themes.exportFile('../ams-dark', output), /not found/);
  await assert.rejects(themes.exportFile('ams-dark', output + '.txt'), /\.json/);
  fs.mkdirSync(output);
  await assert.rejects(themes.exportFile('ams-dark', output));
  assert.equal(themes.activeId(), 'ams-dark');
  assert.equal(themes.list().length, 2);
});

test('theme dialog IPC cancellation, successful operations and errors use isolated file paths', async (context) => {
  const vm = require('node:vm');
  const directory = temporary(context);
  const dataDir = path.join(directory, 'config');
  const source = path.join(directory, 'input.json');
  const output = path.join(directory, 'output.json');
  const themes = catalog.open(dataDir);
  fs.writeFileSync(source, JSON.stringify({ ...themes.current(), name: 'Dialog import' }));
  const handlers = new Map();
  const notices = [];
  const updates = [];
  const webContents = { send: (channel, theme) => updates.push([channel, theme.name]) };
  const window = { webContents, isDestroyed: () => false, setBackgroundColor() {} };
  let openResult = { canceled: true, filePaths: [] };
  let saveResult = { canceled: true };
  const sandbox = vm.createContext({ themes, win: window, BrowserWindow: { getAllWindows: () => [window] },
    ipcMain: { handle: (name, callback) => handlers.set(name, callback), on() {} },
    dialog: { showOpenDialog: async () => openResult, showSaveDialog: async () => saveResult },
    process: { env: {} }, tasks: new Map(), summaryState: { state: 'ready' },
    errorText: (error) => error.message, sendTask: (...args) => notices.push(args),
  });
  const main = fs.readFileSync(path.join(__dirname, 'main.js'), 'utf8');
  const code = main.slice(main.indexOf('function registerHandlers()'), main.indexOf("app.on('window-all-closed'"));
  vm.runInContext('let currentTheme = themes.current();\n' + code + '\nregisterHandlers();', sandbox);
  const event = { sender: webContents };
  assert.equal((await handlers.get('themes:import')(event)).canceled, true);
  assert.equal((await handlers.get('themes:export')(event, 'ams-dark')).canceled, true);
  assert.equal(themes.list().length, 2);
  assert.equal(fs.existsSync(output), false);
  for (const name of ['themes:import', 'themes:export', 'themes:delete']) await assert.rejects(handlers.get(name)({ sender: {} }, 'ams-dark'), /main window/);
  openResult = { canceled: false, filePaths: [source] };
  const imported = await handlers.get('themes:import')(event);
  assert.equal(imported.ok, true);
  await handlers.get('themes:activate')(event, imported.theme.id);
  saveResult = { canceled: false, filePath: output };
  assert.equal((await handlers.get('themes:export')(event, imported.theme.id)).ok, true);
  assert.equal(contract.parse(fs.readFileSync(output, 'utf8')).name, 'Dialog import');
  assert.equal((await handlers.get('themes:delete')(event, imported.theme.id)).activeId, 'ams-dark');
  assert.deepEqual(updates.at(-1), ['theme:changed', 'ams-dark']);
  await assert.rejects(handlers.get('themes:delete')(event, 'ams-dark'), /Built-in/);
  openResult = { canceled: false, filePaths: [source, output] };
  await assert.rejects(handlers.get('themes:import')(event), /Select one/);
  assert.ok(notices.some((notice) => notice[1] === 'error'));
  assert.equal(notices.at(-1)[1], 'done');
  assert.equal(notices.filter((notice) => notice[1] === 'running').length, notices.filter((notice) => notice[1] === 'done').length);
});

test('concurrent duplicate imports serialize and later removal does not change another active theme', async (context) => {
  const directory = temporary(context);
  const dataDir = path.join(directory, 'config');
  const source = path.join(directory, 'input.json');
  const themes = catalog.open(dataDir);
  fs.writeFileSync(source, JSON.stringify({ ...themes.current(), name: 'Concurrent' }));
  const results = await Promise.allSettled([themes.importFile(source), themes.importFile(source)]);
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(results.filter((result) => result.status === 'rejected').length, 1);
  const imported = themes.list().find((entry) => !entry.builtIn);
  await themes.activate('ams-light');
  await themes.remove(imported.id);
  assert.equal(themes.activeId(), 'ams-light');
  assert.equal(catalog.open(dataDir).activeId(), 'ams-light');
});