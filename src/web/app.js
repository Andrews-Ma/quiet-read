'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const engine = window.QuietPromptEngine;
  const i18n = window.QuietReadI18n;
  const t = (key, values) => i18n.t(key, values);
  const builtins = JSON.parse($('builtins').textContent);
  const builtinById = new Map(builtins.map(book => [book.id, book]));
  const viewport = $('viewport');
  const native = Boolean(window.webkit?.messageHandlers?.native);
  const OLD = 'quietprompt-v2';
  const themes = new Set(Array.from($('theme').options, option => option.value));
  const readingFonts = {
    system: 'system-ui, -apple-system, "PingFang SC", sans-serif',
    sans: 'Arial, "PingFang SC", "Microsoft YaHei", sans-serif',
    serif: 'Georgia, "Songti SC", SimSun, serif',
    song: '"Songti SC", SimSun, "Noto Serif CJK SC", "Times New Roman", serif',
    kai: '"Kaiti SC", STKaiti, KaiTi, "Noto Serif CJK SC", serif',
    rounded: '"Arial Rounded MT Bold", "Yuanti SC", STYuanti, "Microsoft YaHei", sans-serif',
    mono: 'Menlo, Consolas, "PingFang SC", "Microsoft YaHei", monospace'
  };
  const layoutOptions = {
    alignment: {left: 'left', center: 'center', right: 'right'},
    lineSpacing: {compact: '1.45', normal: '1.85', relaxed: '2.2'},
    columnWidth: {narrow: '680px', normal: '940px', wide: '1200px'}
  };
  const layoutVariables = {alignment: '--reading-align', lineSpacing: '--reading-line-height', columnWidth: '--reading-width'};
  const defaultPrefs = {speed: 180, speedMin: 150, speedMax: 200, font: 44, fontFamily: 'system', alignment: 'left', lineSpacing: 'normal', columnWidth: 'normal', countdown: true, focus: false, language: 'en', theme: 'breeze'};
  let state = {version: 3, currentId: '', prefs: {...defaultPrefs}, positions: {}, recent: []};
  let book = null, rows = [], nodes = [], prefix = [], tops = [], heights = [];
  let total = 0, cursor = 0, index = -1, playing = false, counting = false;
  let countTimer = null, lastTime = 0, lastSave = 0, layoutPending = false, ignoreScrollUntil = 0;
  let ready = false, storageFailed = false, writeInFlight = false, pendingState = null;
  let selectionRequired = false;
  let noticeKey = 'paused', saveStatus = 'waiting', bannerSpec = null, rangeSpec = null;
  function validState(s) {
    return s && s.version === 3 && typeof s.currentId === 'string' &&
      s.prefs && typeof s.prefs === 'object' && s.positions && typeof s.positions === 'object' &&
      Array.isArray(s.recent) && s.recent.length <= 100;
  }
  const {adapter, readJSON} = window.QuietReadStorage.create({native, validBook, validState, t});

  function validBook(b) {
    return b && typeof b.id === 'string' && /^\d{1,8}-[0-9a-f]{1,8}$/.test(b.id) &&
      typeof b.title === 'string' && b.title.length > 0 && b.title.length <= 512 &&
      Array.isArray(b.rows) && b.rows.length > 0 && b.rows.length <= 100000 &&
      b.rows.every(r => r && typeof r.text === 'string' && r.text.length > 0 &&
        typeof r.section === 'string' && r.section.length <= 512) &&
      engine.idFor(b.rows) === b.id;
  }
  function normalizePrefs(p) {
    let speedMin = +p?.speedMin, speedMax = +p?.speedMax, speeds;
    try { speeds = engine.speedOptions(speedMin, speedMax); }
    catch (_) { speedMin = 150; speedMax = 200; speeds = engine.speedOptions(speedMin, speedMax); }
    const previousSpeed = Number.isFinite(+p?.speed) && +p.speed > 0 ? +p.speed : 180;
    return {speed: engine.nearestSpeed(speeds, previousSpeed), speedMin, speedMax,
      font: Math.max(28, Math.min(72, +p?.font || 44)),
      fontFamily: Object.hasOwn(readingFonts, p?.fontFamily) ? p.fontFamily : defaultPrefs.fontFamily,
      ...Object.fromEntries(Object.entries(layoutOptions).map(([key, options]) => [key, Object.hasOwn(options, p?.[key]) ? p[key] : defaultPrefs[key]])),
      countdown: typeof p?.countdown === 'boolean' ? p.countdown : true,
      focus: typeof p?.focus === 'boolean' ? p.focus : false,
      language: p?.language === 'zh' ? 'zh' : 'en',
      theme: themes.has(p?.theme) ? p.theme : defaultPrefs.theme};
  }
  function banner(key, values = {}) {
    bannerSpec = {key, values}; $('bannerText').textContent = t(key, values); $('banner').hidden = false;
  }
  function errorText(error) {
    return typeof error?.code === 'string' && Object.hasOwn(i18n.messages.en, error.code) ?
      t(error.code) : (error?.message || t('saveError'));
  }
  function setNotice(key) { noticeKey = key; $('notice').textContent = t(key); }
  function saveIndicator(status) {
    saveStatus = status;
    $('save').textContent = t(status === 'saved' ? 'saved' : status === 'saving' ? 'saving' : status === 'waiting' ? 'waiting' : 'saveFailed');
    $('save').classList.toggle('error', status === 'error');
    $('save').title = t(status === 'error' ? 'retryHint' : 'saveHint');
  }
  function storageError(error) {
    storageFailed = true; saveIndicator('error');
    banner('storageFailure', {error: errorText(error)});
    $('storage').textContent = t('storageRisk');
  }
  function rememberPosition() {
    if (!book) return;
    state.currentId = book.id;
    state.positions[book.id] = {cursor, index: Math.max(0, index), updatedAt: Date.now()};
  }
  function queueSave() {
    if (!ready || !book || selectionRequired) return;
    rememberPosition();
    pendingState = JSON.parse(JSON.stringify(state));
    if (storageFailed) { saveIndicator('error'); return; }
    saveIndicator('saving');
    void flushSaves();
  }
  async function flushSaves() {
    if (writeInFlight || storageFailed || !pendingState) return;
    writeInFlight = true;
    while (pendingState && !storageFailed) {
      const snapshot = pendingState; pendingState = null;
      try { await adapter.saveState(snapshot); }
      catch (error) { pendingState = snapshot; storageError(error); }
    }
    writeInFlight = false;
    if (!storageFailed) saveIndicator('saved');
  }
  $('save').onclick = async () => {
    if (!storageFailed && !selectionRequired) return;
    if (selectionRequired) { banner('chooseScript'); return; }
    try {
      await adapter.saveBook(book);
      storageFailed = false; $('storage').textContent = t('storageOK');
      $('banner').hidden = true;
      queueSave();
    } catch (error) { storageError(error); }
  };

  function speedUI() {
    const speeds = engine.speedOptions(state.prefs.speedMin, state.prefs.speedMax);
    document.querySelectorAll('[data-speed]').forEach((button, i) => {
      button.dataset.speed = String(speeds[i]); button.textContent = String(speeds[i]);
      button.setAttribute('aria-label', t('speedLabel', {speed: button.dataset.speed}));
      button.setAttribute('aria-pressed', String(+button.dataset.speed === state.prefs.speed));
    });
  }
  function sectionName(value) { return value === 'Body' || value === '正文' ? t('body') : value; }
  function bookInfo() {
    if (!book) return;
    const format = !book.format || book.format === '文本' ? t('textFormat') :
      book.format === '内置Markdown' ? 'Markdown' : book.format === '旧版导入' ? t('legacyFormat') : book.format;
    $('bookInfo').textContent = t('documentInfo', {title: book.title, format, count: rows.length});
    $('bookWarnings').textContent = (book.warnings || []).map(w => typeof w === 'string' ? w : t(w.key, w.values)).join(' ');
    Array.from($('scene').options).forEach(option => { option.textContent = sectionName(rows[Number(option.value)].section); });
  }
  function renderRangeMessage() {
    if (!rangeSpec) { $('speedRangeMessage').textContent = t('rangeHelp'); return; }
    if (rangeSpec.error) { $('speedRangeMessage').textContent = t(rangeSpec.error); return; }
    const values = rangeSpec.options.join(state.prefs.language === 'zh' ? '、' : ', ');
    $('speedRangeMessage').textContent = t('rangeApplied', {values}) +
      (rangeSpec.adjusted ? t('rangeSelected', {speed: rangeSpec.selected}) : '');
  }
  function applyLanguage() {
    i18n.setLanguage(state.prefs.language); i18n.apply(document);
    $('language').value = state.prefs.language;
    $('play').textContent = t(playing ? 'pause' : counting ? 'cancel' : cursor <= 0 ? 'start' : 'resume');
    setNotice(noticeKey); saveIndicator(saveStatus); speedUI(); bookInfo(); renderRangeMessage();
    $('storage').textContent = t(storageFailed ? 'storageRisk' : 'storageOK');
    if (bannerSpec && !$('banner').hidden) $('bannerText').textContent = t(bannerSpec.key, bannerSpec.values);
    if (native) window.webkit.messageHandlers.native.postMessage({op: 'setLanguage', language: state.prefs.language});
  }
  function applyTheme() {
    const root = document.documentElement;
    root.dataset.theme = state.prefs.theme;
    const style = getComputedStyle(root);
    const message = {op: 'setTheme', color: style.getPropertyValue('--ui-bar').trim(), dark: style.colorScheme === 'dark'};
    if (native) window.webkit.messageHandlers.native.postMessage(message);
    else window.chrome?.webview?.postMessage(message);
  }
  function preferencesUI() {
    state.prefs = normalizePrefs(state.prefs);
    $('theme').value = state.prefs.theme; applyTheme();
    $('fontFamily').value = state.prefs.fontFamily;
    document.documentElement.style.setProperty('--reading-font', readingFonts[state.prefs.fontFamily]);
    for (const [key, options] of Object.entries(layoutOptions)) {
      $(key).value = state.prefs[key];
      document.documentElement.style.setProperty(layoutVariables[key], options[state.prefs[key]]);
    }
    $('font').value = state.prefs.font; $('fontValue').textContent = state.prefs.font;
    document.documentElement.style.setProperty('--size', state.prefs.font + 'px');
    $('countdown').checked = state.prefs.countdown; $('focus').checked = state.prefs.focus;
    $('speedMin').value = state.prefs.speedMin; $('speedMax').value = state.prefs.speedMax;
    applyLanguage();
  }
  function find(chars) {
    let lo = 0, hi = rows.length - 1;
    while (lo < hi) { const mid = Math.ceil((lo + hi) / 2); if (prefix[mid] <= chars) lo = mid; else hi = mid - 1; }
    return lo;
  }
  function paint(force = false) {
    if (!rows.length || !total) return;
    const next = find(Math.min(cursor, Math.max(0, total - .0001)));
    if (next !== index || force) {
      if (nodes[index]) nodes[index].classList.remove('active');
      index = next; nodes[index].classList.add('active');
      $('position').textContent = (index + 1) + ' / ' + rows.length;
      $('scene').value = rows[index].sectionStart;
    }
    if (document.activeElement !== $('seek')) $('seek').value = Math.round(cursor / total * 10000);
  }
  function position() {
    if (tops.length !== rows.length || !rows.length) return;
    const i = find(Math.min(cursor, Math.max(0, total - .0001)));
    const fraction = Math.max(0, Math.min(1, (cursor - prefix[i]) / rows[i].text.length));
    ignoreScrollUntil = performance.now() + 120;
    viewport.scrollTop = tops[i] + heights[i] * fraction - viewport.clientHeight * .32;
    paint();
  }
  function measure() {
    if (!nodes.length) return;
    const box = viewport.getBoundingClientRect();
    tops = nodes.map(n => n.getBoundingClientRect().top - box.top + viewport.scrollTop);
    heights = nodes.map((n, i) => Math.max(1, i + 1 < nodes.length ? tops[i + 1] - tops[i] : n.getBoundingClientRect().height));
    position();
  }
  function scheduleMeasure() {
    if (layoutPending) return;
    layoutPending = true; requestAnimationFrame(() => { layoutPending = false; measure(); });
  }
  function syncCursor() {
    if (!rows.length || tops.length !== rows.length) return;
    const y = viewport.scrollTop + viewport.clientHeight * .32;
    let lo = 0, hi = tops.length - 1;
    while (lo < hi) { const mid = Math.ceil((lo + hi) / 2); if (tops[mid] <= y) lo = mid; else hi = mid - 1; }
    cursor = Math.max(0, Math.min(total, prefix[lo] + Math.max(0, Math.min(1, (y - tops[lo]) / heights[lo])) * rows[lo].text.length));
    paint(); queueSave();
  }
  function stop(message = 'paused') {
    playing = false; counting = false; clearInterval(countTimer); $('count').hidden = true;
    $('play').textContent = t(cursor <= 0 ? 'start' : 'resume');
    document.querySelector('header').hidden = false; setNotice(message);
    queueSave();
  }
  window.pauseForDialog = () => stop();
  function run() {
    playing = true; counting = false; $('count').hidden = true; $('play').textContent = t('pause');
    setNotice('scrolling'); lastTime = performance.now();
    if (state.prefs.focus) document.querySelector('header').hidden = true;
    scheduleMeasure();
  }
  function panel(open) {
    $('panel').hidden = $('panelBackdrop').hidden = !open;
    $('settings').setAttribute('aria-expanded', String(open));
    if (open) $('panel').scrollTop = 0;
  }
  function applySpeedRange() {
    const minText = $('speedMin').value.trim(), maxText = $('speedMax').value.trim();
    try {
      if (!minText || !maxText) { rangeSpec = {error: 'speedRequired'}; renderRangeMessage(); return false; }
      const minimum = Number(minText), maximum = Number(maxText);
      const options = engine.speedOptions(minimum, maximum);
      const oldSpeed = state.prefs.speed, selected = engine.nearestSpeed(options, oldSpeed);
      state.prefs.speedMin = minimum; state.prefs.speedMax = maximum; state.prefs.speed = selected;
      speedUI(); queueSave();
      rangeSpec = {options, selected, adjusted: selected !== oldSpeed}; renderRangeMessage();
      return true;
    } catch (error) { rangeSpec = {error: error.code || 'speedInvalid'}; renderRangeMessage(); return false; }
  }
  function closePanel() {
    if ($('panel').hidden) return true;
    const changed = $('speedMin').value.trim() !== String(state.prefs.speedMin) ||
      $('speedMax').value.trim() !== String(state.prefs.speedMax);
    if (changed && !applySpeedRange()) { $('speedMin').focus(); return false; }
    if (rangeSpec?.error) { rangeSpec = null; renderRangeMessage(); }
    const restoreFocus = $('panel').contains(document.activeElement);
    panel(false);
    if (restoreFocus) $('settings').focus();
    return true;
  }
  function toggle() {
    if (!ready) return;
    if (!$('panel').hidden) { closePanel(); return; }
    if (playing || counting) { stop(); return; }
    if (cursor >= total) { cursor = 0; position(); }
    if (!state.prefs.countdown) { run(); return; }
    counting = true; let n = 3; $('count').hidden = false; $('count').textContent = n; $('play').textContent = t('cancel');
    countTimer = setInterval(() => { if (--n > 0) $('count').textContent = n; else { clearInterval(countTimer); run(); } }, 1000);
  }
  function go(i) {
    if (!rows.length) return;
    stop(); cursor = prefix[Math.max(0, Math.min(rows.length - 1, i))]; position(); queueSave();
  }
  function frame(time) {
    try {
      if (playing && rows.length) {
        cursor = engine.advance(cursor, state.prefs.speed, (time - lastTime) / 1000, total);
        position();
        if (time - lastSave >= 2000) { queueSave(); lastSave = time; }
        if (cursor >= total) stop('end');
      }
    } finally { lastTime = time; requestAnimationFrame(frame); }
  }
  function setRecent(activeBook) {
    state.recent = [{id: activeBook.id, title: activeBook.title, format: activeBook.format || 'Text'},
      ...state.recent.filter(item => item.id !== activeBook.id)].slice(0, 20);
  }
  function refreshBooks() {
    const all = [...state.recent];
    for (const item of builtins) if (!all.some(b => b.id === item.id)) all.push({id: item.id, title: item.title, format: item.format});
    $('books').replaceChildren();
    for (const item of all) {
      const option = document.createElement('option'); option.value = item.id; option.textContent = item.title;
      $('books').appendChild(option);
    }
    if (book) $('books').value = book.id;
  }
  function activate(next, positionValue = 0) {
    if (!validBook(next)) throw new Error(t('invalidBook'));
    book = next; rows = next.rows.map(row => ({text: row.text, section: row.section}));
    ({prefix, total} = engine.buildTimeline(rows));
    cursor = Math.max(0, Math.min(total, Number(positionValue) || 0)); index = -1; tops = []; heights = [];
    $('text').replaceChildren(); $('scene').replaceChildren();
    let sectionStart = 0;
    nodes = rows.map((row, i) => {
      if (i === 0 || row.section !== rows[i - 1].section) sectionStart = i;
      row.sectionStart = sectionStart;
      const p = document.createElement('p'); p.className = 'cue'; p.textContent = row.text;
      p.addEventListener('click', () => go(i)); $('text').appendChild(p);
      if (sectionStart === i) { const o = document.createElement('option'); o.value = i; o.textContent = sectionName(row.section); $('scene').appendChild(o); }
      return p;
    });
    $('title').textContent = next.title; $('title').title = next.title;
    document.title = next.title + ' · QuietRead';
    bookInfo();
    refreshBooks(); paint(true); scheduleMeasure();
    $('play').textContent = t(cursor ? 'resume' : 'start');
    setNotice('paused');
  }
  function normalizedBook(title, parsed) {
    const b = {title: String(title).slice(0, 512), rows: parsed.rows,
      format: parsed.kind || 'Text', warnings: parsed.warnings || []};
    b.id = engine.idFor(b.rows);
    if (!validBook(b)) throw new Error(t('invalidBook'));
    return b;
  }
  async function switchBook(next, fromImport = false) {
    if (!validBook(next)) throw new Error(t('invalidBook'));
    stop();
    // Store the complete new document before pointing the state at it.
    try { await adapter.saveBook(next); }
    catch (error) { storageError(error); throw error; }
    const sameNameChanged = fromImport && state.recent.some(item => item.title === next.title && item.id !== next.id);
    const oldPosition = state.positions[next.id];
    activate(next, oldPosition?.cursor || 0);
    state.currentId = next.id; setRecent(next); refreshBooks(); selectionRequired = false; storageFailed = false;
    $('storage').textContent = t('storageOK');
    closePanel(); queueSave();
    if (!storageFailed) { $('banner').hidden = true; bannerSpec = null; }
    if (sameNameChanged && !oldPosition) {
      if (next.format === 'Markdown') $('bookWarnings').textContent = [t('changedVersion'), $('bookWarnings').textContent].filter(Boolean).join(' ');
      else banner('changedVersion');
    }
  }
  async function selectBook(id) {
    try {
      const next = builtinById.get(id) || await adapter.loadBook(id);
      await switchBook(next);
    } catch (error) { refreshBooks(); banner('openFailure', {error: errorText(error)}); }
  }
  async function importText(text, title) {
    try {
      const parsed = engine.parseDocument(text, title);
      await switchBook(normalizedBook(title, parsed), true);
      return true;
    } catch (error) {
      banner('importFailure', {error: errorText(error)});
      if (/存储|保存|quota|space|disk|read.only|permission/i.test(error.message || '')) storageError(error);
      return false;
    }
  }
  window.importNovel = (text, name) => { void importText(text, name); return true; };

  function legacySnapshot() {
    let prefs = null, current = null;
    try { prefs = readJSON(OLD + ':prefs'); current = readJSON(OLD + ':current'); } catch (_) { return null; }
    if (!prefs && !current) return null;
    const data = current?.rows;
    if (!data?.length || !data.every(r => typeof r.text === 'string' && typeof r.section === 'string')) return null;
    const matched = builtins.find(b => engine.legacyIdFor(b.rows) === engine.legacyIdFor(data));
    const oldPosition = (() => { try { return readJSON(OLD + ':position:' + engine.legacyIdFor(data)); } catch (_) { return null; } })();
    const restored = matched || normalizedBook(current?.title || t('legacyTitle'), {rows: data, warnings: [], kind: t('legacyFormat')});
    return {book: restored, prefs: normalizePrefs(prefs), cursor: Number.isFinite(oldPosition?.cursor) ? oldPosition.cursor : 0};
  }
  async function initialize() {
    let restored = null, hint = '', firstStart = false, stateWasRead = false, noSavedState = false;
    try {
      const response = await adapter.loadState();
      stateWasRead = true; noSavedState = !response.state;
      if (response.state) {
        if (!validState(response.state)) throw new Error(t('invalidState'));
        state = response.state; state.prefs = normalizePrefs(state.prefs);
        i18n.setLanguage(state.prefs.language);
        restored = builtinById.get(state.currentId) || await adapter.loadBook(state.currentId);
        if (!validBook(restored)) throw new Error(t('invalidBook'));
        if (response.recovered) hint = 'backupRecovered';
      } else {
        firstStart = true;
        const legacy = legacySnapshot();
        restored = legacy?.book || builtins[0];
        if (!validBook(restored)) throw new Error(t('missingSample'));
        state = {version: 3, currentId: restored.id, prefs: legacy?.prefs || {...defaultPrefs}, positions: {}, recent: []};
        if (legacy) {
          state.positions[restored.id] = {cursor: legacy.cursor, index: 0, updatedAt: Date.now()};
          hint = 'legacyRestored';
        }
        await adapter.saveBook(restored);
        setRecent(restored);
      }
      preferencesUI(); activate(restored, state.positions[restored.id]?.cursor || 0);
      ready = true; $('play').disabled = false;
      if (firstStart) queueSave(); else saveIndicator('saved');
      if (hint) banner(hint);
    } catch (error) {
      // Never overwrite unreadable prior state during fallback.
      const legacy = legacySnapshot();
      restored = legacy?.book || builtins[0];
      if (validBook(restored)) {
        state = {version: 3, currentId: restored.id, prefs: legacy?.prefs || {...defaultPrefs}, positions: {}, recent: []};
        preferencesUI(); activate(restored, legacy?.cursor || 0);
        ready = true; $('play').disabled = false; selectionRequired = !stateWasRead || !noSavedState;
      }
      storageError(error);
      banner('recoveryFailure', {error: errorText(error)});
    }
    requestAnimationFrame(frame);
  }

  $('play').onclick = toggle; $('prev').onclick = () => go(index - 1); $('next').onclick = () => go(index + 1);
  $('settings').onclick = () => { if ($('panel').hidden) panel(true); else closePanel(); };
  $('close').onclick = closePanel; $('panelBackdrop').onclick = closePanel;
  $('dismiss').onclick = () => { $('banner').hidden = true; };
  $('theme').onchange = event => {
    state.prefs.theme = themes.has(event.target.value) ? event.target.value : defaultPrefs.theme;
    applyTheme(); queueSave();
  };
  $('fontFamily').onchange = event => {
    state.prefs.fontFamily = Object.hasOwn(readingFonts, event.target.value) ? event.target.value : defaultPrefs.fontFamily;
    document.documentElement.style.setProperty('--reading-font', readingFonts[state.prefs.fontFamily]);
    scheduleMeasure(); document.fonts.ready.then(scheduleMeasure); queueSave();
  };
  for (const [key, options] of Object.entries(layoutOptions)) {
    $(key).onchange = event => {
      state.prefs[key] = Object.hasOwn(options, event.target.value) ? event.target.value : defaultPrefs[key];
      document.documentElement.style.setProperty(layoutVariables[key], options[state.prefs[key]]);
      scheduleMeasure(); queueSave();
    };
  }
  $('language').onchange = event => { state.prefs.language = event.target.value === 'zh' ? 'zh' : 'en'; applyLanguage(); queueSave(); };
  $('books').onchange = event => { const id = event.target.value; void selectBook(id); };
  $('scene').onchange = event => go(+event.target.value);
  $('seek').oninput = event => { const target = +event.target.value; stop(); cursor = total * target / 10000; position(); queueSave(); };
  document.querySelectorAll('[data-speed]').forEach(button => {
    button.onclick = () => { state.prefs.speed = +button.dataset.speed; speedUI(); queueSave(); };
  });
  $('applySpeedRange').onclick = applySpeedRange;
  $('font').oninput = event => {
    state.prefs.font = +event.target.value; $('fontValue').textContent = state.prefs.font;
    document.documentElement.style.setProperty('--size', state.prefs.font + 'px'); scheduleMeasure(); queueSave();
  };
  ['countdown', 'focus'].forEach(key => { $(key).onchange = event => { state.prefs[key] = event.target.checked; queueSave(); }; });
  $('open').onclick = () => { stop(); if (native) window.webkit.messageHandlers.native.postMessage('open'); else $('file').click(); };
  $('file').onchange = async event => {
    const file = event.target.files[0]; if (!file) return;
    if (file.size > 6000000) { banner('fileTooLarge'); event.target.value = ''; return; }
    try { await importText(await file.text(), file.name); } catch (error) { banner('fileReadFailure'); }
    event.target.value = '';
  };
  $('usePaste').onclick = async () => {
    const name = $('pasteFormat').value === 'md' ? t('pastedMarkdown') : t('pasted');
    if (await importText($('paste').value, name)) {
      $('paste').value = '';
      $('paste').closest('details').open = false;
    }
  };
  $('full').onclick = async () => {
    if (native) { window.webkit.messageHandlers.native.postMessage('fullscreen'); return; }
    try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); }
    catch (_) { banner('fullScreenFailure'); }
  };
  viewport.addEventListener('wheel', event => { if (event.deltaY || event.deltaX) { stop('manual'); ignoreScrollUntil = 0; } }, {passive: true});
  viewport.addEventListener('touchstart', () => { stop('manual'); ignoreScrollUntil = 0; }, {passive: true});
  viewport.addEventListener('scroll', () => { if (ready && !playing && !counting && performance.now() > ignoreScrollUntil) syncCursor(); });
  document.addEventListener('keydown', event => {
    if (event.code === 'Escape') { closePanel(); document.querySelector('header').hidden = false; scheduleMeasure(); return; }
    if (event.target.closest('input,textarea,select,button,[contenteditable="true"]')) return;
    if (event.code === 'Space') { event.preventDefault(); if (!event.repeat) toggle(); }
    else if (event.code === 'ArrowLeft') { event.preventDefault(); go(index - 1); }
    else if (event.code === 'ArrowRight') { event.preventDefault(); go(index + 1); }
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden && (playing || counting)) stop('hidden'); });
  window.addEventListener('pagehide', () => { rememberPosition(); });
  new ResizeObserver(scheduleMeasure).observe(viewport); document.fonts.ready.then(scheduleMeasure);
  void initialize();
})();
