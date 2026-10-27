(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.QuietReadI18n = api;
})(typeof globalThis === 'undefined' ? this : globalThis, function () {
  'use strict';
  const messages = {
    en: {
      speedAria: 'Speed, characters per minute', currentScript: 'Current script', previous: 'Previous paragraph', next: 'Next paragraph',
      settings: 'Settings', fullScreen: 'Full screen', dismiss: 'Dismiss', script: 'Script', readingProgress: 'Reading progress',
      close: 'Close', closeSettings: 'Close settings', settingsTitle: 'Script and settings', language: 'Language', import: 'Import TXT / Markdown…',
      recent: 'Recent scripts', section: 'Section', speedRange: 'Speed range (characters per minute)', minimum: 'Minimum', maximum: 'Maximum',
      applyRange: 'Apply range', fontSize: 'Font size', countdown: 'Silent 3-second countdown', focus: 'Hide toolbar while reading (Esc to show)',
      pasteLabel: 'Or paste a script', pastePlaceholder: 'Paste your script', loadText: 'Load text',
      shortcuts: 'Space: start / pause. Arrow keys: previous / next paragraph. Scrolling pauses. Speed is an estimate; the app does not record.',
      rangeHelp: 'Enter whole numbers from 1 to 1000. Six buttons include both endpoints at equal intervals; intervals may be decimal.',
      rangeApplied: 'Set: {values} characters/minute', rangeSelected: '; speed changed to {speed}', speedLabel: '{speed} characters per minute',
      start: 'Start', resume: 'Resume', pause: 'Pause', cancel: 'Cancel', paused: 'Paused', scrolling: 'Scrolling', manual: 'Manual positioning',
      hidden: 'Window hidden; paused', end: 'End of script', waiting: 'Waiting to save', saved: 'Saved', saving: 'Saving…', saveFailed: 'Save failed · Retry',
      saveHint: 'Scripts and progress are stored locally', retryHint: 'Click to retry; previous valid data is preserved',
      storageOK: 'Scripts and progress are stored locally; imported files are never overwritten.',
      storageRisk: 'This session may not be restored. Check storage, then click “Save failed · Retry”.',
      storageFailure: 'Could not save or restore: {error} Original files and backups were preserved.',
      recoveryFailure: 'Could not restore or save progress: {error} Existing files were preserved; check storage and retry.',
      chooseScript: 'Choose a script in Settings → Recent scripts first. Existing state files were preserved.',
      documentInfo: 'Current script: {title} · {format} · {count} paragraphs', textFormat: 'Text', body: 'Body', pasted: 'Pasted script.txt',
      changedVersion: 'The same name has different content. This version starts at the beginning; the earlier version remains in recent scripts.',
      openFailure: 'Could not open script: {error} The current script was not changed.',
      importFailure: 'Could not import: {error} The current script and source file were not changed.',
      fileReadFailure: 'Could not read the file. The current script was not changed.', fullScreenFailure: 'Use the browser menu to enter full screen.',
      backupRecovered: 'Restored the previous valid progress backup.', legacyRestored: 'Restored the previous local script, progress and settings.',
      noResponse: 'Local storage did not respond.', saveError: 'Local storage failed.', corruptState: 'Progress and its backup could not be read; original files were preserved.',
      missingBook: 'The saved script could not be found; the source file was not changed.', collision: 'Script identifier collision; existing script was preserved.',
      invalidState: 'Saved progress has an invalid format.', invalidBook: 'The saved script is incomplete.', missingSample: 'Could not load the example script.',
      invalidText: 'The file is not text.', badEncoding: 'The file is not valid UTF-8. Save it as UTF-8 and try again.',
      tooLong: 'The script exceeds two million characters. Split it into smaller files.', empty: 'The script has no readable text.',
      badMarkers: 'Content markers are in the wrong order.', markerFound: 'Content outside the markers was hidden.', markerIncomplete: 'Content markers are incomplete; all text was retained.',
      headings: '{count} Markdown headings are used for section navigation and are not read aloud.',
      fences: '{count} Markdown fence markers are hidden; their content is retained.', fenceOpen: 'An unclosed Markdown fence was found; check the retained text.',
      comments: 'The script contains comment markers; they are displayed as text.', speedInvalid: 'Enter whole numbers from 1 to 1000, with a maximum greater than the minimum.',
      speedRequired: 'Enter both a minimum and a maximum.', fileTooLarge: 'The file is too large. Split it into smaller files; the current script was not changed.',
      legacyTitle: 'Previously imported script', legacyFormat: 'Previous import'
    },
    zh: {
      speedAria: '速度，字每分钟', currentScript: '当前稿件', previous: '上一段', next: '下一段', settings: '设置', fullScreen: '全屏', dismiss: '关闭提示',
      script: '朗读正文', readingProgress: '阅读进度', close: '关闭', closeSettings: '关闭设置', settingsTitle: '稿件与设置', language: '界面语言',
      import: '导入TXT／Markdown…', recent: '最近稿件', section: '章节／场景', speedRange: '速度范围（字／分钟）', minimum: '下限', maximum: '上限',
      applyRange: '应用范围', fontSize: '字号', countdown: '开始前无声倒数3秒', focus: '阅读时隐藏顶部工具栏（Esc恢复）', pasteLabel: '或粘贴正文',
      pastePlaceholder: '粘贴小说正文', loadText: '载入文字', shortcuts: '空格：开始／暂停；← →：前后段。滚轮会暂停。速度是估算值，不跟随声音；程序不录音。',
      rangeHelp: '设置1–1000之间的整数；六个按钮包含两端并等间隔。间隔可含小数。', rangeApplied: '已设置：{values} 字／分钟',
      rangeSelected: '；当前速度调整为 {speed}', speedLabel: '{speed}字每分钟', start: '开始', resume: '继续', pause: '暂停', cancel: '取消',
      paused: '已暂停', scrolling: '滚动中', manual: '手动定位', hidden: '窗口隐藏，已暂停', end: '已到全文末尾', waiting: '等待保存',
      saved: '已保存', saving: '保存中…', saveFailed: '保存失败 · 重试', saveHint: '稿件与进度保存在本机', retryHint: '点击重试；之前有效的稿件与进度会保留',
      storageOK: '稿件与进度保存在本机；导入的原文件不会被覆盖。', storageRisk: '本次进度可能无法恢复；检查存储后点击底部“保存失败 · 重试”。',
      storageFailure: '保存或恢复失败：{error} 原稿和旧备份未覆盖。', recoveryFailure: '无法恢复或保存阅读状态：{error} 现有文件已保留；请检查存储后重试。',
      chooseScript: '请先在“设置 → 最近稿件”选择要继续的稿件。旧状态文件已保留。',
      documentInfo: '当前稿件：{title} · {format} · {count}段', textFormat: '文本', body: '正文', pasted: '粘贴稿件.txt',
      changedVersion: '同名稿件内容已变化，作为新版本从头开始；旧版本仍在最近稿件中', openFailure: '无法打开该稿件：{error} 当前稿件未改变。',
      importFailure: '无法导入：{error} 当前稿件和原文件未改变。', fileReadFailure: '文件读取失败，当前稿件未改变。', fullScreenFailure: '请使用浏览器菜单进入全屏。',
      backupRecovered: '已从上一次有效的进度备份恢复。', legacyRestored: '已保留旧版稿件、阅读位置和设置。', noResponse: '本地保存没有响应。',
      saveError: '本地保存失败。', corruptState: '阅读状态和备份都无法读取；原数据已保留。', missingBook: '找不到保存的稿件，原文件未改变。',
      collision: '稿件标识冲突，原稿已保留。', invalidState: '保存的阅读状态格式无效。', invalidBook: '稿件数据不完整。', missingSample: '无法读取示例稿件。',
      invalidText: '文件内容不是文本。', badEncoding: '文件编码无法正确读取，请另存为 UTF-8。', tooLong: '稿件超过200万字符，请按卷拆分。',
      empty: '稿件没有可朗读的正文。', badMarkers: '正文标记顺序不正确。', markerFound: '已按正文标记隐藏文档前后的说明。',
      markerIncomplete: '正文标记不完整，已保留全部文字。', headings: '{count}个Markdown标题用于章节定位，不作为正文朗读。',
      fences: '已隐藏{count}个围栏标记，围栏中的文字仍保留。', fenceOpen: 'Markdown围栏未闭合，正文文字已保留，请核对。',
      comments: '正文内含注释标记，已原样显示，请核对。', speedInvalid: '请输入1–1000之间的整数，且上限必须大于下限。',
      speedRequired: '请填写速度下限和上限。', fileTooLarge: '文件过大，请按卷拆分。当前稿件未改变。', legacyTitle: '上次导入稿件', legacyFormat: '旧版导入'
    }
  };
  let language = 'en';
  function setLanguage(value) { language = value === 'zh' ? 'zh' : 'en'; }
  function t(key, values = {}) {
    const template = messages[language][key] ?? messages.en[key] ?? key;
    return template.replace(/\{(\w+)\}/g, (_, name) => String(values[name] ?? ''));
  }
  function apply(document) {
    document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en';
    document.querySelectorAll('[data-i18n]').forEach(element => { element.textContent = t(element.dataset.i18n); });
    document.querySelectorAll('[data-i18n-aria]').forEach(element => element.setAttribute('aria-label', t(element.dataset.i18nAria)));
    document.querySelectorAll('[data-i18n-placeholder]').forEach(element => element.setAttribute('placeholder', t(element.dataset.i18nPlaceholder)));
  }
  return {setLanguage, t, apply, messages};
});
