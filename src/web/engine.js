(function (root, factory) {
  const marked = typeof module === 'object' && module.exports ? require('./vendor/marked.umd.js') : root.marked;
  const engine = factory(marked);
  if (typeof module === 'object' && module.exports) module.exports = engine;
  if (root) root.QuietPromptEngine = engine;
})(typeof globalThis === 'undefined' ? this : globalThis, function (marked) {
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
    let body = source, section = 'Body', rows = [], headers = 0, fences = 0;
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
    // Model responses sometimes wrap the whole document in a Markdown code fence.
    // Unwrap only a complete, unambiguous outer fence explicitly labeled Markdown.
    const trimmed = body.trim();
    const wrapper = trimmed.match(/^ {0,3}(`{3,}|~{3,})(?:markdown|md)[\t ]*\n/i);
    if (wrapper) {
      const fence = wrapper[1];
      const closing = new RegExp('^ {0,3}' + fence[0] + '{' + fence.length + ',}[\\t ]*$', 'm');
      const remainder = trimmed.slice(wrapper[0].length);
      const match = closing.exec(remainder);
      if (match && !remainder.slice(match.index + match[0].length).trim()) {
        body = remainder.slice(0, match.index);
        warnings.push({key: 'markdownWrapper'});
      }
    }
    const frontMatter = body.match(/^---[\t ]*\n[\s\S]*?\n(?:---|\.\.\.)[\t ]*(?:\n|$)/);
    if (frontMatter) {
      rows.push({text: frontMatter[0].trimEnd(), section});
      body = body.slice(frontMatter[0].length);
      warnings.push({key: 'frontMatter'});
    }
    let simplified = false, unclosedFence = false, rawHtml = false;
    function decodeEntities(text) {
      const named = {amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0'};
      return text.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (raw, entity) => {
        if (entity[0] !== '#') return named[entity.toLowerCase()] || raw;
        const value = entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
        return value > 0 && value <= 0x10ffff && !(value >= 0xd800 && value <= 0xdfff) ? String.fromCodePoint(value) : raw;
      });
    }
    function inline(tokens) {
      return (tokens || []).map(token => {
        if (['strong', 'em', 'del', 'link', 'image'].includes(token.type)) {
          simplified = true;
          return token.tokens?.length ? inline(token.tokens) : (token.text || token.raw);
        }
        if (token.type === 'codespan' || token.type === 'escape') { simplified = true; return token.text; }
        if (token.type === 'br') { simplified = true; return '\n'; }
        if (token.type === 'html') { rawHtml = true; return token.raw; }
        if (token.type === 'text') return token.tokens ? inline(token.tokens) : decodeEntities(token.text);
        return token.raw || token.text || '';
      }).join('');
    }
    function add(text) { if (text && text.trim()) rows.push({text: text.trimEnd(), section}); }
    function visit(tokens) {
      for (const token of tokens) {
        switch (token.type) {
          case 'space': break;
          case 'heading': {
            const title = inline(token.tokens).trim();
            section = (title || token.text).slice(0, 512); headers++;
            // Setext headings can be ordinary prose followed by a separator.
            if (!/^ {0,3}#{1,6}(?:\s|$)/.test(token.raw)) add(title || token.text);
            break;
          }
          case 'paragraph': case 'text': add(token.tokens ? inline(token.tokens) : token.text); break;
          case 'blockquote': simplified = true; visit(token.tokens); break;
          case 'list':
            simplified = true;
            token.items.forEach((item, i) => {
              const begin = rows.length;
              visit(item.tokens.filter(child => child.type !== 'checkbox'));
              const marker = token.ordered ? ((item.raw.match(/^\s*\d+[.)]/) || [String(Number(token.start) + i) + '.'])[0].trim() + ' ') : '• ';
              const task = item.task ? (item.checked ? '[x] ' : '[ ] ') : '';
              if (rows.length > begin) rows[begin].text = marker + task + rows[begin].text;
              else add(marker + task + item.text);
            });
            break;
          case 'table':
            simplified = true;
            [token.header, ...token.rows].forEach(cells => add(cells.map(cell => inline(cell.tokens)).join(' | ')));
            break;
          case 'code': {
            const opening = token.raw.match(/^ {0,3}(`{3,}|~{3,})[^\n]*\n/);
            if (opening) {
              const closing = new RegExp('(?:^|\\n) {0,3}' + opening[1][0] + '{' + opening[1].length + ',}[\\t ]*(?:\\n|$)');
              const closed = closing.test(token.raw.slice(opening[0].length));
              fences += closed ? 2 : 1; unclosedFence ||= !closed;
            }
            add(token.text); break;
          }
          case 'hr': simplified = true; break;
          case 'html': rawHtml = true; add(token.raw); break;
          default: add(token.raw || token.text); break;
        }
      }
    }
    try { visit(marked.lexer(body, {gfm: true})); }
    catch (_) {
      rows = source.split(/\n[\t ]*\n+/).filter(part => part.trim()).map(text => ({text, section: 'Body'}));
      return {rows, warnings: [{key: 'markdownFallback'}], kind: 'Markdown'};
    }
    if (headers) warnings.push({key: 'headings', values: {count: headers}});
    if (fences) warnings.push({key: 'fences', values: {count: fences}});
    if (unclosedFence) warnings.push({key: 'fenceOpen'});
    if (body.includes('<!--')) warnings.push({key: 'comments'});
    if (rawHtml && !body.includes('<!--')) warnings.push({key: 'markdownHtml'});
    if (simplified) warnings.push({key: 'markdownSimplified'});
    if (!rows.length) fail('empty');
    return {rows, warnings, kind: 'Markdown'};
  }
  function buildTimeline(rows) {
    let total = 0;
    const prefix = rows.map(row => { const start = total; total += row.text.length; return start; });
    return {prefix, total};
  }
  function scrollVelocity(firstTop, lastEnd, total, charactersPerMinute) {
    return total > 0 ? Math.max(0, lastEnd - firstTop) / total * charactersPerMinute / 60 : 0;
  }
  function advanceScroll(offset, velocity, elapsed, end) {
    if (elapsed > 1) return null;
    return Math.min(end, offset + velocity * Math.max(0, elapsed));
  }
  function cursorAtOffset(offset, rows, prefix, tops, heights, total) {
    let lo = 0, hi = tops.length - 1;
    while (lo < hi) { const mid = Math.ceil((lo + hi) / 2); if (tops[mid] <= offset) lo = mid; else hi = mid - 1; }
    const fraction = Math.max(0, Math.min(1, (offset - tops[lo]) / heights[lo]));
    return Math.max(0, Math.min(total, prefix[lo] + fraction * rows[lo].text.length));
  }
  function speedOptions(minimum, maximum) {
    if (!Number.isInteger(minimum) || !Number.isInteger(maximum) || minimum < 1 || maximum > 1000 || minimum >= maximum) fail('speedInvalid');
    return Array.from({length: 6}, (_, i) => Number((minimum + (maximum - minimum) * i / 5).toFixed(1)));
  }
  function nearestSpeed(options, speed) {
    if (!Number.isFinite(speed)) return options[0];
    return options.reduce((best, value) => Math.abs(value - speed) < Math.abs(best - speed) - 1e-9 ? value : best);
  }
  return {fingerprint, legacyIdFor, idFor, parseDocument, buildTimeline, scrollVelocity, advanceScroll, cursorAtOffset, speedOptions, nearestSpeed};
});
