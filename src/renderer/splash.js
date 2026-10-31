'use strict';
const $ = (id) => document.getElementById(id);
let started = null;
let catalog = [];
let opening = false;

setInterval(() => {
  if (started !== null) $('elapsed').textContent = Math.floor((Date.now() - started) / 1000) + ' s';
}, 500);

function showDataset() {
  const entry = catalog.find((dataset) => dataset.id === $('dataset').value);
  if (!entry) return;
  const stats = entry.stats;
  const counts = stats ? `${stats.sourceCount.toLocaleString('en-US')} files / ${stats.total.toLocaleString('en-US')} ads` : 'Statistics unavailable';
  $('dataset-meta').textContent = [entry.description.split(/\r?\n/)[0], counts].filter(Boolean).join(' / ');
  $('dataset-meta').title = entry.description;
}

$('dataset').addEventListener('change', showDataset);
$('cancel').addEventListener('click', () => window.splash.cancel());
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !opening) window.splash.cancel();
});
$('chooser').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (opening || $('open').disabled) return;
  opening = true;
  $('selection-error').textContent = '';
  for (const id of ['dataset', 'open', 'cancel']) $(id).disabled = true;
  try {
    await window.splash.openDataset($('dataset').value);
    $('chooser').hidden = true;
    $('loading').hidden = false;
  } catch (error) {
    opening = false;
    $('selection-error').textContent = `Could not open dataset: ${error.message || error}`;
    for (const id of ['dataset', 'open', 'cancel']) $(id).disabled = false;
    $('open').focus();
  }
});

window.splash.datasets().then((result) => {
  catalog = result.datasets;
  for (const entry of catalog) {
    const option = document.createElement('option');
    option.value = entry.id;
    option.textContent = entry.name;
    option.title = entry.name;
    $('dataset').appendChild(option);
  }
  $('dataset').value = result.activeId;
  $('dataset').disabled = false;
  $('open').disabled = false;
  showDataset();
  $('dataset').focus();
}).catch((error) => {
  $('selection-error').textContent = `Could not list datasets: ${error.message || error}`;
});

window.splash.onProgress(({ pct, text }) => {
  if (started === null) started = Date.now();
  $('chooser').hidden = true;
  $('loading').hidden = false;
  $('fill').style.width = Math.max(0, Math.min(100, pct)) + '%';
  $('pct').textContent = Math.round(pct) + '%';
  if (text) $('stage').textContent = text;
});
