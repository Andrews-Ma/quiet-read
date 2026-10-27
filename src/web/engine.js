(function (root, factory) {
  const engine = factory();
  if (typeof module === 'object' && module.exports) module.exports = engine;
  if (root) root.QuietPromptEngine = engine;
})(typeof globalThis === 'undefined' ? this : globalThis, function () {
  'use strict';

  // The legacy hash is retained so existing local progress can be restored.
  function fingerprint(text) {
    let hash = 2166136261;
    for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
    return text.length + '-' + (hash >>> 0).toString(16);
  }
  const legacyIdFor = rows => fingerprint(rows.map(row => row.text).join('\n'));
  const idFor = rows => fingerprint(rows.map(row => row.text + '\u0000' + row.section).join('\n'));
  function fail(code) { const error = new Error(code); error.code = code; throw error; }
  function parseDocument(input, name) {
    if (typeof input !== 'string') fail('invalidText');
    if (input.includes('\ufffd')) fail('badEncoding');
    if (input.length > 2000000) fail('tooLong');
    const source = input.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
    if (!source.trim()) fail('empty');
    if (!/\.(md|markdown)$/i.test(name || '')) {
      const rows = source.split(/\n[\t ]*\n+/).filter(part => part.trim()).map(text => ({text, section: 'Body'}));
      return {rows, warnings: [], kind: 'TXT'};
    }
    let body = source, section = 'Body', lines = [], rows = [], headers = 0, fences = 0;
    const warnings = [];
    const markerPairs = [['<!-- CONTENT START -->', '<!-- CONTENT END -->'], ['<!-- 正文开始 -->', '<!-- 正文结束 -->']];
    const pair = markerPairs.find(([start, end]) => body.includes(start) || body.includes(end));
    if (pair) {
      const [start, end] = pair;
      if (body.includes(start) && body.includes(end)) {
        const a = body.indexOf(start), b = body.indexOf(end, a + start.length);
        if (b < 0) fail('badMarkers');
        body = body.slice(a + start.length, b);
        warnings.push({key: 'markerFound'});
      } else warnings.push({key: 'markerIncomplete'});
    }
    let insideFence = false;
    function flush() {
      const text = lines.join('\n');
      if (text.trim()) rows.push({text, section});
      lines = [];
    }
    for (const line of body.split('\n')) {
      if (/^\s*```/.test(line)) { flush(); insideFence = !insideFence; fences++; continue; }
      const heading = !insideFence && line.match(/^\s{0,3}#{1,6}\s+(.+)$/);
      if (heading) { flush(); section = heading[1].trim(); headers++; continue; }
      if (!line.trim()) flush(); else lines.push(line);
    }
    flush();
    if (headers) warnings.push({key: 'headings', values: {count: headers}});
    if (fences) warnings.push({key: 'fences', values: {count: fences}});
    if (insideFence) warnings.push({key: 'fenceOpen'});
    if (body.includes('<!--')) warnings.push({key: 'comments'});
    if (!rows.length) fail('empty');
    return {rows, warnings, kind: 'Markdown'};
  }
  function buildTimeline(rows) {
    let total = 0;
    const prefix = rows.map(row => { const start = total; total += row.text.length; return start; });
    return {prefix, total};
  }
  function advance(cursor, speed, elapsedSeconds, total) {
    return Math.min(total, Math.max(0, cursor + speed / 60 * Math.min(.25, Math.max(0, elapsedSeconds))));
  }
  function speedOptions(minimum, maximum) {
    if (!Number.isInteger(minimum) || !Number.isInteger(maximum) || minimum < 1 || maximum > 1000 || minimum >= maximum) fail('speedInvalid');
    return Array.from({length: 6}, (_, i) => Number((minimum + (maximum - minimum) * i / 5).toFixed(1)));
  }
  function nearestSpeed(options, speed) {
    if (!Number.isFinite(speed)) return options[0];
    return options.reduce((best, value) => Math.abs(value - speed) < Math.abs(best - speed) - 1e-9 ? value : best);
  }
  return {fingerprint, legacyIdFor, idFor, parseDocument, buildTimeline, advance, speedOptions, nearestSpeed};
});
