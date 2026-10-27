'use strict';
const assert = require('node:assert/strict');
const {create} = require('../src/web/storage.js');
const values = new Map();
const localStorage = {
  getItem: key => values.has(key) ? values.get(key) : null,
  setItem: (key, value) => values.set(key, value),
};
const {adapter} = create({native: false, host: {localStorage}, validState: s => s && s.version === 3,
  validBook: b => Boolean(b && b.id), t: key => key});
(async () => {
  await adapter.saveBook({id: 'example', rows: [{text: 'First'}]});
  await assert.rejects(() => adapter.saveBook({id: 'example', rows: [{text: 'Different'}]}), /collision/);
  assert.equal((await adapter.loadBook('example')).rows[0].text, 'First');
  await adapter.saveState({version: 3, cursor: 10});
  await adapter.saveState({version: 3, cursor: 50});
  values.set('quietprompt-v3:state', '{broken');
  const restored = await adapter.loadState();
  assert.equal(restored.recovered, true); assert.equal(restored.state.cursor, 10);
  values.set('quietprompt-v3:previous', '{broken too');
  await assert.rejects(() => adapter.saveState({version: 3, cursor: 99}), /corruptState/);
  assert.equal(values.get('quietprompt-v3:state'), '{broken');
  console.log('Passed: browser storage recovery and existing-data protection.');
})().catch(error => { console.error(error); process.exitCode = 1; });
