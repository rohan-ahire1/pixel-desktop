// Minimal browser stubs so modules that touch the DOM or storage at load can be imported under node.
const noop = () => {};
const store = () => {
  let m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); },
    clear: () => { m = new Map(); },
  };
};
globalThis.matchMedia = () => ({ matches: false, addEventListener: noop });
globalThis.localStorage = store();
globalThis.sessionStorage = store();
globalThis.addEventListener = noop;
globalThis.document = {
  querySelector: () => null,
  querySelectorAll: () => [],
  createElement: () => ({ width: 0, height: 0, getContext: () => null }),
  body: { classList: { contains: () => false } },
};

let n = 0;
export async function freshFs() {
  globalThis.localStorage.clear();
  globalThis.sessionStorage.clear();
  return import(`../../js/fs.js?${++n}`);
}
