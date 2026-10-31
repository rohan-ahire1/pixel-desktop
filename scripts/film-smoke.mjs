// Runs every frame of both films against a fake canvas, so a broken scene fails without a browser.
const noop = () => {};
let bad = 0, depth = 0, texts = [], fills = [];
const check = (...a) => { if (a.some((v) => !Number.isFinite(v))) bad++; };
const ctx = () => new Proxy({ measureText: (s) => ({ width: String(s).length * 10 }) }, {
  get(o, k) {
    if (k in o) return o[k];
    if (k === "fillRect") return (...a) => { check(...a); fills.push([o.fillStyle, ...a]); };
    if (k === "fillText") return (s, x, y) => { check(x, y); if (/undefined|NaN/.test(s)) bad++; texts.push([s, x, y]); };
    if (k === "rect" || k === "arc" || k === "translate" || k === "scale" || k === "rotate") return (...a) => check(...a);
    if (k === "save") return () => { depth++; };
    if (k === "restore") return () => { depth--; };
    return noop;
  },
  set(o, k, v) { o[k] = v; return true; },
});
globalThis.matchMedia = () => ({ matches: false, addEventListener: noop });
globalThis.addEventListener = noop;
globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: ctx }), querySelector: () => null, body: { classList: { contains: () => false } } };
globalThis.localStorage = { getItem: () => null, setItem: noop, removeItem: noop };

const cut = await import("../js/film/one-cut.js"), panic = await import("../js/film/coffee-panic.js");
const fail = [], want = (ok, msg) => { if (!ok) fail.push(msg); };
const FPS = 30, c = ctx();

/* One Cut: every frame, and how long each stamp stays readable */
const STAMPS = ["TOP LEAD", "PAID", "FOUND", "BACKTEST PASSED", "+1 COUNTRY", "BEST MOVE"], seen = Object.fromEntries(STAMPS.map((s) => [s, 0]));
const frames = Math.ceil(cut.LEN * FPS);
for (let n = 0; n <= frames + 60; n++) {
  texts = [];
  cut.draw(c, n / FPS);
  if (depth) { fail.push(`unbalanced save at frame ${n}`); depth = 0; }
  if (n / FPS >= cut.LEN) continue;
  STAMPS.forEach((s) => { if (texts.some(([w, , y]) => w === s && y < cut.H && (s !== "FOUND" || y >= 24))) seen[s]++; });
}
want(cut.LEN >= 10 && cut.LEN < 15, `film is ${cut.LEN.toFixed(2)}s, wanted 10 to 15s`);
STAMPS.forEach((s) => want(seen[s] / FPS >= 0.4, `${s} shows for ${(seen[s] / FPS).toFixed(2)}s, wanted at least 0.4s`));

/* Coffee Panic: both paths through the throw, and no full-screen flash storm */
function boot(thrownAt) {
  const s = panic.startClock();
  let flashes = 0, lit = false, n = 0;
  while (s.t < panic.END && n++ < 40 * FPS) {
    if (thrownAt != null && s.w >= thrownAt && panic.canThrow(s)) s.thrown = true;
    panic.advance(s, 1 / FPS);
    fills = [];
    panic.frame(c, s.t, true, s.w);
    if (depth) { fail.push("unbalanced save in Coffee Panic"); depth = 0; }
    const white = fills.some(([col, , , w, h]) => /^rgba\(255,255,255/.test(col) && w >= panic.W && h >= panic.H);
    if (white && !lit) flashes++;
    lit = white;
  }
  return { secs: s.w, flashes };
}
const auto = boot(null), clicked = boot(1.6);
want(auto.secs <= panic.END + 1.4, `boot without a click takes ${auto.secs.toFixed(1)}s`);
want(clicked.secs < auto.secs, "throwing early should finish sooner");
want(auto.flashes <= 3, `${auto.flashes} full-screen flashes, wanted at most 3`);
panic.frame(c, panic.STILL, true, 0);

want(bad === 0, `${bad} non-finite drawing values`);
console.log(`One Cut ${cut.LEN.toFixed(2)}s, ${frames} frames at ${FPS} fps`);
console.log("stamps: " + STAMPS.map((s) => `${s} ${(seen[s] / FPS).toFixed(2)}s`).join(", "));
console.log("segments: " + cut.SEGS.map((s) => `${s.id}@${s.at.toFixed(2)}`).join(" "));
console.log(`Coffee Panic ${auto.secs.toFixed(1)}s with no click, ${clicked.secs.toFixed(1)}s with one, ${auto.flashes} flash`);
fail.forEach((f) => console.error("FAIL " + f));
process.exit(fail.length ? 1 : 0);
