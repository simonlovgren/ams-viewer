'use strict';
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const api = window.api;

  /* ---------- icons ---------- */
  const ICONS = {
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    database: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0 0 18 0V5"/><path d="M3 12a9 3 0 0 0 18 0"/>',
    briefcase: '<rect width="20" height="14" x="2" y="7" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>',
    'map-pin': '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
    calendar: '<rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    'chev-r': '<path d="m9 18 6-6-6-6"/>',
    'chev-d': '<path d="m6 9 6 6 6-6"/>',
    'arrow-left': '<path d="m12 19-7-7 7-7M19 12H5"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5M12 3v12"/>',
    trash: '<path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
    layers: '<path d="m12 2 10 5-10 5L2 7l10-5Z"/><path d="m2 17 10 5 10-5M2 12l10 5 10-5"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
    tag: '<path d="M12 2H2v10l9.3 9.3a1 1 0 0 0 1.4 0l8.6-8.6a1 1 0 0 0 0-1.4L12 2Z"/><circle cx="7" cy="7" r="1.5"/>',
    building: '<rect width="16" height="20" x="4" y="2" rx="2"/><path d="M9 22v-4h6v4M8 6h.01M16 6h.01M12 6h.01M12 10h.01M12 14h.01M16 10h.01M16 14h.01M8 10h.01M8 14h.01"/>',
    external: '<path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
    filter: '<path d="M22 3H2l8 9.5V19l4 2v-8.5L22 3Z"/>',
    car: '<path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/>',
    'panel-left': '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/>',
    'trending-up': '<path d="m22 7-8.5 8.5-5-5L2 17"/><path d="M16 7h6v6"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    mail: '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-10 6L2 7"/>',
    phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z"/>',
    banknote: '<rect width="20" height="12" x="2" y="6" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/>',
    hash: '<path d="M4 9h16M4 15h16M10 3 8 21M16 3l-2 18"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  };
  const icon = (n) => `<svg viewBox="0 0 24 24">${ICONS[n] || ''}</svg>`;
  const hydrateIcons = (root = document) =>
    root.querySelectorAll('[data-i]').forEach((el) => { if (!el.firstChild) el.innerHTML = icon(el.dataset.i); });

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtNum = (n) => Number(n || 0).toLocaleString('en-GB');
  const parseDate = (s) => (s ? new Date(String(s).slice(0, 10) + 'T00:00:00') : null);
  const fmtDate = (s, long) => {
    const d = parseDate(s);
    return d && !isNaN(d) ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', ...(long ? { weekday: 'short' } : {}) }) : '';
  };

  /* ---------- filter state ---------- */
  const DEF = { terms: [], termMode: 'and', sel: [], loc: [], from: '', to: '', emp: '', hours: '', sort: 'newest' };
  let F = { ...DEF };
  try { F = { ...DEF, ...JSON.parse(localStorage.getItem('filters') || '{}') }; } catch { /* ignore */ }
  if (!Array.isArray(F.sel) || !Array.isArray(F.loc)) {
    // migrate single-selection filters saved by earlier versions
    const l = F.lbl || {};
    F.sel = [];
    F.loc = [];
    if (F.occ) F.sel.push({ k: 'occ', id: F.occ, label: l.occ || F.occ, fi: F.field, gi: F.group });
    else if (F.group) F.sel.push({ k: 'group', id: F.group, label: l.group || F.group, fi: F.field, gi: F.group });
    else if (F.field) F.sel.push({ k: 'field', id: F.field, label: l.field || F.field, fi: F.field });
    if (F.muni) F.loc.push({ k: 'muni', id: F.muni, label: F.muni, ri: F.region });
    else if (F.region) F.loc.push({ k: 'region', id: F.region, label: F.region, ri: F.region });
  }
  for (const k of ['field', 'group', 'occ', 'region', 'muni', 'lbl']) delete F[k];
  // The text being typed used to be a live filter (`q`); keep what an older version saved as an entry.
  if (F.q && F.q.trim()) F.terms = [...F.terms, F.q.trim()];
  delete F.q;
  const expanded = new Set(JSON.parse(localStorage.getItem('expanded') || '[]'));
  const saveF = () => localStorage.setItem('filters', JSON.stringify(F));
  const saveExp = () => localStorage.setItem('expanded', JSON.stringify([...expanded]));

  let reloadTimer;
  function setF(patch, { immediate = true } = {}) {
    F = { ...F, ...patch };
    saveF();
    syncInputs();
    renderActive();
    clearTimeout(reloadTimer);
    reloadTimer = setTimeout(reload, immediate ? 0 : 180);
  }

  /* ---------- navigation / history ---------- */
  let idx = 0;
  let curView = 'list';
  let listScroll = 0;

  function show(view, id) {
    if (curView === 'list') listScroll = $('#list-scroll').scrollTop;
    curView = view;
    for (const v of ['list', 'ad', 'data']) $('#view-' + v).classList.toggle('hidden', v !== view);
    document.querySelectorAll('.nav').forEach((n) => n.classList.toggle('active', n.dataset.view === (view === 'ad' ? 'list' : view)));
    if (view === 'list') $('#list-scroll').scrollTop = listScroll;
    if (view === 'ad') loadAd(id);
    if (view === 'data') renderData();
  }
  function nav(view, id) {
    if (view === curView && view !== 'ad') return;
    history.pushState({ view, id, i: ++idx }, '');
    show(view, id);
  }
  function back() { if (idx > 0) history.back(); else nav('list'); }
  window.addEventListener('popstate', (e) => {
    const s = e.state || { view: 'list', i: 0 };
    idx = s.i || 0;
    show(s.view, s.id);
  });
  history.replaceState({ view: 'list', i: 0 }, '');

  const editable = (t) => t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Backspace' && !editable(e.target)) { e.preventDefault(); back(); }
    else if (e.altKey && e.key === 'ArrowLeft') { e.preventDefault(); back(); }
    else if (e.altKey && e.key === 'ArrowRight') { e.preventDefault(); history.forward(); }
    else if (e.key === '/' && !editable(e.target)) { e.preventDefault(); nav('list'); $('#q').focus(); }
  });
  document.addEventListener('mouseup', (e) => {
    if (e.button === 3) { e.preventDefault(); back(); }
    else if (e.button === 4) { e.preventDefault(); history.forward(); }
  });

  document.querySelectorAll('.nav').forEach((n) => {
    const go = () => nav(n.dataset.view);
    n.addEventListener('click', go);
    n.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
  });
  $('#back').addEventListener('click', back);

  /* ---------- list ---------- */
  const PAGE = 60;
  let seq = 0, loaded = 0, loading = false, done = false, total = 0, fseq = 0;
  const listEl = $('#list');

  function rowHtml(r) {
    const d = parseDate(r.pub_date);
    const tags = [
      r.muni && `<span class="tag t-loc">${icon('map-pin')}${esc(r.muni)}${r.region ? `<span style="opacity:.6">· ${esc(r.region.replace(/ län$/, ''))}</span>` : ''}</span>`,
      r.field && `<span class="tag t-field">${icon('layers')}${esc(r.field)}</span>`,
      r.grp && `<span class="tag t-group">${icon('users')}${esc(r.grp)}</span>`,
      r.occ && `<span class="tag t-occ">${icon('tag')}${esc(r.occ)}</span>`,
      r.hours && `<span class="tag t-misc">${icon('clock')}${esc(r.hours)}</span>`,
      r.emp_type && `<span class="tag t-misc">${esc(r.emp_type)}</span>`,
    ].filter(Boolean).join('');
    return `<div class="row" tabindex="0" data-id="${esc(r.ad_id)}">
      <div class="date"><b>${d ? d.getDate() + ' ' + d.toLocaleDateString('en-GB', { month: 'short' }) : '–'}</b><span>${d ? d.getFullYear() : ''}</span></div>
      <div class="main"><div class="title">${esc(r.headline || '(no title)')}</div>
      <div class="sub">${esc(r.employer || '')}</div><div class="tags">${tags}</div></div></div>`;
  }

  function updateCount() {
    $('#count').textContent = total ? `${fmtNum(total)} ads` : '';
  }

  async function loadMore(first, s) {
    if (loading || done) return;
    loading = true;
    try {
      const res = await api.search(F, loaded, PAGE, first);
      if (s !== seq) return;
      if (first) total = res.total;
      loaded += res.rows.length;
      if (res.rows.length < PAGE) done = true;
      listEl.insertAdjacentHTML('beforeend', res.rows.map(rowHtml).join(''));
      if (first && !res.rows.length) listEl.innerHTML = '<div class="state">No ads match the current filters.</div>';
      updateCount();
    } finally {
      if (s === seq) loading = false;
    }
    maybeMore(s);
  }
  function maybeMore(s) {
    requestAnimationFrame(() => {
      if (s !== seq || done || curView !== 'list') return;
      const sc = $('#list-scroll');
      if ($('#sentinel').getBoundingClientRect().top < sc.getBoundingClientRect().bottom + 500) loadMore(false, s);
    });
  }
  $('#list-scroll').addEventListener('scroll', () => maybeMore(seq), { passive: true });

  async function reload() {
    const s = ++seq;
    loaded = 0; done = false; loading = false;
    listEl.innerHTML = '';
    $('#list-scroll').scrollTop = 0;
    loadMore(true, s);
    const fs_ = ++fseq;
    const data = await api.facets(F);
    if (fs_ === fseq) renderFacets(data);
  }

  listEl.addEventListener('click', (e) => {
    const row = e.target.closest('.row');
    if (row) nav('ad', row.dataset.id);
  });
  listEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.classList.contains('row')) nav('ad', e.target.dataset.id);
  });

  /* ---------- filter panel ---------- */
  let facetData = null;
  const nodeIndex = new Map();

  function buildOcc(rows) {
    const fields = new Map();
    for (const r of rows) {
      const fk = r.fi || '';
      let f = fields.get(fk);
      if (!f) fields.set(fk, (f = { k: 'field', id: r.fi, label: r.f || 'Unspecified', n: 0, kids: new Map(), path: { field: { id: r.fi, label: r.f } } }));
      f.n += r.n;
      const gk = r.gi || '';
      let g = f.kids.get(gk);
      if (!g) f.kids.set(gk, (g = { k: 'group', id: r.gi, label: r.g || 'Unspecified', n: 0, kids: new Map(), path: { ...f.path, group: { id: r.gi, label: r.g } } }));
      g.n += r.n;
      g.kids.set(r.oi || '', { k: 'occ', id: r.oi, label: r.o || 'Unspecified', n: r.n, kids: new Map(), path: { ...g.path, occ: { id: r.oi, label: r.o } } });
    }
    return sortNodes(fields);
  }
  function buildLoc(rows) {
    const regs = new Map();
    for (const r of rows) {
      const rk = r.r || '';
      let g = regs.get(rk);
      if (!g) regs.set(rk, (g = { k: 'region', id: r.r, label: r.r || 'Unspecified', n: 0, kids: new Map(), path: { region: r.r } }));
      g.n += r.n;
      g.kids.set(r.m || '', { k: 'muni', id: r.m, label: r.m || 'Unspecified', n: r.n, kids: new Map(), path: { region: r.r, muni: r.m } });
    }
    return sortNodes(regs);
  }
  function sortNodes(map) {
    const arr = [...map.values()].sort((a, b) => a.label.localeCompare(b.label, 'sv'));
    for (const n of arr) n.kids = sortNodes(n.kids);
    return arr;
  }

  const isSel = (n) => {
    if (n.k === 'field' || n.k === 'group' || n.k === 'occ') return F.sel.some((s) => s.k === n.k && s.id === n.id);
    if (n.k === 'region') return F.loc.some((s) => s.k === 'region' && s.id === n.id);
    return F.loc.some((s) => s.k === 'muni' && s.id === n.id && s.ri === n.path.region);
  };

  function treeHtml(nodes, filter, depth = 0) {
    const f = filter.toLowerCase();
    let out = '';
    for (const n of nodes) {
      const self = !f || n.label.toLowerCase().includes(f);
      const kidsMatch = f && n.kids.length && n.kids.some(function m(c) { return c.label.toLowerCase().includes(f) || c.kids.some(m); });
      if (f && !self && !kidsMatch) continue;
      const key = n.k + ':' + (n.path.region ? n.path.region + '|' : '') + (n.id || '');
      nodeIndex.set(key, n);
      const open = f ? kidsMatch : expanded.has(key);
      const hasKids = n.kids.length > 0;
      out += `<div class="node${isSel(n) ? ' sel' : ''}${n.n ? '' : ' zero'}" data-key="${esc(key)}">
        <span class="tg${hasKids ? '' : ' none'}">${icon(open ? 'chev-d' : 'chev-r')}</span>
        <span class="lbl" title="${esc(n.label)}">${esc(n.label)}</span><span class="cnt">${fmtNum(n.n)}</span></div>`;
      if (open && hasKids) out += `<div class="kids">${treeHtml(n.kids, f && !self ? filter : '', depth + 1)}</div>`;
    }
    return out;
  }

  function renderTrees() {
    if (!facetData) return;
    nodeIndex.clear();
    const t1 = buildOcc(facetData.occ);
    const t2 = buildLoc(facetData.loc);
    $('#tree-occ').innerHTML = treeHtml(t1, $('#tf-occ').value.trim()) || '<div class="empty-mini">Nothing found</div>';
    $('#tree-loc').innerHTML = treeHtml(t2, $('#tf-loc').value.trim()) || '<div class="empty-mini">Nothing found</div>';
  }

  function chipsHtml(items, isOn) {
    return items.map((i) => `<span class="chip${isOn(i) ? ' on' : ''}${i.n ? '' : ' zero'}" data-v="${esc(i.v)}">${esc(i.label)} <small>${fmtNum(i.n)}</small></span>`).join('');
  }

  function renderFacets(d) {
    facetData = d;
    renderTrees();
    $('#chips-year').innerHTML = chipsHtml(
      d.year.filter((r) => r.y).map((r) => ({ v: r.y, label: r.y, n: r.n })),
      (i) => F.from === `${i.v}-01-01` && F.to === `${i.v}-12-31`
    );
    $('#chips-emp').innerHTML = chipsHtml(d.emp.filter((r) => r.v).map((r) => ({ v: r.v, label: r.v, n: r.n })), (i) => F.emp === i.v);
    $('#chips-hours').innerHTML = chipsHtml(d.hours.filter((r) => r.v).map((r) => ({ v: r.v, label: r.v, n: r.n })), (i) => F.hours === i.v);
    timelineData = d.timeline;
    renderChart();
  }

  /* ---------- ads-over-time chart ---------- */
  let timelineData = null;
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const dparts = (s) => s.split('-').map(Number);
  const addDays = (s, n) => new Date(Date.parse(s) + n * 864e5).toISOString().slice(0, 10);
  const isoWeek = (s) => {
    const d = new Date(Date.parse(s));
    d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7) + 3);
    const jan4 = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
    return 1 + Math.round(((d - jan4) / 864e5 - 3 + ((jan4.getUTCDay() + 6) % 7)) / 7);
  };
  const compact = (n) => (n >= 10000 ? Math.round(n / 1000) + 'k' : n >= 1000 ? (n / 1000).toFixed(1).replace('.0', '') + 'k' : String(n));

  // Axis label for a bin: pri 0 = first bin, 1 = calendar landmark (year/month), 2 = filler (month, week, day).
  function axisLabel(p, i, pts, unit) {
    const [y, m, d] = dparts(p.d);
    const first = i === 0;
    if (unit === 'year') return { text: String(y), pri: 1 };
    if (unit === 'month') {
      if (m === 1) return { text: String(y), pri: first ? 0 : 1 };
      if (first) return { text: `${MON[m - 1]} ${y}`, pri: 0 };
      return pts.length <= 40 ? { text: MON[m - 1], pri: 2 } : null;
    }
    if (unit === 'week') {
      const [, m2] = dparts(addDays(p.d, 6));
      const [y2] = dparts(addDays(p.d, 6));
      if (first) return { text: `${d} ${MON[m - 1]}`, pri: 0 };
      if (d === 1 || m2 !== m) return { text: m2 === 1 ? String(y2) : MON[m2 - 1], pri: 1 };
      return { text: 'w' + isoWeek(p.d), pri: 2 };
    }
    if (first) return { text: `${d} ${MON[m - 1]}`, pri: 0 };
    if (d === 1) return { text: m === 1 ? String(y) : MON[m - 1], pri: 1 };
    return { text: String(d), pri: 2 };
  }

  function pointTitle(p, unit) {
    const [y, m, d] = dparts(p.d);
    if (unit === 'year') return String(y);
    if (unit === 'month') return `${MON[m - 1]} ${y}`;
    const base = `${d} ${MON[m - 1]} ${y}`;
    return unit === 'week' ? `Week ${isoWeek(p.d)} (from ${base})` : new Date(Date.parse(p.d)).toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' }) + ' ' + base;
  }

  function renderChart() {
    const box = $('#chart');
    const t = timelineData;
    const W = Math.max(160, box.clientWidth);
    if (!t || !t.points.length) { box.innerHTML = '<div class="empty-mini">No data</div>'; return; }
    const H = 132, L = 34, R = 10, T = 10, B = 22;
    const pts = t.points;
    const n = pts.length;
    const max = Math.max(1, ...pts.map((p) => p.n));
    const total = pts.reduce((s, p) => s + p.n, 0);
    const xs = (i) => (n === 1 ? (L + W - R) / 2 : L + (i * (W - L - R)) / (n - 1));
    const ys = (v) => T + (1 - v / max) * (H - T - B);
    const line = pts.map((p, i) => `${i ? 'L' : 'M'}${xs(i).toFixed(1)},${ys(p.n).toFixed(1)}`).join('');
    const area = `${line}L${xs(n - 1).toFixed(1)},${H - B}L${xs(0).toFixed(1)},${H - B}Z`;

    const cands = pts.map((p, i) => ({ i, ...axisLabel(p, i, pts, t.unit) })).filter((c) => c.text);
    const placed = [];
    const fits = (x, w) => placed.every((q) => Math.abs(q.x - x) >= (q.w + w) / 2 + 6);
    for (const pri of [0, 1, 2]) {
      for (const c of cands.filter((q) => q.pri === pri)) {
        const w = c.text.length * 6.2;
        const x = xs(c.i);
        if (x - w / 2 >= 0 && x + w / 2 <= W && fits(x, w)) placed.push({ x, w, text: c.text, pri });
      }
    }
    const labels = placed.map((q) => `<line class="ch-tick" x1="${q.x.toFixed(1)}" x2="${q.x.toFixed(1)}" y1="${H - B}" y2="${H - B + 3}"/><text class="ch-lab${q.pri === 2 ? ' dim' : ''}" x="${q.x.toFixed(1)}" y="${H - 6}" text-anchor="middle">${esc(q.text)}</text>`).join('');
    const dots = n <= 40 ? pts.map((p, i) => `<circle class="ch-dot" cx="${xs(i).toFixed(1)}" cy="${ys(p.n).toFixed(1)}" r="2.2"/>`).join('') : '';

    box.innerHTML = `<div class="chart-sub">${esc(fmtNum(total))} ads · per ${t.unit} · ${esc(t.from)} → ${esc(t.to)}</div>
      <svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
        <defs>
          <linearGradient id="cg-line" gradientUnits="userSpaceOnUse" x1="${L}" x2="${W - R}" y1="0" y2="0"><stop offset="0" stop-color="#2dd4bf"/><stop offset=".35" stop-color="#60a5fa"/><stop offset=".7" stop-color="#a78bfa"/><stop offset="1" stop-color="#f472b6"/></linearGradient>
          <linearGradient id="cg-area" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#a78bfa" stop-opacity=".35"/><stop offset="1" stop-color="#a78bfa" stop-opacity="0"/></linearGradient>
        </defs>
        <line class="ch-grid" x1="${L}" x2="${W - R}" y1="${ys(max)}" y2="${ys(max)}"/>
        <line class="ch-grid" x1="${L}" x2="${W - R}" y1="${ys(max / 2)}" y2="${ys(max / 2)}"/>
        <line class="ch-base" x1="${L}" x2="${W - R}" y1="${H - B}" y2="${H - B}"/>
        <text class="ch-lab" x="${L - 5}" y="${ys(max) + 3.5}" text-anchor="end">${compact(max)}</text>
        <text class="ch-lab" x="${L - 5}" y="${H - B + 3.5}" text-anchor="end">0</text>
        <path d="${area}" fill="url(#cg-area)"/>
        <path d="${line}" fill="none" stroke="url(#cg-line)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
        ${dots}${labels}
        <line id="ch-guide" class="ch-guide" x1="0" x2="0" y1="${T}" y2="${H - B}" visibility="hidden"/>
        <circle id="ch-hl" class="ch-hl" r="4" visibility="hidden"/>
        <rect id="ch-hit" x="${L}" y="0" width="${W - L - R}" height="${H}" fill="transparent"/>
      </svg><div id="chart-tip" class="chart-tip"></div>`;

    const hit = $('#ch-hit');
    const tip = $('#chart-tip');
    hit.addEventListener('mousemove', (e) => {
      const rect = hit.getBoundingClientRect();
      const i = n === 1 ? 0 : Math.max(0, Math.min(n - 1, Math.round(((e.clientX - rect.left) / rect.width) * (n - 1))));
      const x = xs(i);
      $('#ch-guide').setAttribute('x1', x); $('#ch-guide').setAttribute('x2', x); $('#ch-guide').setAttribute('visibility', 'visible');
      const hl = $('#ch-hl');
      hl.setAttribute('cx', x); hl.setAttribute('cy', ys(pts[i].n)); hl.setAttribute('visibility', 'visible');
      tip.textContent = `${pointTitle(pts[i], t.unit)}: ${fmtNum(pts[i].n)} ads`;
      tip.style.display = 'block';
      tip.style.left = Math.min(Math.max(0, x - tip.offsetWidth / 2), W - tip.offsetWidth) + 'px';
      tip.style.top = '22px';
    });
    hit.addEventListener('mouseleave', () => {
      $('#ch-guide').setAttribute('visibility', 'hidden');
      $('#ch-hl').setAttribute('visibility', 'hidden');
      tip.style.display = 'none';
    });
  }
  new ResizeObserver(() => { if (timelineData) renderChart(); }).observe($('#chart'));

  function treeClick(e) {
    const el = e.target.closest('.node');
    if (!el) return;
    const n = nodeIndex.get(el.dataset.key);
    if (!n) return;
    const key = el.dataset.key;
    if (e.target.closest('.tg')) {
      expanded.has(key) ? expanded.delete(key) : expanded.add(key);
      saveExp();
      renderTrees();
      return;
    }
    if (n.id === null || n.id === undefined) return;
    const was = isSel(n);
    if (n.kids.length) { expanded.add(key); saveExp(); }
    const isOcc = n.k === 'field' || n.k === 'group' || n.k === 'occ';
    const list = isOcc ? 'sel' : 'loc';
    const fi = n.path.field?.id;
    const gi = n.path.group?.id;
    const ri = n.path.region;
    const same = (s) => s.k === n.k && s.id === n.id && (n.k !== 'muni' || s.ri === ri);
    let next;
    if (was) next = F[list].filter((s) => !same(s));
    else {
      // Narrower pick replaces its wider ancestors; wider pick replaces its narrower descendants.
      const drop = isOcc
        ? (s) =>
            (n.k !== 'field' && s.k === 'field' && s.id === fi) ||
            (n.k === 'occ' && s.k === 'group' && s.id === gi) ||
            (n.k === 'field' && s.fi === n.id) ||
            (n.k === 'group' && s.gi === n.id)
        : (s) => (n.k === 'muni' && s.k === 'region' && s.id === ri) || (n.k === 'region' && s.k === 'muni' && s.ri === n.id);
      next = [...F[list].filter((s) => !drop(s)), { k: n.k, id: n.id, label: n.label, fi, gi, ri }];
    }
    setF({ [list]: next });
  }
  $('#tree-occ').addEventListener('click', treeClick);
  $('#tree-loc').addEventListener('click', treeClick);
  $('#tf-occ').addEventListener('input', renderTrees);
  $('#tf-loc').addEventListener('input', renderTrees);

  $('#chips-year').addEventListener('click', (e) => {
    const c = e.target.closest('.chip');
    if (!c) return;
    const y = c.dataset.v;
    const on = F.from === `${y}-01-01` && F.to === `${y}-12-31`;
    setF(on ? { from: '', to: '' } : { from: `${y}-01-01`, to: `${y}-12-31` });
  });
  const singleChip = (sel, key) => $(sel).addEventListener('click', (e) => {
    const c = e.target.closest('.chip');
    if (c) setF({ [key]: F[key] === c.dataset.v ? '' : c.dataset.v });
  });
  singleChip('#chips-emp', 'emp');
  singleChip('#chips-hours', 'hours');

  $('#f-from').addEventListener('change', (e) => setF({ from: e.target.value }));
  $('#f-to').addEventListener('change', (e) => setF({ to: e.target.value }));
  $('#q').addEventListener('keydown', (e) => {
    const t = e.target;
    if (e.key === 'Enter' && t.value.trim()) {
      e.preventDefault();
      const term = t.value.trim();
      t.value = '';
      setF({ terms: [...F.terms, term] });
    } else if (e.key === 'Backspace' && F.terms.length && t.selectionStart === 0 && t.selectionEnd === 0) {
      e.preventDefault();
      setF({ terms: F.terms.slice(0, -1) });
    }
  });
  $('#terms').addEventListener('click', (e) => {
    const x = e.target.closest('.x');
    if (x) setF({ terms: F.terms.filter((_, i) => i !== +x.dataset.i) });
    $('#q').focus();
  });
  $('#sort').addEventListener('change', (e) => setF({ sort: e.target.value }));
  $('#mode-toggle').addEventListener('click', () => setF({ termMode: F.termMode === 'or' ? 'and' : 'or' }));
  $('#clear-all').addEventListener('click', () => {
    $('#q').value = '';
    setF({ ...DEF, sort: F.sort });
  });

  function syncInputs() {
    $('#terms').innerHTML = F.terms.map((t, i) => `<span class="term">${esc(t)}<span class="x" data-i="${i}" title="Remove">${icon('x')}</span></span>`).join('');
    $('#q').placeholder = F.terms.length ? 'Add another keyword…' : 'Type a keyword and press Enter, e.g. sjuksköterska or "hemtjänst"   ( / )';
    const mb = $('#mode-toggle');
    mb.textContent = F.termMode === 'or' ? 'OR' : 'AND';
    mb.classList.toggle('or', F.termMode === 'or');
    mb.title = F.termMode === 'or' ? 'Match any entry (OR). Click to require all entries (AND)' : 'Match all entries (AND). Click to match any entry (OR)';
    $('#f-from').value = F.from;
    $('#f-to').value = F.to;
    $('#sort').value = F.sort;
  }

  function renderActive() {
    const items = [];
    F.sel.forEach((s, i) => items.push([s.k, { field: 'layers', group: 'users', occ: 'tag' }[s.k], s.label, ['sel#' + i]]));
    F.loc.forEach((s, i) => items.push([s.k, 'map-pin', s.label, ['loc#' + i]]));
    if (F.from || F.to) items.push(['date', 'calendar', `${F.from || '…'} → ${F.to || '…'}`, ['from', 'to']]);
    if (F.emp) items.push(['emp', 'briefcase', F.emp, ['emp']]);
    if (F.hours) items.push(['hours', 'clock', F.hours, ['hours']]);
    $('#active').innerHTML = items
      .map(([k, ic, text], i) => `<span class="chip fl on" data-i="${i}">${icon(ic)}${esc(text)}<span class="x">${icon('x')}</span></span>`)
      .join('');
    $('#active').onclick = (e) => {
      const c = e.target.closest('.chip');
      if (!c) return;
      const clear = items[+c.dataset.i][3];
      const patch = {};
      const drop = { sel: new Set(), loc: new Set() };
      clear.forEach((k) => {
        const m = /^(sel|loc)#(\d+)$/.exec(k);
        if (m) drop[m[1]].add(+m[2]);
        else patch[k] = '';
      });
      for (const l of ['sel', 'loc']) if (drop[l].size) patch[l] = F[l].filter((_, i) => !drop[l].has(i));
      setF(patch);
    };
  }

  /* ---------- ad view ---------- */
  let adSeq = 0;

  function fmtText(text) {
    let t = String(text || '').replace(/\r/g, '');
    t = t.replace(/(^|[.!?])\s+([A-ZÅÄÖ]{4,}(?:\s[A-ZÅÄÖ]{3,}){0,3})\s+(?=[A-ZÅÄÖ])/g, '$1\n\n$2\n');
    const lines = t.split('\n').map((s) => s.trim());
    const kind = lines.map((s, i) => {
      if (!s) return 'b';
      const next = lines.slice(i + 1).find((x) => x) ;
      const isCaps = s === s.toUpperCase() && /[A-ZÅÄÖ]{3}/.test(s);
      if (s.length <= 60 && !/[.,;!]$/.test(s) && (isCaps || /[:?]$/.test(s) || (next && lines[i + 1] && lines[i + 1].length > 90))) return 'h';
      return s.length <= 160 ? 's' : 'l';
    });
    let out = '';
    for (let i = 0; i < lines.length; i++) {
      const k = kind[i];
      if (k === 'b') continue;
      if (k === 'h') out += `<h3>${esc(lines[i].replace(/:$/, ''))}</h3>`;
      else if (k === 'l') out += `<p>${esc(lines[i])}</p>`;
      else {
        let j = i;
        while (j < lines.length && kind[j] === 's') j++;
        if (j - i >= 2) out += '<ul>' + lines.slice(i, j).map((x) => `<li>${esc(x)}</li>`).join('') + '</ul>';
        else out += `<p>${esc(lines[i])}</p>`;
        i = j - 1;
      }
    }
    return out || '<p>(No description)</p>';
  }

  const fact = (ic, label, value) => (value ? `<div class="fact"><span class="ic">${icon(ic)}</span><div><small>${esc(label)}</small><span class="v">${value}</span></div></div>` : '');
  const labels = (arr) => (arr || []).map((x) => x.label).filter(Boolean);
  const tagList = (arr, cls) => arr.map((x) => `<span class="tag ${cls}">${esc(x)}</span>`).join('');

  function applyHier(spec) {
    const patch = {};
    if ('field' in spec) patch.sel = [{ k: 'field', id: spec.field.id, label: spec.field.label, fi: spec.field.id }];
    if ('group' in spec) patch.sel = [{ k: 'group', id: spec.group.id, label: spec.group.label, fi: spec.field?.id, gi: spec.group.id }];
    if ('occ' in spec) patch.sel = [{ k: 'occ', id: spec.occ.id, label: spec.occ.label, fi: spec.field?.id, gi: spec.group?.id }];
    if ('muni' in spec) patch.loc = [{ k: 'muni', id: spec.muni, label: spec.muni, ri: spec.region }];
    else if ('region' in spec) patch.loc = [{ k: 'region', id: spec.region, label: spec.region, ri: spec.region }];
    setF(patch);
    nav('list');
  }

  async function loadAd(id) {
    const s = ++adSeq;
    $('#ad').innerHTML = '<div class="state">Loading…</div>';
    $('#crumbs').innerHTML = '';
    $('#ad-scroll').scrollTop = 0;
    const d = await api.get(id);
    if (s !== adSeq) return;
    if (!d) { $('#ad').innerHTML = '<div class="state">Ad not found.</div>'; return; }
    renderAd(d);
  }

  let adSpecs = [];
  function renderAd(d) {
    const first = (x) => (Array.isArray(x) ? x.find(Boolean) : x);
    const co = (o) => (o && o.label ? { id: o.concept_id || o.label, label: o.label } : null);
    const field = co(first(d.occupation_field)), group = co(first(d.occupation_group)), occ = co(first(d.occupation));
    const empType = [].concat(d.employment_type || []).map((x) => x && x.label).filter(Boolean).join(', ');
    const hoursLabel = first(d.working_hours_type)?.label;
    const a = d.workplace_address || {};
    const emp = d.employer || {};
    const det = d.application_details || {};
    adSpecs = [];
    const crumb = (label, ic, spec) => {
      adSpecs.push(spec);
      return `<a data-s="${adSpecs.length - 1}">${ic ? icon(ic) : ''}${esc(label)}</a>`;
    };
    const sep = icon('chev-r').replace('<svg', '<svg class="sep"');
    const parts = [`<a data-s="home">${icon('search')}Search</a>`];
    if (field) parts.push(crumb(field.label, '', { field }));
    if (group) parts.push(crumb(group.label, '', { field, group }));
    if (occ) parts.push(crumb(occ.label, '', { field, group, occ }));
    parts.push(`<span class="cur">${esc(d.headline || '')}</span>`);
    $('#crumbs').innerHTML = parts.join(sep);

    const tagA = (cls, ic, label, spec) => {
      if (!label) return '';
      adSpecs.push(spec);
      return `<a class="tag ${cls}" data-s="${adSpecs.length - 1}">${icon(ic)}${esc(label)}</a>`;
    };
    const scope = d.scope_of_work;
    const hoursTxt = [hoursLabel, scope && scope.max ? (scope.min === scope.max ? `${scope.max}%` : `${scope.min}–${scope.max}%`) : ''].filter(Boolean).join(' · ');
    const tags = [
      a.municipality && tagA('t-loc', 'map-pin', a.municipality, { muni: a.municipality, region: a.region }),
      a.region && tagA('t-loc', 'map-pin', a.region, { region: a.region }),
      field && tagA('t-field', 'layers', field.label, { field }),
      group && tagA('t-group', 'users', group.label, { field, group }),
      occ && tagA('t-occ', 'tag', occ.label, { field, group, occ }),
      empType && `<span class="tag t-misc">${esc(empType)}</span>`,
      hoursTxt && `<span class="tag t-misc">${icon('clock')}${esc(hoursTxt)}</span>`,
    ].filter(Boolean).join('');

    const name = emp.name || emp.workplace || '';
    const logo = d.logo_url
      ? `<div class="emp-logo"><img src="${esc(d.logo_url)}" alt="" referrerpolicy="no-referrer" data-fallback="${esc(name.slice(0, 1).toUpperCase())}"></div>`
      : `<div class="emp-logo ph">${esc((name || '?').slice(0, 1).toUpperCase())}</div>`;

    const reqBlock = (title, o) => {
      if (!o) return '';
      const rows = [
        ['Skills', labels(o.skills)], ['Languages', labels(o.languages)], ['Experience', labels(o.work_experiences)],
        ['Education', labels(o.education)], ['Education level', labels(o.education_level)],
      ].filter(([, v]) => v.length);
      if (!rows.length) return '';
      return `<div class="card"><h2>${title}</h2>${rows.map(([k, v]) => `<div style="margin-bottom:10px"><small style="color:var(--muted)">${k}</small><div class="tags" style="margin-top:4px">${tagList(v, title === 'Requirements' ? 't-field' : 't-group')}</div></div>`).join('')}</div>`;
    };

    const applyUrl = det.url || d.webpage_url || '';
    const contacts = (d.application_contacts || []).map((c) =>
      `<div style="margin-bottom:8px">${esc([c.name, c.description].filter(Boolean).join(' – '))}${c.email ? `<br><span style="color:var(--muted)">${esc(c.email)}</span>` : ''}${c.telephone ? `<br><span style="color:var(--muted)">${esc(c.telephone)}</span>` : ''}</div>`).join('');
    const howTo = [det.information, det.other, det.reference && `Reference: ${det.reference}`, det.email && `E-mail: ${det.email}`]
      .filter(Boolean).map((x) => `<p>${esc(x)}</p>`).join('');

    const loc = [a.street_address, [a.postcode, a.city].filter(Boolean).join(' '), a.municipality, a.region].filter(Boolean);
    const lic = labels(d.driving_license);
    const salary = [d.salary_type?.label, d.salary_description].filter(Boolean).map(esc).join('<br>');

    $('#ad').innerHTML = `
      <div class="ad-hero">
        <div class="hero-top">${logo}<div style="min-width:0">
          <h1>${esc(d.headline || '')}</h1>
          <div class="emp-name">${icon('building')}${esc(name)}</div></div></div>
        <div class="tags">${tags}</div>
      </div>
      <div class="ad-cols">
        <div>
          <div class="card"><h2>About the job</h2><div class="desc">${fmtText(d.description?.text)}</div></div>
          ${reqBlock('Requirements', d.must_have)}${reqBlock('Nice to have', d.nice_to_have)}
          ${howTo || contacts ? `<div class="card"><h2>How to apply</h2><div class="desc">${howTo}${contacts}</div></div>` : ''}
        </div>
        <div>
          <div class="card"><h2>At a glance</h2><div class="facts">
            ${fact('calendar', 'Published', esc(fmtDate(d.publication_date, true)))}
            ${fact('clock', 'Last application date', esc(fmtDate(d.application_deadline, true)))}
            ${fact('briefcase', 'Employment', esc(empType))}
            ${fact('clock', 'Working hours', esc(hoursTxt))}
            ${fact('calendar', 'Duration', esc(d.duration?.label))}
            ${fact('banknote', 'Salary', salary)}
            ${fact('users', 'Vacancies', d.number_of_vacancies ? esc(d.number_of_vacancies) : '')}
            ${fact('map-pin', 'Workplace', loc.map(esc).join('<br>'))}
            ${fact('car', 'Driving licence', (lic.length ? esc(lic.join(', ')) : '') + (d.access_to_own_car ? '<br>Own car required' : ''))}
            ${fact('check', 'Experience', d.experience_required ? 'Required' : '')}
            ${fact('hash', 'Ad ID', esc(d.id))}
          </div></div>
          ${name ? `<div class="card"><h2>Employer</h2><div class="facts">
            ${fact('building', 'Name', esc(name))}
            ${fact('hash', 'Org. number', esc(emp.organization_number))}
            ${fact('mail', 'E-mail', esc(emp.email))}
            ${fact('phone', 'Phone', esc(emp.phone_number))}
            ${fact('external', 'Website', esc(emp.url))}
          </div></div>` : ''}
          ${/^https?:\/\//i.test(applyUrl) ? `<button class="btn" id="apply-btn">${icon('external')}Open application page</button>` : ''}
        </div>
      </div>`;
    const im = $('#ad .emp-logo img');
    if (im) im.addEventListener('error', () => { const p = im.parentElement; p.classList.add('ph'); p.textContent = im.dataset.fallback || '?'; });
    const ab = $('#apply-btn');
    if (ab) ab.addEventListener('click', () => api.openExternal(applyUrl));
  }

  function adNavClick(e) {
    const el = e.target.closest('[data-s]');
    if (!el) return;
    if (el.dataset.s === 'home') return nav('list');
    applyHier(adSpecs[+el.dataset.s]);
  }
  $('#ad').addEventListener('click', adNavClick);
  $('#crumbs').addEventListener('click', adNavClick);

  /* ---------- data view ---------- */
  let importState = null;

  async function renderData() {
    const info = await api.info();
    $('#side-total').textContent = `${fmtNum(info.total)} ads`;
    const rows = info.sources.map((s) => `<tr><td>${icon('database').replace('<svg', '<svg style="vertical-align:-3px;margin-right:6px;color:var(--teal)"')}${esc(s.name)}</td>
      <td class="r">${fmtNum(s.ads)}</td><td>${esc((s.imported_at || '').slice(0, 10))}</td>
      <td class="r"><button class="btn sec danger" data-rm="${esc(s.name)}">${icon('trash')}Remove</button></td></tr>`).join('');
    $('#data').innerHTML = `
      <h1>Data sources</h1><div style="color:var(--muted)">Import JSONL / JSON ad files. Several files can be selected at once; ads already present are skipped.</div>
      <div class="stats">
        <div class="stat"><b>${fmtNum(info.total)}</b><small>ads stored</small></div>
        <div class="stat"><b>${fmtNum(info.sources.length)}</b><small>source files</small></div>
        <div class="stat"><b>${info.min ? esc(info.min.slice(0, 4)) + ' – ' + esc(info.max.slice(0, 4)) : '–'}</b><small>years covered</small></div>
      </div>
      <div class="drop" id="drop">${icon('upload').replace('<svg', '<svg style="width:32px;height:32px;color:var(--purple)"')}
        <div style="margin-top:8px">Drop .jsonl / .ndjson / .json files here</div>
        <button class="btn sec" id="pick" style="margin-top:12px">${icon('upload')}Choose files…</button></div>
      <div id="progress"></div>
      ${info.sources.length ? `<table><thead><tr><th>File</th><th class="r">Ads</th><th>Imported</th><th></th></tr></thead><tbody>${rows}</tbody></table>` : ''}`;
    renderProgress();
  }

  function renderProgress() {
    const el = $('#progress');
    if (!el || !importState) return;
    const s = importState;
    if (s.type === 'error') { el.innerHTML = `<div class="progress err">Import failed: ${esc(s.message)}</div>`; return; }
    if (s.type === 'done') { el.innerHTML = `<div class="progress">${icon('check')} Import finished.</div>`; return; }
    const overall = ((s.fileIndex + (s.pct || 0)) / s.files) * 100;
    el.innerHTML = `<div class="progress"><b>${esc(s.file)}</b> <span style="color:var(--muted)">(file ${s.fileIndex + 1} of ${s.files})</span>
      <div class="bar"><i style="width:${overall.toFixed(1)}%"></i></div>
      <small style="color:var(--muted)">${fmtNum(s.inserted)} added · ${fmtNum(s.skipped)} duplicates · ${fmtNum(s.errors)} errors</small></div>`;
  }

  async function startImport(promise) {
    const r = await promise;
    if (r && r.ok === false && !r.canceled) {
      importState = { type: 'error', message: r.error || 'Could not start import' };
      renderProgress();
    } else if (r && r.ok) {
      importState = { type: 'progress', file: '…', fileIndex: 0, files: r.count, inserted: 0, skipped: 0, errors: 0, pct: 0 };
      renderProgress();
    }
  }

  api.onImport((m) => {
    importState = m.type === 'file-done' ? importState : m;
    if (m.type === 'done' || m.type === 'error') {
      api.info().then((i) => ($('#side-total').textContent = `${fmtNum(i.total)} ads`));
      if (curView === 'data') { const keep = importState; renderData().then(() => { importState = keep; renderProgress(); }); }
      reload();
    } else renderProgress();
  });

  const dataEl = $('#data');
  dataEl.addEventListener('click', async (e) => {
    if (e.target.closest('#pick')) return startImport(api.importDialog());
    const rm = e.target.closest('[data-rm]');
    if (rm && confirm(`Remove all ads imported from ${rm.dataset.rm}?`)) {
      const r = await api.removeSource(rm.dataset.rm);
      if (r && r.ok === false) alert(r.error);
      await renderData();
      reload();
    }
  });
  window.addEventListener('dragover', (e) => { e.preventDefault(); $('#drop')?.classList.add('over'); });
  window.addEventListener('dragleave', () => $('#drop')?.classList.remove('over'));
  window.addEventListener('drop', (e) => {
    e.preventDefault();
    $('#drop')?.classList.remove('over');
    const paths = [...e.dataTransfer.files].map((f) => api.pathFor(f)).filter(Boolean);
    if (paths.length) { if (curView !== 'data') nav('data'); startImport(api.importFiles(paths)); }
  });

  /* ---------- layout: menu collapse, filter resize/collapse ---------- */
  const FILTER_MIN = 310;
  const clampFilterW = (w) => Math.max(FILTER_MIN, Math.min(Math.min(720, window.innerWidth * 0.6), w));
  let filterW = clampFilterW(+localStorage.getItem('filterW') || FILTER_MIN);
  const applyFilterW = () => document.documentElement.style.setProperty('--filter-w', clampFilterW(filterW) + 'px');
  applyFilterW();
  window.addEventListener('resize', applyFilterW);

  const resizer = $('#filters-resizer');
  resizer.addEventListener('pointerdown', (e) => {
    const startX = e.clientX;
    const startW = $('#filters').getBoundingClientRect().width;
    resizer.setPointerCapture(e.pointerId);
    resizer.classList.add('drag');
    document.body.style.userSelect = 'none';
    const move = (ev) => { filterW = clampFilterW(startW + ev.clientX - startX); applyFilterW(); };
    const up = () => {
      resizer.classList.remove('drag');
      document.body.style.userSelect = '';
      resizer.removeEventListener('pointermove', move);
      resizer.removeEventListener('pointerup', up);
      localStorage.setItem('filterW', String(filterW));
    };
    resizer.addEventListener('pointermove', move);
    resizer.addEventListener('pointerup', up);
  });

  const setFiltersCollapsed = (c) => {
    $('#view-list').classList.toggle('filters-collapsed', c);
    $('#filters-toggle').title = c ? 'Show filters' : 'Hide filters';
    localStorage.setItem('filtersCollapsed', c ? '1' : '');
  };
  $('#filters-toggle').addEventListener('click', () => setFiltersCollapsed(!$('#view-list').classList.contains('filters-collapsed')));
  setFiltersCollapsed(!!localStorage.getItem('filtersCollapsed'));

  const setMenuCollapsed = (c) => {
    document.body.classList.toggle('menu-collapsed', c);
    $('#menu-toggle').title = c ? 'Expand menu' : 'Collapse menu';
    localStorage.setItem('menuCollapsed', c ? '1' : '0');
  };
  $('#menu-toggle').addEventListener('click', () => setMenuCollapsed(!document.body.classList.contains('menu-collapsed')));
  setMenuCollapsed(localStorage.getItem('menuCollapsed') !== '0');

  /* ---------- init ---------- */
  hydrateIcons();
  syncInputs();
  renderActive();
  api.info().then((i) => {
    $('#side-total').textContent = `${fmtNum(i.total)} ads`;
    if (!i.total) nav('data');
  });
  reload();
})();
