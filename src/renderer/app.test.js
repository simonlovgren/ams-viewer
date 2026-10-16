'use strict';
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { test } = require('node:test');
const vm = require('node:vm');

function rendererContext(document = { querySelectorAll: () => [] }, globals = {}) {
  const source = readFileSync(require.resolve('./app.js'), 'utf8');
  const context = vm.createContext({ Intl, document, ...globals });
  vm.runInContext("const F = {sel: [], loc: []}; const expanded = new Set(); let fseq = 0; const icon = () => '';" +
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
  for (const action of ['cancel', 'accept', 'escape', 'native-cancel', 'message']) {
    let focused, restored = 0;
    const listeners = {};
    const dialog = {
      open: false,
      addEventListener: (name, listener) => { listeners[name] = listener; },
      showModal() { this.open = true; },
      close(value) { this.returnValue = value; this.open = false; listeners.close(); },
    };
    const elements = { '#message-dialog': dialog };
    for (const name of ['cancel', 'accept', 'title', 'body']) {
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
    const result = vm.runInContext(`showMessage({title:'Remove?',message:'<img src=x onerror=bad()>',confirmLabel:${action === 'message' ? 'undefined' : "'Remove'"}})`, context);
    assert.equal(dialog.open, true);
    assert.equal(focused, action === 'message' ? 'accept' : 'cancel');
    assert.equal(elements['#message-cancel'].hidden, action === 'message');
    assert.equal(elements['#message-body'].textContent, '<img src=x onerror=bad()>');
    assert.equal(await vm.runInContext("showMessage({title:'Duplicate',message:'Ignored'})", context), false);
    if (action === 'escape' || action === 'native-cancel') {
      let prevented = false;
      listeners[action === 'escape' ? 'keydown' : 'cancel']({ key: 'Escape', preventDefault() { prevented = true; } });
      assert.equal(prevented, true);
    } else elements['#message-' + (action === 'cancel' ? 'cancel' : 'accept')].click();
    assert.equal(await result, action === 'accept' || action === 'message');
    assert.equal(restored, 1);
    assert.equal(dialog.open, false);
  }
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

test('pending counts hide stale values and zero styling, including rebuilt trees', () => {
  const count = { textContent: '0', title: '0' };
  let zeroRemoved = false;
  const evaluate = rendererContext({ querySelectorAll: selector => selector === '[data-collapse-tree]' ? [] : selector.includes('.cnt') ? [count] : [{ classList: { remove: () => { zeroRemoved = true; } } }] });
  evaluate('facetPending = false; markFacetsPending()');
  assert.equal(evaluate('fseq'), 1);
  assert.equal(count.textContent, '...');
  assert.equal(count.title, 'Updating counts');
  assert.equal(zeroRemoved, true);
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

test('Settings joins history navigation without losing list scroll', () => {
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
  });
  vm.runInContext(source.slice(source.indexOf('  let idx ='), source.indexOf('  function back()')), context);
  vm.runInContext("nav('settings')", context);
  assert.equal(states[0].view, 'settings');
  assert.equal(views.get('settings').has('hidden'), false);
  assert.equal(views.get('list').has('hidden'), true);
  assert.equal(links.find(link => link.dataset.view === 'settings').active, true);
  listScroll.scrollTop = 0;
  vm.runInContext("show('list')", context);
  assert.equal(listScroll.scrollTop, 240);
  assert.equal(views.get('settings').has('hidden'), true);
});

function widgetContext(saved, storageFails = false) {
  const source = readFileSync(require.resolve('./app.js'), 'utf8');
  const stored = new Map(saved === undefined ? [] : [['collapsedWidgets', saved]]);
  const widgets = ['timeline', 'published', 'occupation', 'location', 'employment', 'hours'].map(key => {
    const attributes = new Map([['aria-controls', 'widget-' + key]]);
    const button = {
      setAttribute: (name, value) => attributes.set(name, value),
      getAttribute: name => attributes.get(name),
      addEventListener: (name, listener) => { button.click = listener; },
    };
    const body = {};
    const badge = { setAttribute: () => {} };
    return { dataset: { widget: key }, button, body, badge, querySelector: selector => selector === '.widget-toggle' ? button : selector === '.widget-active' ? badge : body };
  });
  const filters = { from: '', to: '', sel: [], loc: [], emp: '', hours: '' };
  const context = vm.createContext({
    F: filters, document: { querySelectorAll: () => widgets },
    $: (selector, root) => root.querySelector(selector),
    localStorage: {
      getItem: key => { if (storageFails) throw new Error('Storage unavailable'); return stored.get(key); },
      setItem: (key, value) => { if (storageFails) throw new Error('Storage unavailable'); stored.set(key, value); },
    },
  });
  vm.runInContext(source.slice(source.indexOf('  /* ---------- collapsible widgets'), source.indexOf('  /* ---------- settings')), context);
  vm.runInContext('initWidgets()', context);
  return { widgets, filters, stored, update: () => vm.runInContext('updateWidgets()', context) };
}

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
  assert.deepEqual(widgets.map(widget => widget.badge.textContent), ['0', '2', '2', '1', '1', '1']);
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