'use strict';
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { test } = require('node:test');
const vm = require('node:vm');

function rendererContext(document = { querySelectorAll: () => [] }) {
  const source = readFileSync(require.resolve('./app.js'), 'utf8');
  const context = vm.createContext({ Intl, document });
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
      const context = vm.createContext({
        curView: view,
        document: { addEventListener: (name, listener) => { if (name === 'keydown') keydown = listener; } },
        $: selector => ({ focus: () => { focused = selector; } }),
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

test('tree leaves sum duplicate rows instead of replacing positive counts with zero', () => {
  const evaluate = rendererContext();
  assert.equal(evaluate("buildLoc([{r:'Region',m:'Town',n:3},{r:'Region',m:'Town',n:0}])[0].kids[0].n"), 3);
  assert.equal(evaluate("buildOcc([{fi:'f',gi:'g',oi:'o',n:3},{fi:'f',gi:'g',oi:'o',n:0}])[0].kids[0].kids[0].n"), 3);
});

test('pending counts hide stale values and zero styling, including rebuilt trees', () => {
  const count = { textContent: '0', title: '0' };
  let zeroRemoved = false;
  const evaluate = rendererContext({ querySelectorAll: selector => selector.includes('.cnt') ? [count] : [{ classList: { remove: () => { zeroRemoved = true; } } }] });
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