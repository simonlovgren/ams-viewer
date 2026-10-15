'use strict';
const $ = (id) => document.getElementById(id);
const started = Date.now();

setInterval(() => { $('elapsed').textContent = Math.floor((Date.now() - started) / 1000) + ' s'; }, 500);

window.splash.onProgress(({ pct, text }) => {
  $('fill').style.width = Math.max(0, Math.min(100, pct)) + '%';
  $('pct').textContent = Math.round(pct) + '%';
  if (text) $('stage').textContent = text;
});
