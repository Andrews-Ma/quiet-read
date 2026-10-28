'use strict';
const assert = require('node:assert/strict');
const engine = require('../src/web/engine.js');
const i18n = require('../src/web/i18n.js');

assert.deepEqual(Object.keys(i18n.messages.en).sort(), Object.keys(i18n.messages.zh).sort());
i18n.setLanguage('en'); assert.equal(i18n.t('settings'), 'Settings');
i18n.setLanguage('zh'); assert.equal(i18n.t('settings'), '设置');

const plainText = '# Keep this line\n\n```\nKeep this content.\n```\n\nEnd.';
const plain = engine.parseDocument(plainText, 'example.txt');
assert.equal(plain.rows.map(row => row.text).join('\n\n'), plainText);
const markdown = engine.parseDocument('# Scene\n\nFirst.\n\n```\nSecond.\n```', 'example.md');
assert.deepEqual(markdown.rows.map(row => row.text), ['First.', 'Second.']);
assert.deepEqual(markdown.warnings.map(item => item.key), ['headings', 'fences']);
const marked = engine.parseDocument('notes\n<!-- CONTENT START -->\n## Scene\n\nSpoken text\n<!-- CONTENT END -->\nnotes', 'example.md');
assert.deepEqual(marked.rows.map(row => row.text), ['Spoken text']);
const aiMarkdown = '# 场景一\n\n她说：**不要回头**，然后看向[窗户](https://example.com)。\n\n- 第一件事\n- [x] 第二件事\n\n> 一句*低语*。\n\n| 项目 | 结果 |\n| --- | --- |\n| A | 保留 |\n\n~~~text\n代码中的 **符号**\n~~~';
const aiParsed = engine.parseDocument(aiMarkdown, 'generated.markdown');
assert.deepEqual(aiParsed.rows.map(row => row.text), ['她说：不要回头，然后看向窗户。', '• 第一件事', '• [x] 第二件事', '一句低语。', '项目 | 结果', 'A | 保留', '代码中的 **符号**']);
assert.ok(aiParsed.rows.every(row => row.section === '场景一'));
assert.ok(aiParsed.warnings.some(w => w.key === 'markdownSimplified'));
const wrapper = engine.parseDocument('```markdown\n# 场景\n\n**正文**。\n```', 'model.md');
assert.deepEqual(wrapper.rows.map(row => row.text), ['正文。']);
assert.ok(wrapper.warnings.some(w => w.key === 'markdownWrapper'));
const incomplete = engine.parseDocument('~~~markdown\n未闭合的 **内容**', 'model.md');
assert.deepEqual(incomplete.rows.map(row => row.text), ['未闭合的 **内容**']);
assert.ok(incomplete.warnings.some(w => w.key === 'fenceOpen'));
const metadata = engine.parseDocument('---\ntitle: 示例\n---\n\n正文', 'model.md');
assert.deepEqual(metadata.rows.map(row => row.text), ['---\ntitle: 示例\n---', '正文']);
assert.ok(metadata.warnings.some(w => w.key === 'frontMatter'));
const setext = engine.parseDocument('可能是正文\n---\n\n下一段', 'model.md');
assert.deepEqual(setext.rows.map(row => row.text), ['可能是正文', '下一段']);
const dangerous = engine.parseDocument('<script>alert(1)</script>\n\n网址：<https://example.com>', 'model.md');
assert.equal(dangerous.rows[0].text, '<script>alert(1)</script>');
assert.ok(dangerous.warnings.some(w => w.key === 'markdownHtml'));
const quoted = engine.parseDocument('1. 先做\n2. 再做\n\n反斜线 \\*字\\* 与 `a < b`。', 'model.md');
assert.deepEqual(quoted.rows.map(row => row.text), ['1. 先做', '2. 再做', '反斜线 *字* 与 a < b。']);
for (const [value, code] of [['', 'empty'], ['\ufffd', 'badEncoding'], ['x'.repeat(2000001), 'tooLong']]) {
  assert.throws(() => engine.parseDocument(value, 'example.txt'), error => error.code === code);
}
assert.deepEqual(engine.buildTimeline([{text: 'ab'}, {text: 'c'}]), {prefix: [0, 2], total: 3});
assert.deepEqual(engine.speedOptions(100, 300), [100, 140, 180, 220, 260, 300]);
assert.deepEqual(engine.speedOptions(100, 103), [100, 100.6, 101.2, 101.8, 102.4, 103]);
assert.equal(engine.nearestSpeed(engine.speedOptions(100, 300), 200), 180);
for (const [min, max] of [[0,100], [300,100], [150,150], [1,1001], [1.5,10]]) {
  assert.throws(() => engine.speedOptions(min, max), error => error.code === 'speedInvalid');
}
// Unequal paragraphs and spacing must not change the visual scroll velocity.
const rows = [{text: 'a'}, {text: 'b'.repeat(100)}, {text: 'c'.repeat(10)}];
const {prefix, total} = engine.buildTimeline(rows);
const tops = [100, 200, 600], heights = [100, 400, 100];
const velocity = engine.scrollVelocity(100, 700, total, 222);
assert.equal(velocity, 20);
assert.equal(engine.cursorAtOffset(100, rows, prefix, tops, heights, total), 0);
assert.equal(engine.cursorAtOffset(200, rows, prefix, tops, heights, total), 1);
assert.equal(engine.cursorAtOffset(400, rows, prefix, tops, heights, total), 51);
assert.equal(engine.cursorAtOffset(700, rows, prefix, tops, heights, total), total);
let offset = 100, elapsed = 0;
const intervals = [1 / 60, 1 / 120, .2, .4];
for (let i = 0; i < 12000; i++) {
  const dt = intervals[i % intervals.length];
  offset = engine.advanceScroll(offset, velocity, dt, Infinity); elapsed += dt;
}
assert.ok(Math.abs(offset - (100 + velocity * elapsed)) < 1e-6);
assert.equal(engine.advanceScroll(10, 20, .4, 100), 18);
assert.equal(engine.advanceScroll(10, 20, 1.01, 100), null);
assert.equal(engine.advanceScroll(90, 20, 1, 100), 100);
assert.equal(engine.scrollVelocity(0, 100, 0, 150), 0);
console.log('Passed: localization keys, parsing, ranges and constant-speed scrolling.');
