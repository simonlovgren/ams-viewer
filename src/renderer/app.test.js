'use strict';
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { test } = require('node:test');
const vm = require('node:vm');

function rendererContext(document = { querySelectorAll: () => [] }, globals = {}) {
  const source = readFileSync(require.resolve('./app.js'), 'utf8');
  const context = vm.createContext({ Intl, document, ...globals });
  vm.runInContext("const F = {sel: [], loc: [], employers: []}; const expanded = new Set(); let fseq = 0; const icon = () => '';" +
    source.slice(source.indexOf('  const esc ='), source.indexOf('  /* ---------- filter state')) +
    source.slice(source.indexOf('  let facetData ='), source.indexOf('  /* ---------- ads-over-time chart')), context);
  return expression => vm.runInContext(expression, context);
}

test('compact counts retain exact hover values and round across units', () => {
  const evaluate = rendererContext();
  for (const [value, expected] of [[0, '0'], [999, '999'], [1000, '1k'], [12500, '12.5k'], [999999, '1M'], [11252350, '11.3M']]) {
    assert.equal(evaluate(`fmtCount(${value})`), expected);
  }
  assert.match(evaluate('countHtml(11252350)'), /title="11,252,350">11.3M/);
});

test('top employers render escaped names, compact counts and full-name tooltips', () => {
  const employerWidget = { innerHTML: '' };
  const evaluate = rendererContext({ querySelectorAll: () => [] }, { $: selector => selector === '#widget-employers' ? employerWidget : null });
  evaluate(`renderEmployers([{v:'<Company & Sons>',n:12500}])`);
  assert.match(employerWidget.innerHTML, /title="&lt;Company &amp; Sons&gt;"/);
  assert.match(employerWidget.innerHTML, /&lt;Company &amp; Sons&gt;/);
  assert.match(employerWidget.innerHTML, /title="12,500">12\.5k/);
  assert.match(employerWidget.innerHTML, /<button type="button"/);
  assert.match(employerWidget.innerHTML, /data-employer="&lt;Company &amp; Sons&gt;" aria-pressed="false"/);
  evaluate(`F.employers = ['<Company & Sons>']; renderEmployers([{v:'<Company & Sons>',n:12500}])`);
  assert.match(employerWidget.innerHTML, /employer-chip on/);
  assert.match(employerWidget.innerHTML, /aria-pressed="true"/);
});

test('employer toggles, chips and Clear all preserve unrelated state and persist session filters', () => {
  const source = readFileSync(require.resolve('./app.js'), 'utf8');
  const stored = new Map();
  const elements = new Map();
  const element = selector => {
    if (!elements.has(selector)) elements.set(selector, {
      value: '', innerHTML: '', classList: { toggle() {} },
      addEventListener(name, listener) { this[name] = listener; },
    });
    return elements.get(selector);
  };
  const timers = [];
  let pending = 0;
  const context = vm.createContext({
    $: element, esc: value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;'), icon: () => '',
    sessionStorage: { getItem: key => stored.get(key), setItem: (key, value) => stored.set(key, value) },
    localStorage: { removeItem() {}, getItem() { return null; }, setItem() {} },
    setTimeout: callback => { timers.push(callback); return timers.length; }, clearTimeout() {},
    reload() {}, updateWidgets() {}, markFacetsPending() { pending++; },
  });
  const state = source.slice(source.indexOf('  const DEF ='), source.indexOf('  /* ---------- collapsible widgets'));
  const controls = source.slice(source.indexOf("  $('#widget-employers').addEventListener"), source.indexOf('  /* ---------- ad view'));
  vm.runInContext(state + controls, context);
  const snapshot = () => JSON.parse(vm.runInContext('JSON.stringify(F)', context));
  const original = { terms: ['Engineer'], termMode: 'or', sel: [{ k: 'field', id: 'IT', label: 'IT' }], loc: [{ k: 'region', id: 'North', label: 'North' }], from: '2026-01-01', to: '2026-12-31', emp: 'Permanent', hours: 'Full time', sort: 'oldest' };
  vm.runInContext(`setF(${JSON.stringify(original)})`, context);
  element('#q').value = 'uncommitted text';
  const toggle = name => element('#widget-employers').click({ target: { closest: () => ({ dataset: { employer: name } }) } });
  toggle('<Acme & Sons>');
  toggle('acme');
  assert.deepEqual(snapshot(), { ...original, employers: ['<Acme & Sons>', 'acme'] });
  assert.equal(element('#q').value, 'uncommitted text');
  assert.match(element('#active').innerHTML, /<button type="button"[^>]+aria-label="Remove Employer: &lt;Acme &amp; Sons>"/);
  assert.match(element('#active').innerHTML, /Employer: acme/);
  toggle('acme');
  assert.deepEqual(snapshot().employers, ['<Acme & Sons>']);
  toggle('acme');
  element('#active').onclick({ target: { closest: () => ({ dataset: { i: '5' } }) } });
  assert.deepEqual(snapshot(), { ...original, employers: ['acme'] });
  assert.deepEqual(JSON.parse(stored.get('filters')), snapshot());
  const restored = vm.createContext({
    sessionStorage: { getItem: key => stored.get(key) },
    localStorage: { removeItem() {}, getItem() { return null; } },
  });
  vm.runInContext(state, restored);
  assert.deepEqual(JSON.parse(vm.runInContext('JSON.stringify(F)', restored)), snapshot());
  assert.equal(pending, 6);
  assert.equal(timers.length, 6);
  element('#clear-all').click();
  assert.deepEqual(snapshot().employers, []);
  assert.deepEqual(snapshot().terms, []);
  assert.equal(snapshot().sort, 'oldest');
  assert.equal(element('#q').value, '');
  assert.doesNotMatch(element('#active').innerHTML, /Employer:/);
});

test('ad-view find matches case-insensitively and ignores empty queries', () => {
  const evaluate = rendererContext();
  assert.equal(evaluate("JSON.stringify(matchRanges('Örebro söker sjuksköterska i ÖREBRO', 'örebro'))"), '[{"start":0,"end":6},{"start":29,"end":35}]');
  assert.equal(evaluate("matchRanges('some ad text', '   ').length"), 0);
  assert.equal(evaluate("matchRanges('nothing here', 'else').length"), 0);
});

test('slash focuses ad find without navigating, and list search in other views', () => {
  const source = readFileSync(require.resolve('./app.js'), 'utf8');
  for (const view of ['ad', 'list', 'data', 'settings']) {
    for (const target of [{ tagName: 'BODY' }, { tagName: 'INPUT' }, { tagName: 'TEXTAREA' }, { tagName: 'SELECT' }, { tagName: 'DIV', isContentEditable: true }]) {
      let keydown, focused, prevented = false;
      const navigations = [];
      const dialog = { open: false, addEventListener() {}, showModal() { dialog.open = true; }, close() {} };
      const close = { addEventListener() {}, focus() {} };
      const context = vm.createContext({
        curView: view,
        document: { addEventListener: (name, listener) => { if (name === 'keydown') keydown = listener; } },
        $: selector => selector === '#shortcut-help' ? dialog : selector === '#shortcut-close' ? close : ({ focus: () => { focused = selector; } }),
        nav: destination => navigations.push(destination),
      });
      vm.runInContext(source.slice(source.indexOf('  const editable ='), source.indexOf("  document.addEventListener('mouseup'")), context);
      keydown({ key: '/', target, preventDefault: () => { prevented = true; } });
      const editableTarget = target.tagName !== 'BODY';
      assert.equal(prevented, !editableTarget);
      assert.equal(focused, editableTarget ? undefined : view === 'ad' ? '#ad-find' : '#q');
      assert.deepEqual(navigations, editableTarget || view === 'ad' ? [] : ['list']);
    }
  }
});

test('shortcut help opens the active view, ignores editable targets and restores focus', () => {
  const source = readFileSync(require.resolve('./app.js'), 'utf8');
  for (const view of ['list', 'ad', 'data', 'settings']) {
    let keydown;
    let focusCount = 0;
    const sections = ['list', 'ad', 'data', 'settings'].map(shortcutView => ({
      dataset: { shortcutView }, hidden: true,
    }));
    const originalFocus = { isConnected: true, focus: () => { focusCount++; } };
    const close = { addEventListener: (name, listener) => { close.click = listener; }, focus: () => {} };
    const dialog = {
      open: false,
      addEventListener: (name, listener) => { if (name === 'close') dialog.closeEvent = listener; else if (name === 'keydown') dialog.keydown = listener; },
      showModal: () => { dialog.open = true; dialog.openCount = (dialog.openCount || 0) + 1; },
      close: () => { dialog.open = false; dialog.closeEvent(); },
    };
    const elements = { '#shortcut-help': dialog, '#shortcut-close': close };
    const context = vm.createContext({
      curView: view,
      document: {
        activeElement: originalFocus,
        addEventListener: (name, listener) => { if (name === 'keydown') keydown = listener; },
        querySelectorAll: () => sections,
      },
      $: selector => elements[selector],
      nav: () => {}, back: () => {}, history: { forward: () => {} },
    });
    vm.runInContext(source.slice(source.indexOf('  const editable ='), source.indexOf("  document.addEventListener('mouseup'")) +
      "document.addEventListener('mouseup', () => {});", context);

    keydown({ key: '?', target: { tagName: 'BODY' }, preventDefault() {} });
    assert.equal(dialog.open, true);
    assert.equal(dialog.openCount, 1);
    assert.deepEqual(sections.map(section => section.hidden), ['list', 'ad', 'data', 'settings'].map(item => item !== view));
    keydown({ key: '?', target: { tagName: 'BODY' }, preventDefault() {} });
    assert.equal(dialog.openCount, 1);
    let escapePrevented = false;
    dialog.keydown({ key: 'Escape', preventDefault: () => { escapePrevented = true; } });
    assert.equal(escapePrevented, true);
    assert.equal(dialog.open, false);
    assert.equal(focusCount, 1);

    for (const target of [{ tagName: 'INPUT' }, { tagName: 'TEXTAREA' }, { tagName: 'SELECT' }, { tagName: 'DIV', isContentEditable: true }]) {
      keydown({ key: '?', target, preventDefault() {} });
      assert.equal(dialog.open, false);
    }
  }
});

test('shortcut dialog blocks background keyboard and mouse navigation', () => {
  const source = readFileSync(require.resolve('./app.js'), 'utf8');
  let keydown, mouseup, backCount = 0, forwardCount = 0;
  const dialog = { open: true, addEventListener() {}, showModal() {}, close() {} };
  const context = vm.createContext({
    curView: 'list',
    document: {
      activeElement: {},
      addEventListener: (name, listener) => { if (name === 'keydown') keydown = listener; else if (name === 'mouseup') mouseup = listener; },
      querySelectorAll: () => [],
    },
    $: selector => selector === '#shortcut-help' ? dialog : ({ addEventListener() {}, focus() {} }),
    nav: () => {}, back: () => { backCount++; }, history: { forward: () => { forwardCount++; } },
  });
  const start = source.indexOf('  const editable =');
  vm.runInContext(source.slice(start, source.indexOf("  document.querySelectorAll('.nav')", start)), context);
  keydown({ key: 'Backspace', target: { tagName: 'BODY' }, preventDefault() {} });
  keydown({ key: '/', target: { tagName: 'BODY' }, preventDefault() {} });
  mouseup({ button: 3, preventDefault() {} });
  mouseup({ button: 4, preventDefault() {} });
  assert.equal(backCount, 0);
  assert.equal(forwardCount, 0);
});

test('message dialogs use safe defaults, plain text, dismissal and focus restoration', async () => {
  const source = readFileSync(require.resolve('./app.js'), 'utf8');
  for (const action of ['cancel', 'accept', 'discard', 'escape', 'native-cancel', 'message']) {
    let focused, restored = 0;
    const listeners = {};
    const dialog = {
      open: false,
      addEventListener: (name, listener) => { listeners[name] = listener; },
      showModal() { this.open = true; },
      close(value) { this.returnValue = value; this.open = false; listeners.close(); },
    };
    const elements = { '#message-dialog': dialog };
    for (const name of ['cancel', 'discard', 'accept', 'title', 'body']) {
      elements['#message-' + name] = {
        addEventListener(event, listener) { this[event] = listener; },
        classList: { toggle() {} },
        focus() { focused = name; },
      };
    }
    const context = vm.createContext({
      $: selector => elements[selector],
      document: { activeElement: { isConnected: true, focus() { restored++; } } },
    });
    vm.runInContext(source.slice(source.indexOf('  const messageDialog ='), source.indexOf('  const editable =')), context);
    const result = vm.runInContext(`showMessage({title:'Remove?',message:'<img src=x onerror=bad()>',confirmLabel:${action === 'message' ? 'undefined' : "'Remove'"},discardLabel:${action === 'discard' ? "'Discard'" : 'undefined'}})`, context);
    assert.equal(dialog.open, true);
    assert.equal(focused, action === 'message' ? 'accept' : 'cancel');
    assert.equal(elements['#message-cancel'].hidden, action === 'message');
    assert.equal(elements['#message-body'].textContent, '<img src=x onerror=bad()>');
    assert.equal(await vm.runInContext("showMessage({title:'Duplicate',message:'Ignored'})", context), false);
    if (action === 'escape' || action === 'native-cancel') {
      let prevented = false;
      listeners[action === 'escape' ? 'keydown' : 'cancel']({ key: 'Escape', preventDefault() { prevented = true; } });
      assert.equal(prevented, true);
    } else elements['#message-' + (action === 'cancel' ? 'cancel' : action === 'discard' ? 'discard' : 'accept')].click();
    assert.equal(await result, action === 'accept' || action === 'message' ? true : action === 'discard' ? 'discard' : false);
    assert.equal(restored, 1);
    assert.equal(dialog.open, false);
  }
});

test('dataset editor selects heading names, creates in edit mode, and saves metadata', async () => {
  const source = readFileSync(require.resolve('./app.js'), 'utf8');
  const fields = {
    '.dataset-heading-copy': { innerHTML: '' },
    '.dataset-actions': { innerHTML: '' },
    '#dataset-name': { innerText: '', focus() { this.focused = true; } },
    '#dataset-meta': { innerText: '' },
  };
  const calls = [];
  const context = vm.createContext({
    $: selector => fields[selector],
    window: { getSelection: () => ({ removeAllRanges() {}, addRange() {} }) },
    document: { createRange: () => ({ selectNodeContents(element) { element.selected = true; } }) },
    esc: value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;'),
    icon: () => '<svg></svg>',
    api: {
      updateDataset: async (...args) => { calls.push(['update', ...args]); return { ok: true, dataset: { id: args[0], name: args[1], description: args[2] } }; },
      createDataset: async (...args) => { calls.push(['create', ...args]); return { ok: true, dataset: { id: 'new-id', name: args[0], description: args[1] } }; },
    },
    showMessage: async options => { calls.push(['message', options]); return true; },
    renderData: async () => {}, reload() {}, loadStats() {}, applyDatasetChange: dataset => calls.push(['transition', dataset.id]),
  });
  const editorCode = source.slice(source.indexOf('  function renderDatasetEditor()'), source.indexOf('  async function renderData()'));
  vm.runInContext("let activeDataset = {id:'active',name:'Current',description:'first\\nsecond'}; let datasetEditor = null; let curView = 'data';" + editorCode, context);

  vm.runInContext('beginDatasetEdit(true)', context);
  assert.equal(fields['#dataset-name'].focused, true);
  assert.equal(fields['#dataset-name'].selected, true);
  assert.match(fields['.dataset-heading-copy'].innerHTML, /<h1><span[^>]+contenteditable="plaintext-only"/);
  assert.match(fields['.dataset-heading-copy'].innerHTML, /aria-multiline="true">first\nsecond<\/div>/);
  assert.doesNotMatch(fields['.dataset-heading-copy'].innerHTML, /<input|<textarea/);
  fields['#dataset-name'].innerText = 'Renamed';
  fields['#dataset-meta'].innerText = 'line one\nline two';
  assert.equal(await vm.runInContext('saveDatasetEditor()', context), true);
  assert.deepEqual(calls[0], ['update', 'active', 'Renamed', 'line one\nline two']);

  vm.runInContext('beginDatasetCreation()', context);
  assert.equal(fields['#dataset-name'].focused, true);
  assert.equal(fields['#dataset-name'].selected, true);
  assert.match(fields['.dataset-heading-copy'].innerHTML, /aria-required="true"><\/span>/);
  fields['#dataset-name'].innerText = 'New collection';
  fields['#dataset-meta'].innerText = 'note';
  assert.equal(await vm.runInContext('saveDatasetEditor()', context), true);
  assert.deepEqual(calls[1], ['create', 'New collection', 'note']);
  assert.equal(vm.runInContext('activeDataset.id', context), 'new-id');
});

test('dataset editor rejects blank names and guards dirty exits with three choices', async () => {
  const source = readFileSync(require.resolve('./app.js'), 'utf8');
  const fields = {
    '.dataset-heading-copy': { innerHTML: '' },
    '.dataset-actions': { innerHTML: '' },
    '#dataset-name': { innerText: '   ', focus() { this.focused = true; } },
    '#dataset-meta': { innerText: '' },
  };
  let choice = false;
  let writes = 0;
  const context = vm.createContext({
    $: selector => fields[selector], esc: String, icon: () => '',
    window: { getSelection: () => ({ removeAllRanges() {}, addRange() {} }) },
    document: { createRange: () => ({ selectNodeContents(element) { element.selected = true; } }) },
    api: { updateDataset: async () => { writes++; return { ok: true }; }, createDataset: async () => { writes++; return { ok: true }; } },
    showMessage: async options => { context.lastMessage = options; return choice; },
    renderData: async () => {}, reload() {}, loadStats() {},
  });
  const editorCode = source.slice(source.indexOf('  function renderDatasetEditor()'), source.indexOf('  async function renderData()'));
  vm.runInContext("let activeDataset = {id:'active',name:'Current',description:''}; let datasetEditor = null; let curView = 'data';" + editorCode, context);

  vm.runInContext('beginDatasetCreation()', context);
  fields['#dataset-name'].innerText = '';
  assert.equal(await vm.runInContext('saveDatasetEditor()', context), false);
  assert.equal(fields['#dataset-name'].focused, true);
  assert.equal(writes, 0);

  fields['#dataset-name'].selected = undefined;
  vm.runInContext('beginDatasetEdit()', context);
  assert.equal(fields['#dataset-name'].selected, undefined);
  fields['#dataset-name'].innerText = 'Changed';
  vm.runInContext("datasetEditor.name = 'Changed'", context);
  choice = false;
  assert.equal(await vm.runInContext('leaveDatasetEditor()', context), false);
  assert.equal(context.lastMessage.confirmLabel, 'Save');
  assert.equal(context.lastMessage.discardLabel, 'Discard');
  assert.equal(context.lastMessage.cancelLabel, 'Cancel');
  assert.equal(writes, 0);
  choice = 'discard';
  assert.equal(await vm.runInContext('leaveDatasetEditor()', context), true);
  assert.equal(vm.runInContext('datasetEditor === null', context), true);

  choice = true;
  vm.runInContext('beginDatasetEdit()', context);
  fields['#dataset-name'].innerText = 'Saved';
  vm.runInContext("datasetEditor.name = 'Saved'", context);
  assert.equal(await vm.runInContext('leaveDatasetEditor()', context), true);
  assert.equal(writes, 1);
});

test('inline dataset edits track text, preserve clicks and route Enter to description', async () => {
  const source = readFileSync(require.resolve('./app.js'), 'utf8');
  const handlers = {};
  const dataElement = { addEventListener: (name, listener) => { handlers[name] = listener; } };
  const dialogElements = Object.fromEntries(['#dataset-dialog', '#dataset-dialog-close', '#dataset-options'].map(selector => [selector, { addEventListener() {} }]));
  let focused = false, saves = 0, edits = 0, prevented = 0;
  const context = vm.createContext({
    $: selector => selector === '#data' ? dataElement : dialogElements[selector] || { focus() { focused = true; } },
    datasetEditor: { name: 'Current', description: '' },
    beginDatasetEdit() { edits++; },
    saveDatasetEditor() { saves++; },
  });
  vm.runInContext(source.slice(source.indexOf('  const dataEl ='), source.indexOf("  window.addEventListener('dragover'")), context);
  handlers.input({ target: { id: 'dataset-name', innerText: 'Changed' } });
  handlers.input({ target: { id: 'dataset-meta', innerText: 'First\nSecond' } });
  assert.equal(context.datasetEditor.name, 'Changed');
  assert.equal(context.datasetEditor.description, 'First\nSecond');
  await handlers.click({ target: { closest: selector => selector === '#dataset-name' ? {} : null } });
  assert.equal(edits, 0);
  handlers.keydown({ target: { id: 'dataset-name' }, key: 'Enter', isComposing: true, preventDefault() { prevented++; } });
  assert.equal(prevented, 0);
  handlers.keydown({ target: { id: 'dataset-name' }, key: 'Enter', preventDefault() { prevented++; } });
  assert.equal(prevented, 1);
  assert.equal(focused, true);
  handlers.keydown({ target: { id: 'dataset-meta' }, key: 'Enter', preventDefault() { prevented++; } });
  assert.equal(prevented, 1);
  await handlers.click({ target: { closest: selector => selector === '[data-dataset-save]' ? {} : null } });
  assert.equal(saves, 1);
});

test('dataset chooser shows one-line previews, counts, final creation action, and switches cleanly', async () => {
  const source = readFileSync(require.resolve('./app.js'), 'utf8');
  const options = { innerHTML: '' };
  const dialog = { showModal() { this.open = true; }, close() { this.open = false; } };
  const focusTarget = { focus() { this.focused = true; } };
  const calls = [];
  const elements = { '#dataset-options': options, '#dataset-dialog': dialog, '#dataset-dialog-close': { focus() {} }, '#ad': { innerHTML: 'old ad' }, '#crumbs': { innerHTML: 'old crumbs' } };
  const catalog = {
    active: { id: 'one', name: 'Current', description: 'First line\nSecond line', stats: { total: 8, sourceCount: 2, min: '2020-01-01', max: '2022-01-01' } },
    datasets: [
      { id: 'one', name: 'Current', description: 'First line\nSecond line', stats: { total: 8, sourceCount: 2, min: '2020-01-01', max: '2022-01-01' } },
      { id: 'two', name: 'Empty', description: '', stats: { total: 0, sourceCount: 0, min: null, max: null } },
    ],
  };
  const context = vm.createContext({
    $: selector => selector === '[data-dataset-select]' ? focusTarget : elements[selector],
    esc: String, icon: name => `<svg>${name}</svg>`, fmtNum: String,
    api: {
      datasets: async () => catalog,
      datasetSummaries: async () => catalog,
      activateDataset: async id => { calls.push(['activate', id]); return { ok: true, dataset: catalog.datasets.find(item => item.id === id) }; },
    },
    leaveDatasetEditor: async () => true, showMessage: async options => calls.push(['message', options]),
    syncInputs() {}, renderActive() {}, saveF() {}, show(view) { calls.push(['show', view]); },
    reload() { calls.push(['reload']); }, setCount() {},
    history: { pushState: state => calls.push(['history', state]) },
  });
  const code = source.slice(source.indexOf('  function applyDatasetChange('), source.indexOf('  function renderProgress()'));
  vm.runInContext(`const DEF = {terms:[],sel:[],loc:[],employers:[]}; let F = {terms:['old'],sel:[1],loc:[2],employers:['Old employer']}; let activeDataset = ${JSON.stringify(catalog.active)};
    let datasetContextId = 'one', datasetHistoryBoundary = false, datasetEditor = null;
    let idx = 4, listScroll = 200, adSeq = 3, adMatches = [1]; ${code}`, context);
  vm.runInContext(`chooserCatalog = ${JSON.stringify(catalog)}`, context);

  await vm.runInContext('openDatasetChooser()', context);
  await Promise.resolve();
  assert.equal(dialog.open, true);
  assert.match(options.innerHTML, /First line/);
  assert.doesNotMatch(options.innerHTML, /Second line/);
  assert.match(options.innerHTML, /2 files · 8 ads · 2020–2022/);
  assert.match(options.innerHTML, /0 files · 0 ads/);
  assert.ok(options.innerHTML.indexOf('data-dataset-add') > options.innerHTML.lastIndexOf('data-dataset-select'));
  assert.equal(focusTarget.focused, true);

  await vm.runInContext("chooseDataset('two')", context);
  assert.equal(dialog.open, false);
  assert.equal(vm.runInContext('activeDataset.id', context), 'two');
  assert.equal(vm.runInContext('JSON.stringify(F)', context), '{"terms":[],"sel":[],"loc":[],"employers":[]}');
  assert.equal(vm.runInContext('adSeq', context), 4);
  assert.deepEqual(calls.filter(call => call[0] === 'show' || call[0] === 'reload'), [['show', 'data'], ['reload']]);
  assert.equal(calls.find(call => call[0] === 'history')[1].datasetId, 'two');
});

test('dataset chooser closes on Escape and native cancellation', () => {
  const source = readFileSync(require.resolve('./app.js'), 'utf8');
  const listeners = {};
  const dialog = { addEventListener: (name, listener) => { listeners[name] = listener; }, close() { this.closed = true; } };
  const context = vm.createContext({
    $: selector => selector === '#dataset-dialog' ? dialog : { addEventListener() {} },
  });
  const start = source.indexOf('  const dataEl =');
  const end = source.indexOf("  dataEl.addEventListener('input'", start);
  vm.runInContext(source.slice(start, end), context);
  let prevented = false;
  listeners.keydown({ key: 'Escape', preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(dialog.closed, true);
  dialog.closed = false;
  listeners.cancel({ preventDefault() { prevented = true; } });
  assert.equal(dialog.closed, true);
});

test('failed dataset activation preserves current filters and reports error', async () => {
  const source = readFileSync(require.resolve('./app.js'), 'utf8');
  const messages = [];
  const dialog = { close() { this.closed = true; } };
  const context = vm.createContext({
    $: selector => selector === '#dataset-dialog' ? dialog : { innerHTML: '' },
    esc: String, icon: () => '', fmtNum: String,
    api: { activateDataset: async () => ({ ok: false, error: 'Database unavailable' }) },
    showMessage: async options => messages.push(options),
  });
  const code = source.slice(source.indexOf('  function applyDatasetChange('), source.indexOf('  function renderProgress()'));
  vm.runInContext(`const DEF = {}; let F = {terms:['keep']}; let activeDataset = {id:'one'}; let datasetContextId = 'one';
    let datasetHistoryBoundary = false, datasetEditor = null; let idx = 0, listScroll = 0, adSeq = 0, adMatches = []; ${code}`, context);
  vm.runInContext("chooserCatalog = {active:{id:'one'}}", context);
  await vm.runInContext("chooseDataset('two')", context);
  assert.equal(vm.runInContext('activeDataset.id', context), 'one');
  assert.deepEqual(JSON.parse(vm.runInContext('JSON.stringify(F)', context)), { terms: ['keep'] });
  assert.equal(messages[0].title, 'Could not switch dataset');
  assert.match(messages[0].message, /Database unavailable/);
});

test('deleting active dataset requires permanent-delete confirmation and refreshes replacement', async () => {
  const source = readFileSync(require.resolve('./app.js'), 'utf8');
  const messages = [], deleted = [];
  const dialog = { close() {}, showModal() {} };
  const elements = { '#dataset-dialog': dialog, '#ad': { innerHTML: '' }, '#crumbs': { innerHTML: '' } };
  const replacement = { id: 'default', name: 'default', description: '', stats: { total: 0, sourceCount: 0, min: null, max: null } };
  const context = vm.createContext({
    $: selector => elements[selector], esc: String, icon: () => '', fmtNum: String,
    api: { deleteDataset: async id => { deleted.push(id); return { ok: true, active: replacement }; } },
    showMessage: async options => { messages.push(options); return true; },
    syncInputs() {}, renderActive() {}, saveF() {}, show() {}, reload() {}, setCount() {},
    history: { pushState() {} },
  });
  const code = source.slice(source.indexOf('  function applyDatasetChange('), source.indexOf('  function renderProgress()'));
  vm.runInContext(`const DEF = {terms:[],sel:[],loc:[]}; let F = {terms:['old'],sel:[],loc:[]}; let activeDataset = {id:'one'};
    let datasetContextId = 'one', datasetHistoryBoundary = false, datasetEditor = null;
    let idx = 0, listScroll = 0, adSeq = 0, adMatches = []; ${code}`, context);
  vm.runInContext("chooserCatalog = {active:{id:'one'}, datasets:[{id:'one',name:'Only dataset'}]}", context);
  await vm.runInContext("deleteDatasetFromChooser('one')", context);
  assert.equal(messages[0].title, 'Delete dataset permanently?');
  assert.equal(messages[0].confirmLabel, 'Delete dataset');
  assert.match(messages[0].message, /Original source files will not be deleted/);
  assert.match(messages[0].message, /empty dataset named “default” will be created/);
  assert.deepEqual(deleted, ['one']);
  assert.equal(vm.runInContext('activeDataset.id', context), 'default');
});

test('dataset editor Discard restores stored metadata without writing', async () => {
  const source = readFileSync(require.resolve('./app.js'), 'utf8');
  const handlers = {};
  const dataElement = { addEventListener: (name, listener) => { handlers[name] = listener; } };
  let renders = 0;
  const context = vm.createContext({
    $: () => dataElement,
    datasetEditor: { name: 'Unsaved' },
    renderData: async () => { renders++; },
    api: {},
  });
  vm.runInContext(source.slice(source.indexOf('  const dataEl ='), source.indexOf("  window.addEventListener('dragover'")), context);
  await handlers.click({ target: { closest: selector => selector === '[data-dataset-discard]' ? {} : null } });
  assert.equal(context.datasetEditor, null);
  assert.equal(renders, 1);
});

test('dataset reprocessing requires confirmation, prevents duplicate work and refreshes after success', async () => {
  const source = readFileSync(require.resolve('./app.js'), 'utf8');
  for (const outcome of ['cancel', 'success', 'error', 'reject']) {
    const messages = [];
    const button = { disabled: false };
    let calls = 0, renders = 0, reloads = 0, stats = 0, finish;
    let started;
    const didStart = new Promise(resolve => { started = resolve; });
    const context = vm.createContext({
      $: () => button,
      showMessage: async options => { messages.push(options); return outcome !== 'cancel'; },
      api: { reprocessDataset: async id => {
        assert.equal(id, 'active');
        calls++;
        assert.equal(button.disabled, true);
        started();
        if (outcome === 'reject') throw new Error('Worker failed');
        if (outcome === 'error') return { ok: false, error: 'Busy' };
        return new Promise(resolve => { finish = () => resolve({ ok: true }); });
      } },
      renderData: async () => { renders++; }, reload() { reloads++; }, loadStats() { stats++; },
    });
    vm.runInContext(`let reprocessBusy = false; let activeDataset = {id:'active',name:'Test dataset'}; let curView = 'data';`
      + source.slice(source.indexOf('  async function reprocessDataset()'), source.indexOf('  function renderProgress()')), context);
    const result = vm.runInContext('reprocessDataset()', context);
    if (outcome === 'success') {
      await didStart;
      await vm.runInContext('reprocessDataset()', context);
      assert.equal(calls, 1);
      finish();
    }
    await result;
    assert.equal(calls, outcome === 'cancel' ? 0 : 1);
    assert.equal(renders, outcome === 'success' ? 1 : 0);
    assert.equal(reloads, outcome === 'success' ? 1 : 0);
    assert.equal(stats, outcome === 'success' ? 1 : 0);
    assert.equal(button.disabled, false);
    assert.equal(vm.runInContext('reprocessBusy', context), false);
    assert.equal(messages[0].title, 'Reprocess dataset?');
    assert.match(messages[0].message, /Test dataset/);
    assert.match(messages[0].message, /may take a long time/);
    assert.match(messages[0].message, /temporary disk space/);
    if (outcome === 'error' || outcome === 'reject') {
      assert.equal(messages[1].title, 'Dataset reprocessing failed');
      assert.equal(messages[1].message, outcome === 'error' ? 'Busy' : 'Worker failed');
    }
  }
});

test('dataset reprocess button routes through its confirmation handler', async () => {
  const source = readFileSync(require.resolve('./app.js'), 'utf8');
  let click, calls = 0;
  const context = vm.createContext({
    $: () => ({ addEventListener: (_event, listener) => { click = listener; } }),
    reprocessDataset() { calls++; },
  });
  vm.runInContext(source.slice(source.indexOf('  const dataEl ='), source.indexOf("  window.addEventListener('dragover'")), context);
  await click({ target: { closest: selector => selector === '#dataset-reprocess' ? {} : null } });
  assert.equal(calls, 1);
});

test('source removal requires confirmation and shows returned or rejected errors in a modal', async () => {
  const source = readFileSync(require.resolve('./app.js'), 'utf8');
  for (const outcome of ['cancel', 'success', 'error', 'reject']) {
    let click, removals = 0, renders = 0, reloads = 0;
    const messages = [];
    const context = vm.createContext({
      $: () => ({ addEventListener: (event, listener) => { click = listener; } }),
      showMessage: async options => { messages.push(options); return outcome !== 'cancel'; },
      api: { removeSource: async name => {
        assert.equal(name, '<source>.jsonl');
        removals++;
        if (outcome === 'reject') throw new Error('Worker failed');
        return outcome === 'error' ? { ok: false, error: 'Busy' } : { ok: true };
      } },
      renderData: async () => { renders++; }, reload: () => { reloads++; },
    });
    vm.runInContext(source.slice(source.indexOf("  const dataEl ="), source.indexOf("  window.addEventListener('dragover'")), context);
    await click({ target: { closest: selector => selector === '[data-rm]' ? { dataset: { rm: '<source>.jsonl' } } : null } });
    assert.equal(removals, outcome === 'cancel' ? 0 : 1);
    assert.equal(renders, outcome === 'success' ? 1 : 0);
    assert.equal(reloads, outcome === 'success' ? 1 : 0);
    assert.equal(messages[0].confirmLabel, 'Remove');
    if (outcome === 'error' || outcome === 'reject') {
      assert.equal(messages[1].title, 'Removal failed');
      assert.equal(messages[1].message, outcome === 'error' ? 'Busy' : 'Worker failed');
      assert.equal(messages[1].confirmLabel, undefined);
    } else assert.equal(messages.length, 1);
  }
});

test('tree leaves sum duplicate rows instead of replacing positive counts with zero', () => {
  const evaluate = rendererContext();
  assert.equal(evaluate("buildLoc([{r:'Region',m:'Town',n:3},{r:'Region',m:'Town',n:0}])[0].kids[0].n"), 3);
  assert.equal(evaluate("buildOcc([{fi:'f',gi:'g',oi:'o',n:3},{fi:'f',gi:'g',oi:'o',n:0}])[0].kids[0].kids[0].n"), 3);
});

test('collapse all clears every tree level independently, preserves selections and saves expansion state', () => {
  for (const tree of ['occ', 'loc']) {
    const elements = Object.fromEntries(['#tf-occ', '#tf-loc', '#tree-occ', '#tree-loc'].map(selector => [selector, { value: '', innerHTML: '' }]));
    const button = { dataset: { collapseTree: tree }, addEventListener: (event, listener) => { button.click = listener; } };
    let saved;
    const evaluate = rendererContext({ querySelectorAll: () => [button] }, {
      $: selector => elements[selector],
      saveExp: () => { saved = evaluate('JSON.stringify([...expanded])'); },
    });
    evaluate(`facetData = {occ: [{fi:'f',f:'Field',gi:'g',g:'Group',oi:'o',o:'Occupation',n:3}],loc: [{r:'Region',m:'Town',n:3}]};
      F.sel = [{k:'occ',id:'o'}]; F.loc = [{k:'muni',id:'Town',ri:'Region'}];
      ['field:f','group:g','occ:o','region:Region|Region','muni:Region|Town'].forEach(key => expanded.add(key)); renderTrees()`);
    assert.match(elements['#tree-occ'].innerHTML, /class="kids"/);
    assert.match(elements['#tree-loc'].innerHTML, /class="kids"/);
    elements['#tf-' + tree].value = tree === 'occ' ? 'Occupation' : 'Town';
    evaluate('renderTrees()');
    const selections = evaluate('JSON.stringify(F)');
    button.click();
    assert.equal(elements['#tf-' + tree].value, '');
    assert.doesNotMatch(elements['#tree-' + tree].innerHTML, /class="kids"/);
    assert.match(elements[tree === 'occ' ? '#tree-loc' : '#tree-occ'].innerHTML, /class="kids"/);
    assert.equal(evaluate('JSON.stringify(F)'), selections);
    assert.deepEqual(JSON.parse(saved), tree === 'occ' ? ['region:Region|Region', 'muni:Region|Town'] : ['field:f', 'group:g', 'occ:o']);
    button.click();
    assert.equal(evaluate('JSON.stringify([...expanded])'), saved);
  }
});

test('facet refresh replaces pending counts and ignores superseded responses', async () => {
  const source = readFileSync(require.resolve('./app.js'), 'utf8');
  const elements = Object.fromEntries(['#tf-occ', '#tf-loc', '#tree-occ', '#tree-loc', '#chips-year', '#chips-emp', '#chips-hours', '#widget-employers', '#widget-timeline', '#loading-employers', '#loading-timeline'].map(selector => [selector, { value: '', innerHTML: '', querySelector: () => null, setAttribute() {} }]));
  const requests = [];
  const evaluate = rendererContext({ querySelectorAll: () => [] }, {
    $: selector => elements[selector],
    showTask() {}, endTask() {},
    api: {
      facets: () => new Promise(resolve => requests.push(resolve)),
      timeline: async () => ({ stale: true }),
      onSummary() {},
    },
  });
  evaluate(source.slice(source.indexOf('  let tseq ='), source.indexOf("  listEl.addEventListener('click'")));
  evaluate('loadStats(); loadStats()');
  const data = { occ: [], loc: [{ r: 'Region', m: 'Town', n: 7 }], year: [{ y: 2026, n: 7 }], emp: [{ v: 'Permanent', n: 7 }], hours: [{ v: 'Full time', n: 7 }], employers: [] };
  requests[0](data);
  await Promise.resolve();
  assert.equal(evaluate('facetPending'), true);
  requests[1](data);
  await Promise.resolve();
  assert.equal(evaluate('facetPending'), false);
  for (const selector of ['#tree-loc', '#chips-year', '#chips-emp', '#chips-hours']) {
    assert.match(elements[selector].innerHTML, /title="7">7/);
    assert.doesNotMatch(elements[selector].innerHTML, /Updating counts/);
  }
});

test('facet refresh failures report the underlying error', async () => {
  const source = readFileSync(require.resolve('./app.js'), 'utf8');
  const failure = new Error('Facet worker failed');
  const errors = [];
  const notices = [];
  const employerWidget = { innerHTML: '', querySelector: () => null, setAttribute() {} };
  const evaluate = rendererContext({ querySelectorAll: () => [] }, {
    $: () => employerWidget,
    showTask() {}, endTask() {},
    console: { error: (...args) => errors.push(args) },
    reportStatsError: (what, error) => notices.push([what, error]),
    api: {
      facets: async () => { throw failure; },
      timeline: async () => ({ stale: true }),
      onSummary() {},
    },
  });
  evaluate(source.slice(source.indexOf('  let tseq ='), source.indexOf("  listEl.addEventListener('click'")));
  evaluate('loadStats()');
  await Promise.resolve();
  await Promise.resolve();
  assert.deepEqual(errors, [['Failed to update filter counts:', failure]]);
  assert.deepEqual(notices, [['filter counts', failure]]);
});

function statisticsRefreshContext() {
  const source = readFileSync(require.resolve('./app.js'), 'utf8');
  const elements = new Map();
  const element = selector => {
    if (!elements.has(selector)) elements.set(selector, {
      innerHTML: '', hidden: true, attributes: {}, scrollTop: 0,
      querySelector: () => ({}),
      setAttribute(name, value) { this.attributes[name] = value; },
    });
    return elements.get(selector);
  };
  const requests = { count: [], facets: [], timeline: [] };
  const tasks = new Set();
  const errors = [];
  const renders = [];
  const context = vm.createContext({
    $: element, F: {}, esc: String, console: { error() {} },
    loadMore: async () => {}, updateCount() {}, markFacetsPending() {},
    renderFacets: data => renders.push(['facets', data]), renderChart: () => renders.push(['timeline']),
    showTask: key => tasks.add(key), endTask: key => tasks.delete(key),
    reportStatsError: (what, error) => errors.push([what, error]),
    api: Object.fromEntries([...Object.keys(requests).map(key => [key, () => new Promise((resolve, reject) => requests[key].push({ resolve, reject }))]), ['onSummary', () => {}]]),
  });
  vm.runInContext('let seq = 0, loaded = 0, done = false, loading = false, total = null, fseq = 0, timelineData = null; const listEl = {};'
    + source.slice(source.indexOf('  function reload()'), source.indexOf("  listEl.addEventListener('click'")), context);
  return { evaluate: expression => vm.runInContext(expression, context), element, requests, tasks, errors, renders };
}

test('statistics overlays settle independently while progress waits for the result count', async () => {
  const state = statisticsRefreshContext();
  await state.evaluate('reload()');
  for (const widget of ['employers', 'timeline']) {
    assert.equal(state.element('#widget-' + widget).attributes['aria-busy'], 'true');
    assert.equal(state.element('#loading-' + widget).hidden, false);
  }
  assert.ok(state.tasks.has('stats-refresh'));
  state.requests.facets[0].resolve({ employers: [] });
  await new Promise(setImmediate);
  assert.equal(state.element('#loading-employers').hidden, true);
  assert.equal(state.element('#widget-employers').attributes['aria-busy'], 'false');
  assert.equal(state.element('#loading-timeline').hidden, false);
  assert.ok(state.tasks.has('stats-refresh'));
  state.requests.timeline[0].resolve({ points: [] });
  await new Promise(setImmediate);
  assert.equal(state.element('#loading-timeline').hidden, true);
  assert.ok(state.tasks.has('stats-refresh'));
  state.requests.count[0].resolve({ total: 17 });
  await new Promise(setImmediate);
  assert.equal(state.evaluate('total'), 17);
  assert.equal(state.tasks.size, 0);
  assert.deepEqual(state.renders.map(render => render[0]), ['facets', 'timeline']);
});

test('superseded statistics successes and failures cannot clear current loading feedback', async () => {
  const state = statisticsRefreshContext();
  await state.evaluate('reload(); reload()');
  state.requests.count[0].resolve({ total: 99 });
  state.requests.facets[0].reject(new Error('Old request failed'));
  state.requests.timeline[0].resolve({ points: [] });
  await new Promise(setImmediate);
  assert.equal(state.evaluate('total'), null);
  assert.equal(state.renders.length, 0);
  assert.equal(state.errors.length, 0);
  for (const widget of ['employers', 'timeline']) assert.equal(state.element('#loading-' + widget).hidden, false);
  assert.ok(state.tasks.has('stats-refresh'));
  for (const key of ['count', 'facets', 'timeline']) state.requests[key][1].resolve({ stale: true });
  await new Promise(setImmediate);
  assert.equal(state.tasks.size, 0);
  for (const widget of ['employers', 'timeline']) assert.equal(state.element('#loading-' + widget).hidden, true);
});

test('statistics failures and building responses always clear running feedback', async () => {
  for (const failure of [true, false]) {
    const state = statisticsRefreshContext();
    await state.evaluate('reload()');
    for (const key of ['count', 'facets', 'timeline']) {
      if (failure) state.requests[key][0].reject(new Error(key + ' failed'));
      else state.requests[key][0].resolve(key === 'count' ? null : { building: true });
    }
    await new Promise(setImmediate);
    assert.equal(state.errors.length, failure ? 3 : 0);
    assert.equal(state.tasks.size, 0);
    for (const widget of ['employers', 'timeline']) {
      assert.equal(state.element('#loading-' + widget).hidden, true);
      assert.equal(state.element('#widget-' + widget).attributes['aria-busy'], 'false');
    }
  }
});

function noticeContext() {
  const source = readFileSync(require.resolve('./app.js'), 'utf8');
  const container = { children: [], append(el) { this.children.push(el); } };
  const timers = new Map();
  let timerId = 0;
  const createElement = () => {
    const parts = {};
    const el = {
      attributes: {},
      setAttribute(name, value) { this.attributes[name] = value; },
      remove() { container.children.splice(container.children.indexOf(el), 1); },
      set innerHTML(html) {
        this.html = html;
        parts['.notice-text'] = { textContent: '' };
        if (html.includes('notice-bar')) {
          const classes = new Set(['bar', 'notice-bar']);
          parts['.notice-bar'] = { firstChild: { style: { width: '' } }, classes, classList: { toggle: (name, on) => (on ? classes.add(name) : classes.delete(name)) } };
        }
        if (html.includes('notice-close')) parts['.notice-close'] = { addEventListener(name, listener) { this.click = listener; } };
      },
      get innerHTML() { return this.html; },
      querySelector: selector => parts[selector] || null,
    };
    return el;
  };
  const context = vm.createContext({
    $: selector => (selector === '#notices' ? container : null),
    icon: name => `<svg data-icon="${name}"></svg>`,
    document: { createElement },
    setTimeout: callback => { timers.set(++timerId, callback); return timerId; },
    clearTimeout: id => timers.delete(id),
  });
  vm.runInContext(source.slice(source.indexOf('  /* ---------- notifications'), source.indexOf('  const esc =')), context);
  const flush = () => { const pending = [...timers.values()]; timers.clear(); pending.forEach(callback => callback()); };
  return { evaluate: expression => vm.runInContext(expression, context), container, flush, timers };
}

test('background tasks show delayed progress notices that update in place and vanish when done', () => {
  const { evaluate, container, flush, timers } = noticeContext();
  evaluate("applyTask({ key: 'quick', state: 'running', text: 'Quick' }); applyTask({ key: 'quick', state: 'done' })");
  assert.equal(timers.size, 0);
  assert.equal(container.children.length, 0);
  evaluate("applyTask({ key: 'summary', state: 'running', text: '<b>Building</b>', pct: 10 }); applyTask({ key: 'import', state: 'running', text: 'Importing', pct: null })");
  assert.equal(container.children.length, 0);
  flush();
  assert.equal(container.children.length, 2);
  const [summary, imported] = container.children;
  assert.equal(summary.attributes.role, 'status');
  assert.equal(summary.querySelector('.notice-text').textContent, '<b>Building</b>');
  assert.equal(summary.querySelector('.notice-bar').firstChild.style.width, '10%');
  assert.equal(summary.querySelector('.notice-close'), null);
  assert.ok(imported.querySelector('.notice-bar').classes.has('indeterminate'));
  evaluate("applyTask({ key: 'summary', state: 'running', text: 'Indexing', pct: 140 })");
  assert.equal(container.children[0], summary);
  assert.equal(summary.querySelector('.notice-text').textContent, 'Indexing');
  assert.equal(summary.querySelector('.notice-bar').firstChild.style.width, '100%');
  evaluate("applyTask({ key: 'summary', state: 'done' })");
  assert.deepEqual(container.children, [imported]);
});

test('error notices stack immediately, replace same-key errors and close only by dismissal', () => {
  const { evaluate, container, flush } = noticeContext();
  evaluate("applyTask({ key: 'import', state: 'running', text: 'Importing' })");
  flush();
  evaluate("applyTask({ key: 'import', state: 'error', text: 'Import failed: bad file' })");
  evaluate("showError('stats', 'Could not update filter counts: one'); showError('stats', 'Could not update filter counts: two')");
  assert.equal(container.children.length, 2);
  const [importError, statsError] = container.children;
  assert.equal(importError.attributes.role, 'alert');
  assert.equal(importError.querySelector('.notice-text').textContent, 'Import failed: bad file');
  assert.equal(importError.querySelector('.notice-bar'), null);
  assert.match(importError.innerHTML, /aria-label="Dismiss notification"/);
  assert.equal(statsError.querySelector('.notice-text').textContent, 'Could not update filter counts: two');
  evaluate("applyTask({ key: 'import', state: 'done' })");
  assert.equal(container.children.length, 2);
  importError.querySelector('.notice-close').click();
  assert.deepEqual(container.children, [statsError]);
});

test('statistics errors strip IPC prefixes and ignore dataset transitions', () => {
  const { evaluate, container } = noticeContext();
  evaluate("reportStatsError('the result count', new Error(\"Error invoking remote method 'ads:count': Error: Dataset transition in progress\"))");
  assert.equal(container.children.length, 0);
  evaluate("reportStatsError('the result count', new Error(\"Error invoking remote method 'ads:count': Error: disk I/O error\"))");
  assert.equal(container.children[0].querySelector('.notice-text').textContent, 'Could not update the result count: disk I/O error');
});

test('pending counts hide stale values and zero styling, including rebuilt trees', () => {
  const count = { textContent: '0', title: '0' };
  let zeroRemoved = false;
  const employer = { dataset: { employer: 'Acme' }, classList: { toggle(name, on) { employer.selected = on; } }, setAttribute(name, value) { employer[name] = value; } };
  const evaluate = rendererContext({ querySelectorAll: selector => selector === '[data-collapse-tree]' ? [] : selector === '[data-employer]' ? [employer] : selector.includes('.cnt') ? [count] : [{ classList: { remove: () => { zeroRemoved = true; } } }] });
  evaluate("F.employers = ['Acme']");
  evaluate('facetPending = false; markFacetsPending()');
  assert.equal(evaluate('fseq'), 1);
  assert.equal(count.textContent, '...');
  assert.equal(count.title, 'Updating counts');
  assert.equal(zeroRemoved, true);
  assert.equal(employer.selected, true);
  assert.equal(employer['aria-pressed'], 'true');
  const chips = "chipsHtml([{v:'a',label:'A',n:0}],()=>false)";
  assert.match(evaluate(chips), /Updating counts/);
  assert.doesNotMatch(evaluate(chips), /chip zero/);
  assert.doesNotMatch(evaluate("treeHtml(buildLoc([{r:'Region',m:'Town',n:0}]),'')"), /node zero/);
  evaluate('facetPending = false');
  assert.match(evaluate(chips), /chip zero/);
});

function settingsContext(saved, storageFails = false) {
  const source = readFileSync(require.resolve('./app.js'), 'utf8');
  const root = { dataset: {} };
  const checkbox = { addEventListener: (name, listener) => { checkbox.change = listener; } };
  const stored = new Map(saved === undefined ? [] : [['settings', saved]]);
  const context = vm.createContext({
    document: { documentElement: root },
    $: () => checkbox,
    localStorage: {
      getItem: key => { if (storageFails) throw new Error('Storage unavailable'); return stored.get(key); },
      setItem: (key, value) => { if (storageFails) throw new Error('Storage unavailable'); stored.set(key, value); },
    },
  });
  vm.runInContext(source.slice(source.indexOf('  /* ---------- settings'), source.indexOf('  /* ---------- navigation')), context);
  return { root, checkbox, stored };
}

test('monospace defaults on and validates saved settings', () => {
  for (const saved of [undefined, '{', 'null', '{}', '{"monospace":"false"}']) {
    const { root, checkbox } = settingsContext(saved);
    assert.equal(root.dataset.monospace, 'true');
    assert.equal(checkbox.checked, true);
  }
  const { root, checkbox } = settingsContext('{"monospace":false}');
  assert.equal(root.dataset.monospace, 'false');
  assert.equal(checkbox.checked, false);
});

test('monospace changes apply immediately and survive renderer restart', () => {
  const { root, checkbox, stored } = settingsContext();
  checkbox.change({ target: { checked: false } });
  assert.equal(root.dataset.monospace, 'false');
  assert.equal(checkbox.checked, false);
  assert.equal(settingsContext(stored.get('settings')).checkbox.checked, false);
  checkbox.change({ target: { checked: true } });
  assert.equal(root.dataset.monospace, 'true');
  assert.equal(settingsContext(stored.get('settings')).checkbox.checked, true);
});

test('monospace remains usable if settings storage is unavailable', () => {
  const { root, checkbox } = settingsContext(undefined, true);
  checkbox.change({ target: { checked: false } });
  assert.equal(root.dataset.monospace, 'false');
});

test('Settings joins history navigation without losing list scroll', async () => {
  const source = readFileSync(require.resolve('./app.js'), 'utf8');
  const views = new Map(['list', 'ad', 'data', 'settings'].map(view => [view, new Set()]));
  const links = [...views.keys()].filter(view => view !== 'ad').map(view => ({
    dataset: { view }, classList: { toggle: (name, active) => { links.find(link => link.dataset.view === view).active = active; } },
  }));
  const listScroll = { scrollTop: 240 };
  const states = [];
  const context = vm.createContext({
    $: selector => selector === '#list-scroll' ? listScroll : {
      classList: { toggle: (name, hidden) => { if (hidden) views.get(selector.slice(6)).add(name); else views.get(selector.slice(6)).delete(name); } },
    },
    document: { querySelectorAll: () => links },
    history: { pushState: state => states.push(state) },
    loadAd: () => {}, renderData: () => {},
    leaveDatasetEditor: async () => true,
  });
  vm.runInContext(source.slice(source.indexOf('  let idx ='), source.indexOf('  function back()')), context);
  await vm.runInContext("nav('settings')", context);
  assert.equal(states[0].view, 'settings');
  assert.equal(views.get('settings').has('hidden'), false);
  assert.equal(views.get('list').has('hidden'), true);
  assert.equal(links.find(link => link.dataset.view === 'settings').active, true);
  listScroll.scrollTop = 0;
  vm.runInContext("show('list')", context);
  assert.equal(listScroll.scrollTop, 240);
  assert.equal(views.get('settings').has('hidden'), true);
});

test('dataset history boundary rejects entries from the previous dataset', async () => {
  const source = readFileSync(require.resolve('./app.js'), 'utf8');
  let popstate, forwards = 0, shown = 0;
  const context = vm.createContext({
    window: { addEventListener: (name, listener) => { if (name === 'popstate') popstate = listener; } },
    history: { replaceState() {}, forward() { forwards++; } },
    document: { querySelectorAll: () => [] },
    $: () => ({ scrollTop: 0, classList: { toggle() {} } }),
    leaveDatasetEditor: async () => true,
    loadAd() {}, renderData() {},
    show() { shown++; },
  });
  const start = source.indexOf('  let idx =');
  const end = source.indexOf("  history.replaceState({ view: 'list', i: 0 }, '');", start) + 54;
  vm.runInContext(source.slice(start, end), context);
  vm.runInContext("datasetContextId = 'new'; datasetHistoryBoundary = true", context);
  await popstate({ state: { view: 'ad', id: 'old-ad', i: 2, datasetId: 'old' } });
  assert.equal(forwards, 1);
  assert.equal(shown, 0);
  await popstate({ state: { view: 'data', i: 0, datasetId: 'new' } });
  assert.equal(shown, 0);
});

test('canceling dirty browser navigation restores the current history entry once', async () => {
  const source = readFileSync(require.resolve('./app.js'), 'utf8');
  let popstate, prompts = 0, forwards = 0;
  const context = vm.createContext({
    window: { addEventListener: (name, listener) => { if (name === 'popstate') popstate = listener; } },
    history: { replaceState() {}, forward() { forwards++; } },
    document: { querySelectorAll: () => [] },
    $: () => ({ scrollTop: 0, classList: { toggle() {} } }),
    leaveDatasetEditor: async () => { prompts++; return false; },
  });
  vm.runInContext(source.slice(source.indexOf('  let idx ='), source.indexOf("  history.replaceState({ view: 'list', i: 0 }, '');") + 54), context);
  await popstate({ state: { view: 'list', i: 0 } });
  await popstate({ state: { view: 'data', i: 1 } });
  assert.equal(forwards, 1);
  assert.equal(prompts, 1);
});

function widgetContext(saved, storageFails = false, heights) {
  const source = readFileSync(require.resolve('./app.js'), 'utf8');
  const stored = new Map(saved === undefined ? [] : [['collapsedWidgets', saved]]);
  if (heights !== undefined) stored.set('widgetHeights', heights);
  const windowListeners = [];
  const window = { innerHeight: 900, addEventListener: (name, listener) => windowListeners.push(listener) };
  const createElement = () => {
    const attributes = new Map();
    const listeners = new Map();
    const classes = new Set();
    return {
      setAttribute: (name, value) => attributes.set(name, value),
      getAttribute: name => attributes.get(name),
      addEventListener: (name, listener) => listeners.set(name, listener),
      removeEventListener: name => listeners.delete(name),
      classList: { add: name => classes.add(name), remove: name => classes.delete(name) },
      setPointerCapture() {}, hasPointerCapture: () => true, releasePointerCapture() {},
      fire: (name, values = {}) => listeners.get(name)?.({ button: 0, pointerId: 1, clientY: 100, preventDefault() {}, ...values }),
    };
  };
  const widgets = ['timeline', 'published', 'occupation', 'location', 'employment', 'hours', 'employers'].map(key => {
    const attributes = new Map([['aria-controls', 'widget-' + key]]);
    const button = {
      setAttribute: (name, value) => attributes.set(name, value),
      getAttribute: name => attributes.get(name),
      addEventListener: (name, listener) => { button.click = listener; },
    };
    const body = { id: 'widget-' + key, style: {}, classList: { add() {} }, getBoundingClientRect: () => ({ height: parseFloat(body.style.height) || 200 }) };
    const badge = { setAttribute: () => {} };
    return { dataset: { widget: key }, button, body, badge,
      append(handle) { this.handle = handle; },
      querySelector: selector => selector === '.widget-toggle' ? button : selector === '.widget-active' ? badge : selector === '.widget-label' ? { textContent: key } : body };
  });
  const filters = { from: '', to: '', sel: [], loc: [], employers: [], emp: '', hours: '' };
  const context = vm.createContext({
    F: filters, document: { querySelectorAll: () => widgets, createElement }, window,
    $: (selector, root) => root.querySelector(selector),
    localStorage: {
      getItem: key => { if (storageFails) throw new Error('Storage unavailable'); return stored.get(key); },
      setItem: (key, value) => { if (storageFails) throw new Error('Storage unavailable'); stored.set(key, value); },
    },
  });
  vm.runInContext(source.slice(source.indexOf('  /* ---------- collapsible widgets'), source.indexOf('  /* ---------- settings')), context);
  vm.runInContext('initWidgets()', context);
  return { widgets, filters, stored, window, resizeWindow: () => windowListeners.forEach(listener => listener()), update: () => vm.runInContext('updateWidgets()', context) };
}

test('every widget divider resizes independently with pointer capture and persists on completion', () => {
  const { widgets, stored } = widgetContext();
  for (const [index, widget] of widgets.entries()) {
    assert.equal(widget.handle.getAttribute('role'), 'separator');
    assert.equal(widget.handle.getAttribute('aria-controls'), widget.body.id);
    widget.handle.fire('pointerdown');
    widget.handle.fire('pointermove', { pointerId: 2, clientY: 700 });
    assert.equal(widget.body.style.height, undefined);
    widget.handle.fire('pointermove', { clientY: 150 + index });
    assert.equal(widget.body.style.height, (250 + index) + 'px');
    widget.handle.fire(index % 2 ? 'pointercancel' : 'pointerup');
    widget.handle.fire('pointermove', { clientY: 400 });
    assert.equal(widget.body.style.height, (250 + index) + 'px');
  }
  const restored = widgetContext(undefined, false, stored.get('widgetHeights'));
  assert.deepEqual(restored.widgets.map(widget => widget.body.style.height), widgets.map(widget => widget.body.style.height));
});

test('widget heights clamp, survive collapse and tolerate invalid or unavailable storage', () => {
  const state = widgetContext(undefined, false, '{"occupation":360,"hours":9999,"location":"300"}');
  const widget = state.widgets[2];
  assert.equal(widget.body.style.height, '360px');
  assert.equal(state.widgets[5].body.style.height, '740px');
  assert.equal(state.widgets[3].body.style.height, undefined);
  widget.handle.fire('keydown', { key: 'ArrowDown' });
  assert.equal(widget.body.style.height, '380px');
  widget.button.click();
  widget.handle.fire('keydown', { key: 'End' });
  widget.button.click();
  assert.equal(widget.body.style.height, '380px');
  widget.handle.fire('keydown', { key: 'Home' });
  assert.equal(widget.body.style.height, '80px');
  widget.handle.fire('keydown', { key: 'ArrowUp' });
  assert.equal(widget.body.style.height, '80px');
  widget.handle.fire('keydown', { key: 'End' });
  state.window.innerHeight = 600;
  state.resizeWindow();
  assert.equal(widget.body.style.height, '440px');
  state.window.innerHeight = 900;
  state.resizeWindow();
  assert.equal(widget.body.style.height, '740px');
  for (const saved of ['{', 'null', 'true', '{"hours":null}']) {
    assert.ok(widgetContext(undefined, false, saved).widgets.every(item => !item.body.style.height));
  }
  const unavailable = widgetContext(undefined, true).widgets[0];
  unavailable.handle.fire('keydown', { key: 'ArrowDown' });
  assert.equal(unavailable.body.style.height, '220px');
});

test('widgets default expanded and tolerate invalid or unavailable storage', () => {
  for (const saved of [undefined, '{', 'null', '{}', 'true', '[3]']) {
    assert.ok(widgetContext(saved).widgets.every(widget => !widget.body.hidden));
  }
  const { widgets } = widgetContext(undefined, true);
  widgets[0].button.click();
  assert.equal(widgets[0].body.hidden, true);
});

test('widget collapse persists independently and preserves active filters', () => {
  const { widgets, filters, stored, update } = widgetContext();
  filters.sel.push({ id: 'occupation' }, { id: 'other' });
  filters.from = '2026-01-01';
  filters.to = '2026-12-31';
  filters.loc.push({ id: 'town' });
  filters.emp = 'Permanent';
  filters.hours = 'Full time';
  for (const widget of widgets) widget.button.click();
  assert.ok(widgets.every(widget => widget.body.hidden));
  assert.equal(widgets[2].button.getAttribute('aria-expanded'), 'false');
  assert.deepEqual(widgets.map(widget => widget.badge.textContent), ['0', '2', '2', '1', '1', '1', '0']);
  assert.equal(widgets[0].badge.hidden, true);
  assert.equal(widgets[2].badge.hidden, false);
  const restored = widgetContext(stored.get('collapsedWidgets'));
  assert.ok(restored.widgets.every(widget => widget.body.hidden));
  widgets[2].button.click();
  assert.equal(widgets[2].body.hidden, false);
  assert.equal(widgets[2].badge.hidden, true);
  assert.equal(widgets[3].body.hidden, true);
  assert.equal(filters.sel.length, 2);
  filters.loc = [];
  update();
  assert.equal(widgets[3].badge.hidden, true);
  assert.equal(widgets[3].body.hidden, true);
});

function columnContext({ width = 1400, filterWidth = 310, statisticsWidth = 280, menuCollapsed = true, saved = {}, storageFails = false } = {}) {
  const source = readFileSync(require.resolve('./app.js'), 'utf8');
  const stored = new Map(Object.entries(saved));
  const classes = new Set();
  const buttons = Object.fromEntries(['filters', 'statistics'].map(name => [name, {
    attributes: new Map(),
    setAttribute(key, value) { this.attributes.set(key, value); },
    addEventListener(event, listener) { this[event] = listener; },
  }]));
  const view = { classList: {
    contains: name => classes.has(name),
    toggle: (name, collapsed) => { if (collapsed) classes.add(name); else classes.delete(name); },
  } };
  let resize;
  const window = { innerWidth: width, addEventListener: (event, listener) => { resize = listener; } };
  const context = vm.createContext({
    window,
    document: {
      body: { classList: { contains: () => menuCollapsed } },
      documentElement: { style: { getPropertyValue: name => String(name === '--statistics-w' ? statisticsWidth : filterWidth) } },
    },
    $: selector => selector === '#view-list' ? view : selector === '#filters'
      ? { getBoundingClientRect: () => ({ width: classes.has('filters-collapsed') ? 0 : filterWidth }) }
      : buttons[selector.slice(1, -7)],
    localStorage: {
      getItem(key) { if (storageFails) throw new Error('Storage unavailable'); return stored.get(key); },
      setItem(key, value) { if (storageFails) throw new Error('Storage unavailable'); stored.set(key, value); },
    },
  });
  vm.runInContext(source.slice(source.indexOf('  /* ---------- layout: column collapse'),
    source.indexOf('  /* ---------- layout: menu collapse')) + '\napplyColumns();', context);
  return { buttons, classes, stored, resize: width => { window.innerWidth = width; resize(); } };
}

test('column toggles persist independently with accessible state and tolerate unavailable storage', () => {
  const state = columnContext();
  assert.equal(state.buttons.statistics.attributes.get('aria-expanded'), 'true');
  state.buttons.filters.click();
  assert.equal(state.buttons.filters.title, 'Show filters');
  assert.equal(state.buttons.filters.attributes.get('aria-label'), 'Show filters');
  assert.equal(state.buttons.filters.attributes.get('aria-expanded'), 'false');
  assert.equal(state.buttons.statistics.attributes.get('aria-expanded'), 'true');
  state.buttons.statistics.click();
  const restored = columnContext({ saved: Object.fromEntries(state.stored) });
  assert.equal(restored.classes.has('filters-collapsed'), true);
  assert.equal(restored.classes.has('statistics-collapsed'), true);
  restored.buttons.filters.click();
  assert.equal(restored.classes.has('statistics-collapsed'), true);
  for (const options of [{ storageFails: true }, { saved: { filtersCollapsed: 'bad', statisticsCollapsed: 'false' } }]) {
    const fallback = columnContext(options);
    assert.equal(fallback.classes.size, 0);
    fallback.buttons.statistics.click();
    assert.equal(fallback.classes.has('statistics-collapsed'), true);
  }
});

test('narrow columns preserve wide preferences and opening either column keeps results usable', () => {
  const state = columnContext();
  state.resize(960);
  assert.equal(state.classes.has('statistics-collapsed'), true);
  assert.equal(state.stored.size, 0);
  state.buttons.statistics.click();
  assert.equal(state.classes.has('statistics-collapsed'), false);
  assert.equal(state.classes.has('filters-collapsed'), true);
  assert.equal(state.stored.has('filtersCollapsed'), false);
  state.buttons.filters.click();
  assert.equal(state.classes.has('filters-collapsed'), false);
  assert.equal(state.classes.has('statistics-collapsed'), true);
  state.resize(1400);
  assert.equal(state.classes.size, 0);
  state.buttons.statistics.click();
  state.resize(960);
  state.resize(1400);
  assert.equal(state.classes.has('statistics-collapsed'), true);
  assert.equal(state.stored.get('statisticsCollapsed'), '1');
});

test('large filters and expanded menu cannot squeeze results between both columns', () => {
  for (const options of [{ width: 1200, menuCollapsed: false }, { filterWidth: 720 }, { statisticsWidth: 720 }]) {
    const state = columnContext(options);
    assert.equal(state.classes.has('statistics-collapsed'), true);
    state.buttons.statistics.click();
    assert.equal(state.classes.has('filters-collapsed'), true);
    assert.equal(state.classes.has('statistics-collapsed'), false);
    state.buttons.statistics.click();
    assert.equal(state.classes.has('filters-collapsed'), false);
    assert.equal(state.stored.has('filtersCollapsed'), false);
  }
});

function statisticsResizeContext(saved, storageFails = false) {
  const source = readFileSync(require.resolve('./app.js'), 'utf8');
  const stored = new Map(saved === undefined ? [] : [['statisticsW', saved]]);
  const styles = new Map();
  const attributes = new Map();
  const listeners = new Map();
  const handle = {
    classList: { add() {}, remove() {} },
    setAttribute: (name, value) => attributes.set(name, value),
    addEventListener: (name, listener) => listeners.set(name, listener),
    removeEventListener: name => listeners.delete(name),
    setPointerCapture() {}, hasPointerCapture: () => true, releasePointerCapture() {},
    fire: (name, values = {}) => listeners.get(name)?.({ button: 0, pointerId: 1, clientX: 500, preventDefault() {}, ...values }),
  };
  let resize;
  const window = { innerWidth: 1400, addEventListener: (name, listener) => { resize = listener; } };
  const context = vm.createContext({
    window, columnPriority: 'filters', applyColumns() {},
    document: {
      body: { classList: { contains: () => true } },
      documentElement: { style: { setProperty: (name, value) => styles.set(name, value) } },
    },
    $: selector => selector === '#statistics-resizer' ? handle : selector === '#view-list'
      ? { classList: { contains: () => false } }
      : { getBoundingClientRect: () => ({ width: parseFloat(styles.get('--statistics-w')) }) },
    localStorage: {
      getItem(key) { if (storageFails) throw new Error('Storage unavailable'); return stored.get(key); },
      setItem(key, value) { if (storageFails) throw new Error('Storage unavailable'); stored.set(key, value); },
    },
  });
  vm.runInContext(source.slice(source.indexOf('  const STATISTICS_MIN ='), source.indexOf('  const setMenuCollapsed =')), context);
  return { handle, stored, attributes, width: () => parseFloat(styles.get('--statistics-w')),
    resize: width => { window.innerWidth = width; resize(); } };
}

test('statistics width follows its left divider and saves only the captured pointer on completion', () => {
  const state = statisticsResizeContext();
  assert.equal(state.width(), 280);
  state.handle.fire('pointerdown', { button: 2 });
  state.handle.fire('pointermove', { clientX: 400 });
  assert.equal(state.width(), 280);
  state.handle.fire('pointerdown');
  state.handle.fire('pointermove', { pointerId: 2, clientX: 400 });
  assert.equal(state.width(), 280);
  state.handle.fire('pointermove', { clientX: 400 });
  assert.equal(state.width(), 380);
  state.handle.fire('pointerup', { pointerId: 2 });
  assert.equal(state.stored.has('statisticsW'), false);
  state.handle.fire('pointercancel');
  assert.equal(state.stored.get('statisticsW'), '380');
  state.handle.fire('pointermove', { clientX: 200 });
  assert.equal(state.width(), 380);
  assert.equal(statisticsResizeContext(state.stored.get('statisticsW')).width(), 380);
});

test('statistics keyboard bounds and viewport clamping retain the preferred width', () => {
  const state = statisticsResizeContext('400');
  state.handle.fire('keydown', { key: 'ArrowLeft' });
  assert.equal(state.width(), 420);
  state.handle.fire('keydown', { key: 'ArrowRight' });
  assert.equal(state.width(), 400);
  state.handle.fire('keydown', { key: 'Home' });
  state.handle.fire('keydown', { key: 'ArrowRight' });
  assert.equal(state.width(), 280);
  state.handle.fire('keydown', { key: 'End' });
  assert.equal(state.width(), 720);
  state.resize(960);
  assert.equal(state.width(), 467);
  assert.equal(state.attributes.get('aria-valuenow'), '467');
  assert.equal(state.stored.get('statisticsW'), '720');
  const restored = statisticsResizeContext(state.stored.get('statisticsW'));
  assert.equal(restored.width(), 720);
  state.resize(1400);
  assert.equal(state.width(), 720);
  for (const saved of ['bad', 'Infinity', '-10', '0', 'null']) {
    assert.equal(statisticsResizeContext(saved).width(), 280);
  }
  const unavailable = statisticsResizeContext(undefined, true);
  unavailable.handle.fire('keydown', { key: 'ArrowLeft' });
  assert.equal(unavailable.width(), 300);
});