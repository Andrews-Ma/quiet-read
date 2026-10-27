(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.QuietReadStorage = api;
})(typeof globalThis === 'undefined' ? this : globalThis, function () {
  'use strict';
  function create({native, validBook, validState, t, host = globalThis}) {
    const prefix = 'quietprompt-v3';
    const requests = new Map();
    let nextId = 0;
    function nativeCall(op, value) {
      return new Promise((resolve, reject) => {
        const id = ++nextId;
        const timeout = setTimeout(() => { requests.delete(id); reject(new Error(t('noResponse'))); }, 8000);
        requests.set(id, {resolve, reject, timeout});
        try { host.webkit.messageHandlers.native.postMessage({id, op, value: value ?? null}); }
        catch (error) { clearTimeout(timeout); requests.delete(id); reject(error); }
      });
    }
    host.__nativeResult = result => {
      const item = requests.get(result.id);
      if (!item) return;
      clearTimeout(item.timeout); requests.delete(result.id);
      if (result.ok) item.resolve(result.value); else item.reject(new Error(result.error || t('saveError')));
    };
    function readJSON(key) {
      const raw = host.localStorage.getItem(key);
      return raw === null ? null : JSON.parse(raw);
    }
    const adapter = native ? {
      loadState: () => nativeCall('loadState'),
      saveState: state => nativeCall('saveState', state),
      loadBook: id => nativeCall('loadBook', id),
      saveBook: book => nativeCall('saveBook', book),
    } : {
      async loadState() {
        const main = host.localStorage.getItem(prefix + ':state');
        const previous = host.localStorage.getItem(prefix + ':previous');
        if (main === null && previous === null) return {state: null, recovered: false};
        try { const state = JSON.parse(main); if (validState(state)) return {state, recovered: false}; } catch (_) {}
        try { const state = JSON.parse(previous); if (validState(state)) return {state, recovered: true}; } catch (_) {}
        throw new Error(t('corruptState'));
      },
      async saveState(state) {
        const loaded = await this.loadState();
        if (loaded.state && !loaded.recovered) host.localStorage.setItem(prefix + ':previous', JSON.stringify(loaded.state));
        host.localStorage.setItem(prefix + ':state', JSON.stringify(state));
      },
      async loadBook(id) {
        const book = readJSON(prefix + ':book:' + id);
        if (!book || !validBook(book)) throw new Error(t('missingBook'));
        return book;
      },
      async saveBook(book) {
        const key = prefix + ':book:' + book.id;
        const existing = readJSON(key);
        if (existing && JSON.stringify(existing.rows) !== JSON.stringify(book.rows)) throw new Error(t('collision'));
        host.localStorage.setItem(key, JSON.stringify(book));
      },
    };
    return {adapter, readJSON};
  }
  return {create};
});
