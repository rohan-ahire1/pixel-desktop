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
const LIVE = { vw: 1280, vh: 800, fit: 800 / 750, bar: 752, me: { x: 330, y: 626, S: 3 } };
function boot(thrownAt, live = LIVE) {
  const s = panic.startClock();
  let flashes = 0, lit = false, n = 0;
  while (s.t < panic.END && n++ < 40 * FPS) {
    if (thrownAt != null && s.w >= thrownAt && panic.canThrow(s)) s.thrown = true;
    panic.advance(s, 1 / FPS);
    fills = [];
    panic.frame(c, s.t, true, s.w);
    if (s.t >= panic.MELT) panic.wash(c, s.t, s.w, live);
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
fills = [];
panic.wash(c, panic.END - 0.05, panic.END, LIVE);
want(fills.length === 0, "the last boot frame still paints something over the desktop");
panic.frame(c, panic.STILL + 0.2, true, 0, true);
panic.wash(c, 4.2, 4.2, { ...LIVE, me: null });

/* Coffee Panic at any window: no bars, nothing stretched, the wash reaches both edges */
for (const [vw, vh] of [[2000, 1020], [1600, 700], [1280, 800], [1024, 768], [3440, 1440], [800, 1100], [1100, 480]]) {
  panic.size(vw, vh);
  const fit = vw / panic.W, live = { ...LIVE, vw, vh, fit, bar: vh - 48, me: { x: vw * 0.25, y: vh - 174, S: 3 } }, name = `${vw}x${vh}`;
  want(panic.W >= 900 && panic.H >= 750, `${name}: the film is only ${panic.W}x${panic.H}`);
  want(Math.abs(panic.H * fit - vh) < fit, `${name}: the film is stretched`);
  panic.frame(c, 1, true, 1);
  want(fills.some(([col, x, y, w, h]) => col === "#000" && !x && !y && w >= panic.W && h >= panic.H), `${name}: black doesn't cover the frame`);
  fills = [];
  panic.frame(c, 1, true, 1);
  want(Math.max(...fills.filter(([col]) => col === "#6b7194").map(([, x, , w]) => x + w)) >= panic.W - 16, `${name}: the floor stops short of the edge`);
  fills = [];
  panic.wash(c, panic.MELT + 0.3, panic.MELT + 0.3, live);
  want(Math.max(...fills.filter(([col]) => col === "#4a2c17").map(([, x, , w]) => x + w)) >= vw - 2, `${name}: the wash stops short of the edge`);
  boot(1.6, live);
}

/* Coffee Panic on phones: composed for the size, readable, and it talks about tapping */
for (const [vw, vh] of [[360, 640], [375, 812], [390, 844], [320, 568], [812, 375], [667, 375], [568, 320]]) {
  panic.size(vw, vh, true);
  const fit = vw / panic.W, live = { ...LIVE, vw, vh, fit, bar: 150, me: { x: 20, y: 60, S: 2, bar: 150 } }, name = `phone ${vw}x${vh}`;
  want(22 * fit >= 13, `${name}: text is only ${(22 * fit).toFixed(1)}px`);
  want(168 * fit >= 80, `${name}: Rohan is only ${Math.round(168 * fit)}px tall`);
  want(Math.abs(panic.H * fit - vh) < fit, `${name}: the film is stretched`);
  const words = [];
  for (const t of [0.9, 1.3, 1.7, 2.1, 2.7, 3.0]) {
    texts = []; fills = [];
    panic.frame(c, t, true, t);
    words.push(...texts.map(([s]) => s));
    texts.forEach(([s, x]) => want(x + String(s).length * 10 <= panic.W, `${name}: "${s}" runs off the edge at ${t}s`));
    const floor = fills.find(([col]) => col === "#6b7194")?.[2], bar = fills.find(([col]) => col === "#20275e");
    if (bar) want(bar[2] + bar[4] <= floor - 168 || bar[1] + bar[3] <= panic.W - 280, `${name}: the caffeine bar runs into Rohan`);
    if (t === 2.1) { const ink = fills.filter(([col]) => col === "#f7c437"); if (ink[0]) want(ink[0][1] >= 0 && ink[0][1] + ink[0][3] <= panic.W, `${name}: the throw label runs off the edge`); }
  }
  want(words.includes("Tap to skip"), `${name}: no tap to skip`);
  want(words.includes("TAP TO THROW"), `${name}: no tap to throw`);
  want(!words.some((s) => /key|click/i.test(s)), `${name}: talks about keys or clicks`);
  fills = [];
  panic.wash(c, panic.MELT + 0.3, panic.MELT + 0.3, live);
  want(Math.max(...fills.filter(([col]) => col === "#4a2c17").map(([, x, , w]) => x + w)) >= vw - 2, `${name}: the wash stops short of the edge`);
  fills = [];
  panic.wash(c, panic.END - 0.05, panic.END, live);
  want(fills.length === 0, `${name}: the last frame still paints over the home page`);
  boot(1.6, live);
}
panic.size(1280, 800);

want(bad === 0, `${bad} non-finite drawing values`);
console.log(`One Cut ${cut.LEN.toFixed(2)}s, ${frames} frames at ${FPS} fps`);
console.log("stamps: " + STAMPS.map((s) => `${s} ${(seen[s] / FPS).toFixed(2)}s`).join(", "));
console.log("segments: " + cut.SEGS.map((s) => `${s.id}@${s.at.toFixed(2)}`).join(" "));
console.log(`Coffee Panic ${auto.secs.toFixed(1)}s with no click, ${clicked.secs.toFixed(1)}s with one, ${auto.flashes} flash`);
fail.forEach((f) => console.error("FAIL " + f));
process.exit(fail.length ? 1 : 0);
