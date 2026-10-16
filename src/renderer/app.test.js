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