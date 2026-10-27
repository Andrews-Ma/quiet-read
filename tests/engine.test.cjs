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
for (const speed of [150, 200]) {
  let cursor = 0;
  for (let i = 0; i < 30 * 60 * 60; i++) cursor = engine.advance(cursor, speed, 1 / 60, 200000);
  assert.ok(Math.abs(cursor - speed * 30) < .01);
}
assert.equal(engine.advance(0, 150, 10, 100), .625);
console.log('Passed: localization keys, parsing, ranges and simulated scrolling.');
