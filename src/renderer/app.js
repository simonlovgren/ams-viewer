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
    'chev-u': '<path d="m6 15 6-6 6 6"/>',
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
    'panel-right': '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M15 3v18"/>',
    'trending-up': '<path d="m22 7-8.5 8.5-5-5L2 17"/><path d="M16 7h6v6"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    mail: '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-10 6L2 7"/>',
    phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z"/>',
    banknote: '<rect width="20" height="12" x="2" y="6" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/>',
    hash: '<path d="M4 9h16M4 15h16M10 3 8 21M16 3l-2 18"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    settings: '<path d="M21 4h-7M10 4H3M21 12h-9M8 12H3M21 20h-5M12 20H3M14 2v4M8 10v4M16 18v4"/>',
    alert: '<circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>',
    loader: '<path d="M21 12a9 9 0 1 1-6.2-8.6"/>',
  };
  const icon = (n) => `<svg viewBox="0 0 24 24">${ICONS[n] || ''}</svg>`;
  const hydrateIcons = (root = document) =>
    root.querySelectorAll('[data-i]').forEach((el) => { if (!el.firstChild) el.innerHTML = icon(el.dataset.i); });

  /* ---------- notifications (UI-022) ---------- */
  // Running tasks appear only after a short delay so quick ones do not flash.
  const NOTICE_DELAY = 300;
  const notices = new Map();
  function paintNotice(n) {
    n.el.querySelector('.notice-text').textContent = n.text;
    const bar = n.el.querySelector('.notice-bar');
    if (!bar) return;
    const known = Number.isFinite(n.pct);
    bar.classList.toggle('indeterminate', !known);
    bar.firstChild.style.width = known ? `${Math.max(0, Math.min(100, n.pct))}%` : '';
  }
  function mountNotice(key, n) {
    const error = n.kind === 'error';
    n.el = document.createElement('div');
    n.el.className = `notice notice-${n.kind}`;
    n.el.setAttribute('role', error ? 'alert' : 'status');
    n.el.innerHTML = `<span class="notice-icon">${icon(error ? 'alert' : 'loader')}</span><div class="notice-body"><div class="notice-text"></div>${error ? '' : '<div class="bar notice-bar"><i></i></div>'}</div>`
      + (error ? `<button class="icon-btn notice-close" type="button" aria-label="Dismiss notification" title="Dismiss">${icon('x')}</button>` : '');
    if (error) n.el.querySelector('.notice-close').addEventListener('click', () => removeNotice(key));
    paintNotice(n);
    $('#notices').append(n.el);
  }
  function removeNotice(key) {
    const n = notices.get(key);
    if (!n) return;
    clearTimeout(n.timer);
    n.el?.remove();
    notices.delete(key);
  }
  function showTask(key, text, pct = null) {
    const current = notices.get(key);
    if (current?.kind === 'task') {
      Object.assign(current, { text, pct });
      if (current.el) paintNotice(current);
      return;
    }
    removeNotice(key);
    const task = { kind: 'task', text, pct };
    task.timer = setTimeout(() => mountNotice(key, task), NOTICE_DELAY);
    notices.set(key, task);
  }
  const endTask = (key) => { if (notices.get(key)?.kind === 'task') removeNotice(key); };
  function showError(key, text) {
    removeNotice(key);
    const n = { kind: 'error', text };
    notices.set(key, n);
    mountNotice(key, n);
  }
  function applyTask(t) {
    if (!t || typeof t.key !== 'string') return;
    if (t.state === 'running') { showTask(t.key, String(t.text || 'Working…'), t.pct); return; }
    endTask(t.key);
    if (t.state === 'error') showError(t.key + ':error', String(t.text || 'Background task failed'));
  }
  // Requests rejected while a dataset switch is in progress are superseded, not failures worth reporting.
  function reportStatsError(what, error) {
    const message = String(error?.message || error).replace(/^Error invoking remote method '[^']+': (?:Error: )?/, '');
    if (message.includes('Dataset transition in progress')) return;
    showError('stats', `Could not update ${what}: ${message}`);
  }

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function matchRanges(text, query) {
    const source = String(text ?? '');
    const needle = String(query ?? '').trim().toLocaleLowerCase();
    if (!needle) return [];
    const haystack = source.toLocaleLowerCase();
    const ranges = [];
    let start = 0;
    while ((start = haystack.indexOf(needle, start)) !== -1) {
      ranges.push({ start, end: start + needle.length });
      start += needle.length;
    }
    return ranges;
  }
  const fmtNum = (n) => Number(n || 0).toLocaleString('en-GB');
  const countFormat = new Intl.NumberFormat('en-GB', { notation: 'compact', maximumFractionDigits: 1 });
  const fmtCount = (n) => countFormat.format(Number(n || 0)).replace('K', 'k');
  const countHtml = (n) => `<span title="${fmtNum(n)}">${fmtCount(n)}</span>`;
  function setCount(selector, n, suffix = '') {
    const el = $(selector);
    el.textContent = fmtCount(n) + suffix;
    el.title = fmtNum(n) + suffix;
  }
  const parseDate = (s) => (s ? new Date(String(s).slice(0, 10) + 'T00:00:00') : null);
  const fmtDate = (s, long) => {
    const d = parseDate(s);
    return d && !isNaN(d) ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', ...(long ? { weekday: 'short' } : {}) }) : '';
  };

  /* ---------- filter state ---------- */
  const DEF = { terms: [], termMode: 'and', sel: [], loc: [], employers: [], from: '', to: '', emp: '', hours: '', sort: 'newest' };
  let F = { ...DEF };
  // Filters live only while the app is open (sessionStorage); they are not restored on the next start.
  try { F = { ...DEF, ...JSON.parse(sessionStorage.getItem('filters') || '{}') }; } catch { /* ignore */ }
  localStorage.removeItem('filters'); // stored by earlier versions
  const expanded = new Set(JSON.parse(localStorage.getItem('expanded') || '[]'));
  const saveF = () => sessionStorage.setItem('filters', JSON.stringify(F));
  const saveExp = () => localStorage.setItem('expanded', JSON.stringify([...expanded]));

  let reloadTimer;
  function setF(patch, { immediate = true } = {}) {
    F = { ...F, ...patch };
    saveF();
    syncInputs();
    renderActive();
    markFacetsPending();
    clearTimeout(reloadTimer);
    reloadTimer = setTimeout(reload, immediate ? 0 : 180);
  }

  /* ---------- collapsible widgets ---------- */
  const collapsedWidgets = new Set();
  try {
    const saved = JSON.parse(localStorage.getItem('collapsedWidgets') || '[]');
    if (Array.isArray(saved)) saved.filter((key) => typeof key === 'string').forEach((key) => collapsedWidgets.add(key));
  } catch { /* ignore */ }

  function updateWidgets() {
    const active = {
      published: Number(!!F.from) + Number(!!F.to),
      occupation: F.sel.length,
      location: F.loc.length,
      employment: Number(!!F.emp),
      hours: Number(!!F.hours),
      employers: F.employers.length,
    };
    document.querySelectorAll('[data-widget]').forEach((widget) => {
      const key = widget.dataset.widget;
      const collapsed = collapsedWidgets.has(key);
      const button = $('.widget-toggle', widget);
      button.setAttribute('aria-expanded', String(!collapsed));
      $('#' + button.getAttribute('aria-controls'), widget).hidden = collapsed;
      const badge = $('.widget-active', widget);
      const count = active[key] || 0;
      badge.hidden = !collapsed || !count;
      badge.textContent = String(count);
      badge.title = `${count} active ${count === 1 ? 'selection' : 'selections'}`;
      badge.setAttribute('aria-label', badge.title);
    });
  }

  const widgetHeights = {};
  try {
    const saved = JSON.parse(localStorage.getItem('widgetHeights') || '{}');
    if (saved && typeof saved === 'object') {
      Object.entries(saved).forEach(([key, height]) => {
        if (typeof height === 'number' && Number.isFinite(height)) widgetHeights[key] = height;
      });
    }
  } catch { /* ignore */ }

  function initWidgetResize(widget) {
    const key = widget.dataset.widget;
    const body = $('.widget-body', widget);
    const handle = document.createElement('div');
    handle.className = 'widget-resizer';
    handle.tabIndex = 0;
    handle.title = 'Drag to resize ' + $('.widget-label', widget).textContent;
    handle.setAttribute('role', 'separator');
    handle.setAttribute('aria-label', handle.title);
    handle.setAttribute('aria-orientation', 'horizontal');
    handle.setAttribute('aria-controls', body.id);
    const maxHeight = () => Math.max(80, window.innerHeight - 160);
    const resize = (height, save = false) => {
      const clamped = Math.round(Math.max(80, Math.min(maxHeight(), height)));
      body.style.height = clamped + 'px';
      body.classList.add('widget-sized');
      handle.setAttribute('aria-valuemin', '80');
      handle.setAttribute('aria-valuemax', String(maxHeight()));
      handle.setAttribute('aria-valuenow', String(clamped));
      if (save) {
        widgetHeights[key] = clamped;
        try { localStorage.setItem('widgetHeights', JSON.stringify(widgetHeights)); } catch { /* ignore */ }
      }
    };
    handle.setAttribute('aria-valuemin', '80');
    handle.setAttribute('aria-valuemax', String(maxHeight()));
    handle.setAttribute('aria-valuenow', String(Math.round(body.getBoundingClientRect().height)));
    if (Object.hasOwn(widgetHeights, key)) resize(widgetHeights[key]);
    handle.addEventListener('pointerdown', (event) => {
      if (event.button !== 0 || body.hidden) return;
      event.preventDefault();
      const startY = event.clientY;
      const startHeight = body.getBoundingClientRect().height;
      handle.setPointerCapture(event.pointerId);
      handle.classList.add('drag');
      const move = (next) => {
        if (next.pointerId === event.pointerId) resize(startHeight + next.clientY - startY);
      };
      const stop = (next) => {
        if (next.pointerId !== event.pointerId) return;
        handle.classList.remove('drag');
        resize(body.getBoundingClientRect().height, true);
        handle.removeEventListener('pointermove', move);
        handle.removeEventListener('pointerup', stop);
        handle.removeEventListener('pointercancel', stop);
        handle.removeEventListener('lostpointercapture', stop);
        if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
      };
      handle.addEventListener('pointermove', move);
      handle.addEventListener('pointerup', stop);
      handle.addEventListener('pointercancel', stop);
      handle.addEventListener('lostpointercapture', stop);
    });
    handle.addEventListener('keydown', (event) => {
      if (body.hidden || !['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const height = body.getBoundingClientRect().height;
      resize(event.key === 'Home' ? 80 : event.key === 'End' ? maxHeight() : height + (event.key === 'ArrowUp' ? -20 : 20), true);
    });
    window.addEventListener('resize', () => {
      if (Object.hasOwn(widgetHeights, key)) resize(widgetHeights[key]);
    });
    widget.append(handle);
  }

  function initWidgets() {
    document.querySelectorAll('[data-widget]').forEach((widget) => {
      initWidgetResize(widget);
      $('.widget-toggle', widget).addEventListener('click', () => {
        const key = widget.dataset.widget;
        collapsedWidgets.has(key) ? collapsedWidgets.delete(key) : collapsedWidgets.add(key);
        try { localStorage.setItem('collapsedWidgets', JSON.stringify([...collapsedWidgets])); } catch { /* ignore */ }
        updateWidgets();
      });
    });
    updateWidgets();
  }

  /* ---------- settings ---------- */
  const settings = { monospace: true };
  try {
    const saved = JSON.parse(localStorage.getItem('settings') || '{}');
    if (typeof saved?.monospace === 'boolean') settings.monospace = saved.monospace;
  } catch { /* ignore */ }

  function applySettings() {
    document.documentElement.dataset.monospace = String(settings.monospace);
    $('#setting-monospace').checked = settings.monospace;
  }
  $('#setting-monospace').addEventListener('change', (event) => {
    settings.monospace = event.target.checked;
    applySettings();
    try { localStorage.setItem('settings', JSON.stringify(settings)); } catch { /* ignore */ }
  });
  applySettings();

  /* ---------- navigation / history ---------- */
  let idx = 0;
  let curView = 'list';
  let listScroll = 0;
  let datasetContextId = null;
  let datasetHistoryBoundary = false;

  function show(view, id) {
    if (curView === 'list') listScroll = $('#list-scroll').scrollTop;
    curView = view;
    for (const v of ['list', 'ad', 'data', 'settings']) $('#view-' + v).classList.toggle('hidden', v !== view);
    document.querySelectorAll('.nav').forEach((n) => n.classList.toggle('active', n.dataset.view === (view === 'ad' ? 'list' : view)));
    if (view === 'list') $('#list-scroll').scrollTop = listScroll;
    if (view === 'ad') loadAd(id);
    if (view === 'data') renderData();
  }
  async function nav(view, id) {
    if (view === curView && view !== 'ad') return;
    if (!(await leaveDatasetEditor())) return;
    history.pushState({ view, id, i: ++idx, datasetId: datasetContextId }, '');
    show(view, id);
  }
  function back() { if (idx > 0) history.back(); else nav('list'); }
  let historyGuardPending = false;
  let ignoreRestoredPopState = false;
  window.addEventListener('popstate', async (e) => {
    if (ignoreRestoredPopState) { ignoreRestoredPopState = false; return; }
    if (historyGuardPending) return;
    historyGuardPending = true;
    if (!(await leaveDatasetEditor())) {
      ignoreRestoredPopState = true;
      history.forward();
      historyGuardPending = false;
      return;
    }
    const s = e.state || { view: 'list', i: 0 };
    if (datasetHistoryBoundary && s.datasetId !== datasetContextId) {
      ignoreRestoredPopState = true;
      history.forward();
      historyGuardPending = false;
      return;
    }
    idx = s.i || 0;
    show(s.view, s.id);
    historyGuardPending = false;
  });
  history.replaceState({ view: 'list', i: 0 }, '');

  const messageDialog = $('#message-dialog');
  $('#message-cancel').addEventListener('click', () => messageDialog.close('cancel'));
  $('#message-discard').addEventListener('click', () => messageDialog.close('discard'));
  $('#message-accept').addEventListener('click', () => messageDialog.close('accept'));
  messageDialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    messageDialog.close('cancel');
  });
  messageDialog.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') { event.preventDefault(); messageDialog.close('cancel'); }
  });
  function showMessage({ title, message, confirmLabel, discardLabel, cancelLabel = 'Cancel', danger = !!confirmLabel }) {
    if (messageDialog.open) return Promise.resolve(false);
    const returnFocus = document.activeElement;
    const cancel = $('#message-cancel');
    const discard = $('#message-discard');
    const accept = $('#message-accept');
    $('#message-title').textContent = title;
    $('#message-body').textContent = message;
    cancel.hidden = !confirmLabel;
    cancel.textContent = cancelLabel;
    discard.hidden = !discardLabel;
    discard.textContent = discardLabel || 'Discard';
    accept.textContent = confirmLabel || 'OK';
    accept.classList.toggle('danger', danger);
    messageDialog.returnValue = '';
    return new Promise((resolve) => {
      messageDialog.addEventListener('close', () => {
        if (returnFocus?.isConnected && typeof returnFocus.focus === 'function') returnFocus.focus({ preventScroll: true });
        resolve(messageDialog.returnValue === 'accept' ? true : messageDialog.returnValue === 'discard' ? 'discard' : false);
      }, { once: true });
      messageDialog.showModal();
      (discardLabel || confirmLabel ? cancel : accept).focus();
    });
  }

  const editable = (t) => t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable);
  const shortcutDialog = $('#shortcut-help');
  let shortcutReturnFocus = null;
  function openShortcutHelp() {
    if (shortcutDialog.open || $('#message-dialog')?.open) return;
    shortcutReturnFocus = document.activeElement;
    document.querySelectorAll('[data-shortcut-view]').forEach((section) => {
      section.hidden = section.dataset.shortcutView !== curView;
    });
    shortcutDialog.showModal();
    $('#shortcut-close').focus();
  }
  shortcutDialog.addEventListener('close', () => {
    const target = shortcutReturnFocus;
    shortcutReturnFocus = null;
    if (target?.isConnected && typeof target.focus === 'function') target.focus({ preventScroll: true });
  });
  shortcutDialog.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') { event.preventDefault(); shortcutDialog.close(); }
  });
  $('#shortcut-close').addEventListener('click', () => shortcutDialog.close());
  document.addEventListener('keydown', (e) => {
    if (shortcutDialog.open || $('#message-dialog')?.open) return;
    if (e.key === '?' && !editable(e.target)) { e.preventDefault(); openShortcutHelp(); }
    if (e.key === 'Backspace' && !editable(e.target)) { e.preventDefault(); back(); }
    else if (e.altKey && e.key === 'ArrowLeft') { e.preventDefault(); back(); }
    else if (e.altKey && e.key === 'ArrowRight') { e.preventDefault(); history.forward(); }
    else if (e.key === '/' && !editable(e.target)) {
      e.preventDefault();
      if (curView === 'ad') $('#ad-find').focus();
      else { nav('list'); $('#q').focus(); }
    }
  });
  document.addEventListener('mouseup', (e) => {
    if (shortcutDialog.open || $('#message-dialog')?.open) return;
    if (e.button === 3) { e.preventDefault(); back(); }
    else if (e.button === 4) { e.preventDefault(); history.forward(); }
  });

  document.querySelectorAll('.nav').forEach((n) => {
    const go = () => nav(n.dataset.view);
    n.addEventListener('click', go);
    n.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
  });
  $('#back').addEventListener('click', back);
  api.onCloseRequest(async () => {
    const allow = await leaveDatasetEditor();
    api.closeDecision(allow);
  });

  /* ---------- list ---------- */
  const PAGE = 60;
  let seq = 0, loaded = 0, loading = false, done = false, total = null, fseq = 0;
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
    if (total === null) { $('#count').textContent = 'counting…'; $('#count').removeAttribute('title'); }
    else setCount('#count', total, ' ads');
  }

  async function loadMore(first, s) {
    if (loading || done) return;
    loading = true;
    try {
      const res = await api.search(F, loaded, PAGE);
      if (s !== seq || res.stale) return;
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

  // Rows, total count and filter counts are separate requests so a slow count never delays the list.
  function reload() {
    const s = ++seq;
    loaded = 0; done = false; loading = false;
    listEl.innerHTML = '';
    $('#list-scroll').scrollTop = 0;
    total = null;
    updateCount();
    const firstPage = loadMore(true, s);
    api.count(F).then((r) => {
      if (s !== seq || !r || r.stale) return;
      total = r.total;
      updateCount();
    }).catch((error) => { if (s === seq) reportStatsError('the result count', error); });
    loadStats();
    return firstPage;
  }

  // Filter options and the chart come from summary tables; while those are built (once, in the background) a message is shown.
  let tseq = 0;
  let summaryInfo = { state: 'unknown' };
  function showBuilding(s) {
    const msg = `<div class="empty-mini">${esc((s && s.text) || 'Statistics are being prepared (one-time)…')}</div>`;
    for (const id of ['#tree-occ', '#tree-loc', '#chart', '#widget-employers']) $(id).innerHTML = msg;
  }
  function loadStats() {
    markFacetsPending();
    if (!$('#widget-employers').querySelector('[data-employer]')) $('#widget-employers').innerHTML = '<div class="empty-mini">Updating statistics…</div>';
    const fs_ = ++fseq;
    api.facets(F).then((data) => {
      if (fs_ !== fseq || !data || data.stale) return;
      if (data.building) { showBuilding(summaryInfo); return; }
      summaryInfo = { state: 'ready' };
      renderFacets(data);
    }).catch((error) => {
      if (fs_ === fseq) {
        $('#widget-employers').innerHTML = '<div class="empty-mini">Employer statistics unavailable</div>';
        reportStatsError('filter counts', error);
      }
      console.error('Failed to update filter counts:', error);
    });
    const ts = ++tseq;
    api.timeline(F).then((t) => {
      if (ts !== tseq || !t || t.stale || t.building) return;
      timelineData = t;
      renderChart();
    }).catch((error) => { if (ts === tseq) reportStatsError('the ads-over-time chart', error); });
  }
  api.onSummary((s) => {
    const wasReady = summaryInfo.state === 'ready';
    summaryInfo = s;
    if (s.state === 'ready') { if (!wasReady) loadStats(); }
    else if (s.state === 'building') showBuilding(s);
    else if (s.state === 'error') showBuilding({ text: `Statistics could not be built: ${s.text}` });
  });

  listEl.addEventListener('click', (e) => {
    const row = e.target.closest('.row');
    if (row) nav('ad', row.dataset.id);
  });
  listEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.classList.contains('row')) nav('ad', e.target.dataset.id);
  });

  /* ---------- filter panel ---------- */
  let facetData = null;
  let facetPending = true;
  const nodeIndex = new Map();

  function markFacetsPending() {
    ++fseq;
    facetPending = true;
    document.querySelectorAll('#filters .cnt, #filters .chip small, #widget-employers small').forEach((el) => {
      el.textContent = '...';
      el.title = 'Updating counts';
    });
    document.querySelectorAll('#filters .zero').forEach((el) => el.classList.remove('zero'));
    document.querySelectorAll('[data-employer]').forEach((button) => {
      const selected = F.employers.includes(button.dataset.employer);
      button.classList.toggle('on', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
  }

  const facetTitle = (n) => facetPending ? 'Updating counts' : fmtNum(n);
  const facetCount = (n) => facetPending ? '...' : fmtCount(n);

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
      const ok = r.oi || '';
      const o = g.kids.get(ok);
      if (o) o.n += r.n;
      else g.kids.set(ok, { k: 'occ', id: r.oi, label: r.o || 'Unspecified', n: r.n, kids: new Map(), path: { ...g.path, occ: { id: r.oi, label: r.o } } });
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
      const mk = r.m || '';
      const m = g.kids.get(mk);
      if (m) m.n += r.n;
      else g.kids.set(mk, { k: 'muni', id: r.m, label: r.m || 'Unspecified', n: r.n, kids: new Map(), path: { region: r.r, muni: r.m } });
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
      out += `<div class="node${isSel(n) ? ' sel' : ''}${facetPending || n.n ? '' : ' zero'}" data-key="${esc(key)}">
        <span class="tg${hasKids ? '' : ' none'}">${icon(open ? 'chev-d' : 'chev-r')}</span>
        <span class="lbl" title="${esc(n.label)}">${esc(n.label)}</span><span class="cnt" title="${facetTitle(n.n)}">${facetCount(n.n)}</span></div>`;
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

  function collapseTree(tree) {
    const prefixes = tree === 'occ' ? ['field:', 'group:', 'occ:'] : ['region:', 'muni:'];
    for (const key of expanded) {
      if (prefixes.some((prefix) => key.startsWith(prefix))) expanded.delete(key);
    }
    $('#tf-' + tree).value = '';
    saveExp();
    renderTrees();
  }
  document.querySelectorAll('[data-collapse-tree]').forEach((button) => {
    button.addEventListener('click', () => collapseTree(button.dataset.collapseTree));
  });

  function chipsHtml(items, isOn) {
    return items.map((i) => `<span class="chip${isOn(i) ? ' on' : ''}${facetPending || i.n ? '' : ' zero'}" data-v="${esc(i.v)}">${esc(i.label)} <small title="${facetTitle(i.n)}">${facetCount(i.n)}</small></span>`).join('');
  }

  function renderFacets(d) {
    facetData = d;
    facetPending = false;
    renderTrees();
    renderEmployers(d.employers);
    $('#chips-year').innerHTML = chipsHtml(
      d.year.filter((r) => r.y).map((r) => ({ v: r.y, label: r.y, n: r.n })),
      (i) => F.from === `${i.v}-01-01` && F.to === `${i.v}-12-31`
    );
    $('#chips-emp').innerHTML = chipsHtml(d.emp.filter((r) => r.v).map((r) => ({ v: r.v, label: r.v, n: r.n })), (i) => F.emp === i.v);
    $('#chips-hours').innerHTML = chipsHtml(d.hours.filter((r) => r.v).map((r) => ({ v: r.v, label: r.v, n: r.n })), (i) => F.hours === i.v);
  }

  function renderEmployers(rows) {
    const focused = document.activeElement?.closest?.('[data-employer]')?.dataset.employer;
    $('#widget-employers').innerHTML = rows.length
      ? `<div class="employer-list">${rows.map((r) => `<button type="button" class="chip employer-chip${F.employers.includes(r.v) ? ' on' : ''}" data-employer="${esc(r.v)}" aria-pressed="${F.employers.includes(r.v)}" title="${esc(r.v)}"><span class="employer-name">${esc(r.v)}</span><small title="${fmtNum(r.n)}">${fmtCount(r.n)}</small></button>`).join('')}</div>`
      : '<div class="empty-mini">No employer data</div>';
    if (focused !== undefined) {
      [...$('#widget-employers').querySelectorAll('[data-employer]')].find(button => button.dataset.employer === focused)?.focus();
    }
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
    if (!box.clientWidth) return;
    const t = timelineData;
    const W = Math.max(160, box.clientWidth);
    if (!t || !t.points.length) { box.innerHTML = '<div class="empty-mini">No data</div>'; return; }
    const pts = t.points;
    const n = pts.length;
    const max = Math.max(1, ...pts.map((p) => p.n));
    const H = 132, L = Math.max(34, fmtCount(max).length * 7 + 8), R = 10, T = 10, B = 22;
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

    box.innerHTML = `<div class="chart-sub">${countHtml(total)} ads · per ${t.unit} · ${esc(t.from)} → ${esc(t.to)}</div>
      <svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
        <defs>
          <linearGradient id="cg-line" gradientUnits="userSpaceOnUse" x1="${L}" x2="${W - R}" y1="0" y2="0"><stop offset="0" stop-color="#2dd4bf"/><stop offset=".35" stop-color="#60a5fa"/><stop offset=".7" stop-color="#a78bfa"/><stop offset="1" stop-color="#f472b6"/></linearGradient>
          <linearGradient id="cg-area" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#a78bfa" stop-opacity=".35"/><stop offset="1" stop-color="#a78bfa" stop-opacity="0"/></linearGradient>
        </defs>
        <line class="ch-grid" x1="${L}" x2="${W - R}" y1="${ys(max)}" y2="${ys(max)}"/>
        <line class="ch-grid" x1="${L}" x2="${W - R}" y1="${ys(max / 2)}" y2="${ys(max / 2)}"/>
        <line class="ch-base" x1="${L}" x2="${W - R}" y1="${H - B}" y2="${H - B}"/>
        <text class="ch-lab" x="${L - 5}" y="${ys(max) + 3.5}" text-anchor="end"><title>${fmtNum(max)}</title>${fmtCount(max)}</text>
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
  $('#widget-employers').addEventListener('click', (e) => {
    const button = e.target.closest('[data-employer]');
    if (!button) return;
    const name = button.dataset.employer;
    setF({ employers: F.employers.includes(name) ? F.employers.filter(value => value !== name) : [...F.employers, name] });
  });

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
    updateWidgets();
  }

  function renderActive() {
    const items = [];
    F.sel.forEach((s, i) => items.push([s.k, { field: 'layers', group: 'users', occ: 'tag' }[s.k], s.label, ['sel#' + i]]));
    F.loc.forEach((s, i) => items.push([s.k, 'map-pin', s.label, ['loc#' + i]]));
    if (F.from || F.to) items.push(['date', 'calendar', `${F.from || '…'} → ${F.to || '…'}`, ['from', 'to']]);
    if (F.emp) items.push(['emp', 'briefcase', F.emp, ['emp']]);
    if (F.hours) items.push(['hours', 'clock', F.hours, ['hours']]);
    F.employers.forEach((name, i) => items.push(['employer', 'building', `Employer: ${name}`, ['employers#' + i]]));
    $('#active').innerHTML = items
      .map(([k, ic, text], i) => k === 'employer'
        ? `<button type="button" class="chip fl on" data-i="${i}" aria-label="Remove ${esc(text)}">${icon(ic)}${esc(text)}<span class="x">${icon('x')}</span></button>`
        : `<span class="chip fl on" data-i="${i}">${icon(ic)}${esc(text)}<span class="x">${icon('x')}</span></span>`)
      .join('');
    $('#active').onclick = (e) => {
      const c = e.target.closest('.chip');
      if (!c) return;
      const clear = items[+c.dataset.i][3];
      const patch = {};
      const drop = { sel: new Set(), loc: new Set(), employers: new Set() };
      clear.forEach((k) => {
        const m = /^(sel|loc|employers)#(\d+)$/.exec(k);
        if (m) drop[m[1]].add(+m[2]);
        else patch[k] = '';
      });
      for (const l of ['sel', 'loc', 'employers']) if (drop[l].size) patch[l] = F[l].filter((_, i) => !drop[l].has(i));
      setF(patch);
    };
  }

  /* ---------- ad view ---------- */
  let adSeq = 0;
  let adMatches = [];
  let adMatchIndex = -1;

  function highlightAdMatches(root, query) {
    root.querySelectorAll('mark.ad-match').forEach((mark) => mark.replaceWith(...mark.childNodes));
    root.normalize();
    const needle = String(query || '').trim();
    if (!needle) return [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    const matches = [];
    for (const node of nodes) {
      const ranges = matchRanges(node.nodeValue, needle);
      if (!ranges.length) continue;
      const fragment = document.createDocumentFragment();
      let offset = 0;
      for (const range of ranges) {
        fragment.appendChild(document.createTextNode(node.nodeValue.slice(offset, range.start)));
        const mark = document.createElement('mark');
        mark.className = 'ad-match';
        mark.textContent = node.nodeValue.slice(range.start, range.end);
        fragment.appendChild(mark);
        matches.push(mark);
        offset = range.end;
      }
      fragment.appendChild(document.createTextNode(node.nodeValue.slice(offset)));
      node.parentNode.replaceChild(fragment, node);
    }
    return matches;
  }

  function showAdMatch(index) {
    adMatchIndex = adMatches.length ? (index + adMatches.length) % adMatches.length : -1;
    adMatches.forEach((mark, i) => mark.classList.toggle('current', i === adMatchIndex));
    $('#ad-find-status').textContent = adMatches.length ? `${adMatchIndex + 1}/${adMatches.length}` : '0/0';
    $('#ad-find-prev').disabled = $('#ad-find-next').disabled = !adMatches.length;
    if (adMatchIndex >= 0) adMatches[adMatchIndex].scrollIntoView({ block: 'center' });
  }

  function updateAdFind() {
    adMatches = highlightAdMatches($('#ad'), $('#ad-find').value);
    showAdMatch(0);
  }

  $('#ad-find').addEventListener('input', updateAdFind);
  $('#ad-find').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      showAdMatch(adMatchIndex + (event.shiftKey ? -1 : 1));
    } else if (event.key === 'Escape') {
      $('#ad-find').value = '';
      updateAdFind();
    }
  });
  $('#ad-find-prev').addEventListener('click', () => showAdMatch(adMatchIndex - 1));
  $('#ad-find-next').addEventListener('click', () => showAdMatch(adMatchIndex + 1));

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
    $('#ad-find').value = '';
    adMatches = [];
    showAdMatch(-1);
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
  let activeDataset = null;
  let datasetEditor = null;
  let dataRenderSeq = 0;
  let reprocessBusy = false;

  function renderDatasetEditor() {
    if (!datasetEditor) return;
    const editor = datasetEditor;
    $('.dataset-heading-copy').innerHTML = `<h1><span id="dataset-name" class="dataset-name" contenteditable="plaintext-only" role="textbox" aria-label="Dataset name" aria-required="true">${esc(editor.name)}</span></h1>
      <div id="dataset-meta" class="dataset-meta" contenteditable="plaintext-only" role="textbox" aria-label="Description" aria-multiline="true">${esc(editor.description)}</div>`;
    $('.dataset-actions').innerHTML = `<button class="btn sec" type="button" data-dataset-discard>${icon('x')}Discard</button>
      <button class="btn sec" type="button" data-dataset-save>${icon('check')}Save</button>`;
    const name = $('#dataset-name');
    name.focus();
    if (editor.selectName) {
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(name);
      selection.removeAllRanges();
      selection.addRange(range);
    }
    editor.selectName = false;
  }

  function beginDatasetEdit(selectName = false) {
    if (!activeDataset) return;
    datasetEditor = { id: activeDataset.id, name: activeDataset.name, description: activeDataset.description, originalName: activeDataset.name, originalDescription: activeDataset.description, isNew: false, selectName };
    renderDatasetEditor();
  }

  function beginDatasetCreation() {
    datasetEditor = { id: null, name: '', description: '', originalName: '', originalDescription: '', isNew: true, selectName: true };
    renderDatasetEditor();
  }

  function datasetEditorDirty() {
    return !!datasetEditor && (datasetEditor.isNew || datasetEditor.name !== datasetEditor.originalName || datasetEditor.description !== datasetEditor.originalDescription);
  }

  async function saveDatasetEditor() {
    const name = $('#dataset-name').innerText.replace(/[\r\n]+/g, ' ').trim();
    const description = $('#dataset-meta').innerText;
    const creating = datasetEditor.isNew;
    if (!name) {
      await showMessage({ title: 'Dataset name required', message: 'Enter a name before saving.' });
      $('#dataset-name').focus();
      return false;
    }
    try {
      const result = datasetEditor.isNew
        ? await api.createDataset(name, description)
        : await api.updateDataset(datasetEditor.id, name, description);
      if (!result?.ok) throw new Error(result?.error || 'Could not save dataset.');
      activeDataset = result.dataset || activeDataset;
      datasetEditor = null;
      if (creating) applyDatasetChange(activeDataset);
      else {
        await renderData();
        reload();
        loadStats();
      }
      return true;
    } catch (error) {
      await showMessage({ title: 'Could not save dataset', message: error.message || 'Could not save dataset.' });
      return false;
    }
  }

  async function leaveDatasetEditor() {
    if (!datasetEditor) return true;
    if (!datasetEditorDirty()) { datasetEditor = null; return true; }
    const choice = await showMessage({
      title: 'Unsaved dataset changes',
      message: 'Save your changes before leaving?',
      confirmLabel: 'Save',
      discardLabel: 'Discard',
      cancelLabel: 'Cancel',
      danger: false,
    });
    if (choice === 'discard') { datasetEditor = null; return true; }
    if (choice !== true) return false;
    return saveDatasetEditor();
  }

  async function renderData() {
    const sequence = ++dataRenderSeq;
    const [info, catalog] = await Promise.all([api.info(), api.datasets()]);
    if (sequence !== dataRenderSeq) return;
    activeDataset = catalog.active;
    if (!datasetHistoryBoundary) datasetContextId = activeDataset.id;
    setCount('#side-total', info.total, ' ads');
    if (datasetEditor && curView === 'data') return;
    const rows = info.sources.map((s) => `<tr><td>${icon('database').replace('<svg', '<svg style="vertical-align:-3px;margin-right:6px;color:var(--teal)"')}${esc(s.name)}</td>
      <td class="r">${countHtml(s.ads)}</td><td>${esc((s.imported_at || '').slice(0, 10))}</td>
      <td class="r"><button class="btn sec danger" data-rm="${esc(s.name)}">${icon('trash')}Remove</button></td></tr>`).join('');
    $('#data').innerHTML = `
      <div class="dataset-heading-row"><div class="dataset-heading-copy"><h1><button id="dataset-name" class="dataset-name" type="button" aria-label="Edit dataset name">${esc(activeDataset.name)}</button></h1>
        <div id="dataset-meta" class="dataset-meta">${activeDataset.description ? esc(activeDataset.description) : ''}</div></div>
        <div class="dataset-actions"><button id="dataset-edit" class="icon-btn" type="button" aria-label="Edit dataset" title="Edit dataset"><span data-i="settings"></span></button>
          <button id="dataset-swap" class="icon-btn" type="button" aria-label="Swap dataset" title="Swap dataset"><span data-i="layers"></span></button></div></div>
      <div style="color:var(--muted)">Import JSONL / JSON ad files. Several files can be selected at once; ads already present are skipped.</div>
      <div class="stats">
        <div class="stat"><b>${countHtml(info.total)}</b><small>ads stored</small></div>
        <div class="stat"><b>${countHtml(info.sources.length)}</b><small>source files</small></div>
        <div class="stat"><b>${info.min ? esc(info.min.slice(0, 4)) + ' – ' + esc(info.max.slice(0, 4)) : '–'}</b><small>years covered</small></div>
      </div>
      <div class="drop" id="drop">${icon('upload').replace('<svg', '<svg style="width:32px;height:32px;color:var(--purple)"')}
        <div style="margin-top:8px">Drop .jsonl / .ndjson / .json files here</div>
        <button class="btn sec" id="pick" style="margin-top:12px">${icon('upload')}Choose files…</button></div>
      <button class="btn sec" id="dataset-reprocess" type="button"${reprocessBusy ? ' disabled' : ''}>${icon('database')}Reprocess dataset</button>
      <div id="progress"></div>
      ${info.sources.length ? `<table><thead><tr><th>File</th><th class="r">Ads</th><th>Imported</th><th></th></tr></thead><tbody>${rows}</tbody></table>` : ''}`;
    hydrateIcons($('#data'));
    renderProgress();
  }

  function applyDatasetChange(dataset) {
    activeDataset = dataset;
    datasetContextId = dataset.id;
    F = { ...DEF, terms: [], sel: [], loc: [] };
    saveF();
    syncInputs();
    renderActive();
    listScroll = 0;
    adSeq++;
    adMatches = [];
    $('#ad').innerHTML = '';
    $('#crumbs').innerHTML = '';
    idx = 0;
    datasetHistoryBoundary = true;
    history.pushState({ view: 'data', i: 0, datasetId: datasetContextId }, '');
    show('data');
    setCount('#side-total', dataset.stats?.total ?? 0, ' ads');
    reload();
  }

  let chooserCatalog = null;
  let datasetChooserSeq = 0;
  function renderDatasetChoices(loading = false) {
    const rows = chooserCatalog.datasets.map((dataset) => {
      const description = dataset.description.split(/\r?\n/, 1)[0];
      const stats = dataset.stats;
      const summary = stats
        ? `${fmtNum(stats.sourceCount)} files · ${fmtNum(stats.total)} ads${stats.min && stats.max ? ` · ${esc(stats.min.slice(0, 4))}–${esc(stats.max.slice(0, 4))}` : ''}`
        : dataset.statsError ? 'Statistics unavailable' : 'Loading statistics…';
      const disabled = loading ? ' disabled' : '';
      return `<div class="dataset-choice-row"><button class="dataset-choice" type="button" data-dataset-select="${esc(dataset.id)}"${disabled}${dataset.id === chooserCatalog.active.id ? ' aria-current="true"' : ''}>
        <strong>${esc(dataset.name)}</strong><span class="dataset-choice-description">${esc(description)}</span><small>${summary}</small></button>
        <button class="icon-btn dataset-delete" type="button" data-dataset-delete="${esc(dataset.id)}" aria-label="Delete dataset ${esc(dataset.name)}" title="Delete dataset"${disabled}>${icon('trash')}</button></div>`;
    }).join('');
    const disabled = loading ? ' disabled' : '';
    $('#dataset-options').innerHTML = `${rows}<button class="dataset-add" type="button" data-dataset-add${disabled}><span>+ add new dataset</span></button>`;
  }

  async function openDatasetChooser() {
    if (!(await leaveDatasetEditor())) return;
    try {
      const sequence = ++datasetChooserSeq;
      chooserCatalog = await api.datasets();
      renderDatasetChoices(true);
      $('#dataset-dialog').showModal();
      $('#dataset-dialog-close').focus();
      api.datasetSummaries().then((catalog) => {
        if (sequence !== datasetChooserSeq || !$('#dataset-dialog').open) return;
        chooserCatalog = catalog;
        renderDatasetChoices();
        $('[data-dataset-select]', $('#dataset-options'))?.focus();
      }).catch((error) => {
        if (sequence !== datasetChooserSeq || !$('#dataset-dialog').open) return;
        chooserCatalog.datasets.forEach((dataset) => { if (!dataset.stats) dataset.statsError = true; });
        renderDatasetChoices();
        console.error('Could not load dataset statistics:', error);
      });
    } catch (error) {
      await showMessage({ title: 'Could not load datasets', message: error.message || 'Could not load datasets.' });
    }
  }

  async function chooseDataset(id) {
    if (id === chooserCatalog?.active.id) { $('#dataset-dialog').close(); return; }
    try {
      const result = await api.activateDataset(id);
      if (!result?.ok) throw new Error(result?.error || 'Could not activate dataset.');
      $('#dataset-dialog').close();
      applyDatasetChange(result.dataset);
    } catch (error) {
      $('#dataset-dialog').close();
      await showMessage({ title: 'Could not switch dataset', message: error.message || 'Could not switch dataset.' });
    }
  }

  async function deleteDatasetFromChooser(id) {
    const dataset = chooserCatalog?.datasets.find((entry) => entry.id === id);
    if (!dataset) return;
    const isActive = chooserCatalog.active.id === id;
    const isLast = chooserCatalog.datasets.length === 1;
    $('#dataset-dialog').close();
    const confirmed = await showMessage({
      title: 'Delete dataset permanently?',
      message: `This permanently deletes “${dataset.name}” and all ads stored in it. Original source files will not be deleted.${isLast ? ' Because this is the last dataset, an empty dataset named “default” will be created.' : isActive ? ' The oldest remaining dataset will become active.' : ''}`,
      confirmLabel: 'Delete dataset',
    });
    if (!confirmed) { openDatasetChooser(); return; }
    try {
      const result = await api.deleteDataset(id);
      if (!result?.ok) throw new Error(result?.error || 'Could not delete dataset.');
      if (isActive) applyDatasetChange(result.active);
      else openDatasetChooser();
    } catch (error) {
      await showMessage({ title: 'Could not delete dataset', message: error.message || 'Could not delete dataset.' });
      openDatasetChooser();
    }
  }

  async function reprocessDataset() {
    if (reprocessBusy || !activeDataset) return;
    const dataset = activeDataset;
    const confirmed = await showMessage({
      title: 'Reprocess dataset?',
      message: `Rebuild all statistics, search indexes and processed information for "${dataset.name}" from its stored ads? This may take a long time and require substantial temporary disk space. Imports and dataset changes will be unavailable until processing finishes. Original source files and stored ads will be preserved.`,
      confirmLabel: 'Reprocess dataset',
      danger: false,
    });
    if (!confirmed) return;
    reprocessBusy = true;
    const button = $('#dataset-reprocess');
    if (button) button.disabled = true;
    try {
      const result = await api.reprocessDataset(dataset.id);
      if (!result?.ok) throw new Error(result?.error || 'Could not reprocess dataset.');
      if (curView === 'data') await renderData();
      reload();
      loadStats();
    } catch (error) {
      await showMessage({ title: 'Dataset reprocessing failed', message: error.message || 'Could not reprocess dataset.' });
    } finally {
      reprocessBusy = false;
      const currentButton = $('#dataset-reprocess');
      if (currentButton) currentButton.disabled = false;
    }
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
      <small style="color:var(--muted)">${countHtml(s.inserted)} added · ${countHtml(s.skipped)} duplicates · ${countHtml(s.errors)} errors</small></div>`;
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
      api.info().then((i) => setCount('#side-total', i.total, ' ads'));
      if (curView === 'data') { const keep = importState; renderData().then(() => { importState = keep; renderProgress(); }); }
      reload();
    } else renderProgress();
  });

  const dataEl = $('#data');
  $('#dataset-dialog').addEventListener('cancel', (event) => {
    event.preventDefault();
    $('#dataset-dialog').close();
  });
  $('#dataset-dialog').addEventListener('keydown', (event) => {
    if (event.key === 'Escape') { event.preventDefault(); $('#dataset-dialog').close(); }
  });
  $('#dataset-dialog-close').addEventListener('click', () => $('#dataset-dialog').close());
  $('#dataset-options').addEventListener('click', (event) => {
    const remove = event.target.closest('[data-dataset-delete]');
    if (remove) return deleteDatasetFromChooser(remove.dataset.datasetDelete);
    const select = event.target.closest('[data-dataset-select]');
    if (select) return chooseDataset(select.dataset.datasetSelect);
    if (event.target.closest('[data-dataset-add]')) {
      $('#dataset-dialog').close();
      beginDatasetCreation();
    }
  });
  dataEl.addEventListener('input', (event) => {
    if (!datasetEditor) return;
    if (event.target.id === 'dataset-name') datasetEditor.name = event.target.innerText;
    if (event.target.id === 'dataset-meta') datasetEditor.description = event.target.innerText;
  });
  dataEl.addEventListener('keydown', (event) => {
    if (!datasetEditor || event.target.id !== 'dataset-name' || event.key !== 'Enter' || event.isComposing) return;
    event.preventDefault();
    $('#dataset-meta').focus();
  });
  dataEl.addEventListener('click', async (e) => {
    if (e.target.closest('#dataset-reprocess')) return reprocessDataset();
    if (e.target.closest('#dataset-swap')) return openDatasetChooser();
    if (e.target.closest('#dataset-edit')) return beginDatasetEdit();
    if (e.target.closest('#dataset-name') && !datasetEditor) return beginDatasetEdit(true);
    if (e.target.closest('[data-dataset-save]')) return saveDatasetEditor();
    if (e.target.closest('[data-dataset-discard]')) {
      datasetEditor = null;
      return renderData();
    }
    if (e.target.closest('#pick')) return startImport(api.importDialog());
    const rm = e.target.closest('[data-rm]');
    if (rm && await showMessage({
      title: 'Remove data source?',
      message: `Remove all ads imported from ${rm.dataset.rm}?\n\nThe original source file will not be deleted.`,
      confirmLabel: 'Remove',
    })) {
      try {
        const r = await api.removeSource(rm.dataset.rm);
        if (r && r.ok === false) throw new Error(r.error || 'Could not remove data source.');
      } catch (error) {
        await showMessage({ title: 'Removal failed', message: error.message || 'Could not remove data source.' });
        return;
      }
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

  /* ---------- layout: column collapse ---------- */
  const columns = { filters: false, statistics: false };
  for (const name of Object.keys(columns)) {
    try { columns[name] = localStorage.getItem(name + 'Collapsed') === '1'; } catch { /* ignore */ }
  }
  let narrowStatisticsOpen = false;
  let columnPriority = 'filters';
  function applyColumns() {
    let filtersCollapsed = columns.filters;
    let statisticsCollapsed = columns.statistics || (window.innerWidth < 1200 && !narrowStatisticsOpen);
    const menuWidth = document.body.classList.contains('menu-collapsed') ? 68 : 210;
    const filterWidth = $('#filters').getBoundingClientRect().width || parseFloat(document.documentElement.style.getPropertyValue('--filter-w')) || 310;
    const statisticsWidth = parseFloat(document.documentElement.style.getPropertyValue('--statistics-w')) || 280;
    if (!filtersCollapsed && !statisticsCollapsed && window.innerWidth - menuWidth - filterWidth - statisticsWidth - 10 < 420) {
      if (columnPriority === 'statistics') filtersCollapsed = true;
      else statisticsCollapsed = true;
    }
    for (const [name, collapsed] of [['filters', filtersCollapsed], ['statistics', statisticsCollapsed]]) {
      $('#view-list').classList.toggle(name + '-collapsed', collapsed);
      const button = $('#' + name + '-toggle');
      button.title = `${collapsed ? 'Show' : 'Hide'} ${name}`;
      button.setAttribute('aria-label', button.title);
      button.setAttribute('aria-expanded', String(!collapsed));
    }
  }
  for (const name of Object.keys(columns)) {
    $('#' + name + '-toggle').addEventListener('click', () => {
      const collapsed = !$('#view-list').classList.contains(name + '-collapsed');
      columns[name] = collapsed;
      if (name === 'statistics') narrowStatisticsOpen = !collapsed;
      if (!collapsed) columnPriority = name;
      try { localStorage.setItem(name + 'Collapsed', collapsed ? '1' : ''); } catch { /* ignore */ }
      applyColumns();
    });
  }
  window.addEventListener('resize', () => {
    if (window.innerWidth >= 1200) narrowStatisticsOpen = false;
    applyColumns();
  });

  /* ---------- layout: menu collapse, filter resize ---------- */
  const FILTER_MIN = 310;
  const clampFilterW = (w) => Math.max(FILTER_MIN, Math.min(720, window.innerWidth * 0.6,
    window.innerWidth - (document.body.classList.contains('menu-collapsed') ? 68 : 210) - 425, w));
  let filterW = +localStorage.getItem('filterW') || FILTER_MIN;
  const applyFilterW = () => {
    document.documentElement.style.setProperty('--filter-w', clampFilterW(filterW) + 'px');
    applyColumns();
  };
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

  const STATISTICS_MIN = 280;
  let statisticsW = STATISTICS_MIN;
  try {
    const saved = Number(localStorage.getItem('statisticsW'));
    if (Number.isFinite(saved) && saved >= STATISTICS_MIN) statisticsW = saved;
  } catch { /* ignore */ }
  const statisticsResizer = $('#statistics-resizer');
  const statisticsMaxW = () => Math.max(STATISTICS_MIN, Math.min(720, window.innerWidth * 0.6,
    window.innerWidth - (document.body.classList.contains('menu-collapsed') ? 68 : 210) - 425));
  const clampStatisticsW = (width) => Math.round(Math.max(STATISTICS_MIN, Math.min(statisticsMaxW(), width)));
  const applyStatisticsW = () => {
    const width = clampStatisticsW(statisticsW);
    document.documentElement.style.setProperty('--statistics-w', width + 'px');
    statisticsResizer.setAttribute('aria-valuemin', String(STATISTICS_MIN));
    statisticsResizer.setAttribute('aria-valuemax', String(Math.floor(statisticsMaxW())));
    statisticsResizer.setAttribute('aria-valuenow', String(width));
    applyColumns();
  };
  const saveStatisticsW = () => {
    try { localStorage.setItem('statisticsW', String(statisticsW)); } catch { /* ignore */ }
  };
  statisticsResizer.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || $('#view-list').classList.contains('statistics-collapsed')) return;
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = $('#statistics').getBoundingClientRect().width;
    statisticsResizer.setPointerCapture(event.pointerId);
    statisticsResizer.classList.add('drag');
    const move = (next) => {
      if (next.pointerId !== event.pointerId) return;
      statisticsW = clampStatisticsW(startWidth + startX - next.clientX);
      columnPriority = 'statistics';
      applyStatisticsW();
    };
    const stop = (next) => {
      if (next.pointerId !== event.pointerId) return;
      statisticsResizer.classList.remove('drag');
      statisticsResizer.removeEventListener('pointermove', move);
      statisticsResizer.removeEventListener('pointerup', stop);
      statisticsResizer.removeEventListener('pointercancel', stop);
      statisticsResizer.removeEventListener('lostpointercapture', stop);
      if (statisticsResizer.hasPointerCapture(event.pointerId)) statisticsResizer.releasePointerCapture(event.pointerId);
      saveStatisticsW();
    };
    statisticsResizer.addEventListener('pointermove', move);
    statisticsResizer.addEventListener('pointerup', stop);
    statisticsResizer.addEventListener('pointercancel', stop);
    statisticsResizer.addEventListener('lostpointercapture', stop);
  });
  statisticsResizer.addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const width = clampStatisticsW(statisticsW);
    statisticsW = clampStatisticsW(event.key === 'Home' ? STATISTICS_MIN : event.key === 'End' ? statisticsMaxW()
      : width + (event.key === 'ArrowLeft' ? 20 : -20));
    columnPriority = 'statistics';
    applyStatisticsW();
    saveStatisticsW();
  });
  applyStatisticsW();
  window.addEventListener('resize', applyStatisticsW);

  const setMenuCollapsed = (c) => {
    document.body.classList.toggle('menu-collapsed', c);
    $('#menu-toggle').title = c ? 'Expand menu' : 'Collapse menu';
    $('#menu-toggle').setAttribute('aria-label', $('#menu-toggle').title);
    $('#menu-toggle').setAttribute('aria-expanded', String(!c));
    $('#menu-toggle').setAttribute('aria-controls', 'sidebar');
    localStorage.setItem('menuCollapsed', c ? '1' : '0');
    applyFilterW();
    applyStatisticsW();
  };
  $('#menu-toggle').addEventListener('click', () => setMenuCollapsed(!document.body.classList.contains('menu-collapsed')));
  setMenuCollapsed(localStorage.getItem('menuCollapsed') !== '0');

  /* ---------- init ---------- */
  hydrateIcons();
  api.onTask(applyTask);
  api.tasks().then((list) => list.forEach(applyTask)).catch((error) => console.error('Could not load background tasks:', error));
  initWidgets();
  syncInputs();
  renderActive();
  Promise.allSettled([
    api.info().then((i) => {
      setCount('#side-total', i.total, ' ads');
      if (!i.total) nav('data');
    }),
    reload(),
  ]).then(() => api.appReady());
})();
