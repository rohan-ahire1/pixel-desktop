// Power: the boot film, the splash, shut down / restart / stand by, and the screen savers.
import { h, $, bus, settings, session, reduce, sleep, small } from "./core.js";
import { px, drawMap, disc, LOGO, PAL16, K } from "./px.js";
import { list as winList } from "./wm.js";
import { sfx } from "./sound.js";
import { drawMe, GW, GH } from "./me-sprite.js";
import { meDock, meLand } from "./me.js";

/* ---------- screen savers ---------- */
export const SAVERS = [
  { id: "night", name: "Late Night" },
  { id: "cats", name: "Flying Cats" },
  { id: "starfield", name: "Starfield" },
  { id: "pipes", name: "Pipes" },
];
const CAT = [
  "..K.....K.......",
  ".KWK...KWK......",
  ".KWWKKKWWK....K.",
  ".KWWWWWWWK...KWK",
  "KWWKWWWKWWK..KWK",
  "KWPWWKWWWPK..KWK",
  ".KWWWWWWWK...KWK",
  "..KWWWWWWKKKKWK.",
  "..KWWWWWWWWWWWK.",
  "..KWWWWWWWWWWK..",
  "..KWK.KWK.KWK...",
  "..KK..KK..KK....",
];
const CAT_PAL = { K, W: "#eef0f8", P: "#ff8fb0" };
const WING_UP = ["......K.K", ".....KGK.", "....KGGK.", "...KGGK..", "..KGGK..."];
const WING_DN = ["..KGGK...", "...KGGK..", "....KGGGK", ".....KKK."];
const FISHY = ["..KK..K", ".KBBK.K", "KBKBBKK", ".KBBK.K", "..KK..K"];

export function saverScene(id, cv, small = false) {
  const zoom = id === "night" ? 4 : 3; // late night is a close-up scene, so its pixels are chunkier
  const W = small ? 190 : Math.max(160, Math.ceil(innerWidth / zoom)), H = small ? 120 : Math.max(120, Math.ceil(innerHeight / zoom));
  cv.width = W; cv.height = H;
  const c = cv.getContext("2d");
  c.fillStyle = "#000"; c.fillRect(0, 0, W, H);
  let last = null;
  const dt = (t) => { const d = last == null ? 0.08 : Math.min(0.25, t - last); last = t; return d; };

  if (id === "starfield") {
    const stars = Array.from({ length: small ? 70 : 220 }, () => ({ x: Math.random() * 2 - 1, y: Math.random() * 2 - 1, z: Math.random() }));
    return { draw(t) {
      const d = dt(t);
      c.fillStyle = "#000"; c.fillRect(0, 0, W, H);
      for (const s of stars) {
        s.z -= d * 0.32;
        if (s.z <= 0.02) { s.x = Math.random() * 2 - 1; s.y = Math.random() * 2 - 1; s.z = 1; }
        const sx = Math.round(W / 2 + (s.x / s.z) * W * 0.25), sy = Math.round(H / 2 + (s.y / s.z) * W * 0.25);
        if (sx < 0 || sy < 0 || sx >= W || sy >= H) { s.z = 0; continue; }
        const b = 1 - s.z;
        px(c, sx, sy, b > 0.75 ? "#ffffff" : b > 0.45 ? "#9aa3d8" : "#555a7a", b > 0.85 ? 2 : 1, b > 0.85 ? 2 : 1);
      }
    } };
  }
  if (id === "pipes") {
    const G = 6, cols = Math.floor(W / G), rows = Math.floor(H / G);
    const colors = [PAL16[4], PAL16[6], "#d9534f", "#f7c437", PAL16[5], "#b98ae0"];
    let pipes = [], segs = 0, acc = 0;
    const used = new Set();
    const spawn = () => {
      const p = { x: (Math.random() * cols) | 0, y: (Math.random() * rows) | 0, d: (Math.random() * 4) | 0, c: colors[pipes.length % colors.length] };
      pipes.push(p); joint(p);
    };
    const shade = (hex, k) => { const n = parseInt(hex.slice(1), 16); const f = (v) => Math.max(0, Math.min(255, Math.round(v * k))); return `rgb(${f(n >> 16 & 255)},${f(n >> 8 & 255)},${f(n & 255)})`; };
    const joint = (p) => { disc(c, p.x * G + G / 2, p.y * G + G / 2, 3, [p.c, shade(p.c, 1.5), shade(p.c, 0.55)]); };
    const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];
    const reset = () => { c.fillStyle = "#000"; c.fillRect(0, 0, W, H); pipes = []; segs = 0; used.clear(); spawn(); };
    reset();
    const step = () => {
      for (const p of pipes) {
        if (Math.random() < 0.22) { p.d = (p.d + (Math.random() < 0.5 ? 1 : 3)) % 4; joint(p); }
        let [dx, dy] = DIRS[p.d], nx = p.x + dx, ny = p.y + dy;
        if (nx < 0 || ny < 0 || nx >= cols || ny >= rows || used.has(nx + "," + ny)) {
          const ok = [0, 1, 2, 3].filter((d) => { const [a, b] = DIRS[d], x = p.x + a, y = p.y + b; return x >= 0 && y >= 0 && x < cols && y < rows && !used.has(x + "," + y); });
          if (!ok.length) { p.dead = true; continue; }
          p.d = ok[(Math.random() * ok.length) | 0]; joint(p); [dx, dy] = DIRS[p.d]; nx = p.x + dx; ny = p.y + dy;
        }
        const x0 = Math.min(p.x, nx) * G + G / 2, y0 = Math.min(p.y, ny) * G + G / 2;
        if (dx) { c.fillStyle = shade(p.c, 0.55); c.fillRect(x0, y0 - 2, G + 1, 5); c.fillStyle = p.c; c.fillRect(x0, y0 - 2, G + 1, 3); c.fillStyle = shade(p.c, 1.5); c.fillRect(x0, y0 - 1, G + 1, 1); }
        else { c.fillStyle = shade(p.c, 0.55); c.fillRect(x0 - 2, y0, 5, G + 1); c.fillStyle = p.c; c.fillRect(x0 - 2, y0, 3, G + 1); c.fillStyle = shade(p.c, 1.5); c.fillRect(x0 - 1, y0, 1, G + 1); }
        used.add(nx + "," + ny); p.x = nx; p.y = ny; segs++;
      }
      pipes = pipes.filter((p) => !p.dead);
      if (pipes.length < 3 && Math.random() < 0.08) spawn();
      if (!pipes.length) spawn();
      if (segs > cols * rows * 0.55) reset();
    };
    return { draw(t) { acc += dt(t); while (acc > 0.06) { acc -= 0.06; step(); } } };
  }
  if (id === "night") return nightScene(c, W, H, dt);
  // flying cats (and the odd fish), drifting down-left like a certain classic
  const stars = Array.from({ length: Math.round(W * H / 500) }, () => ({ x: Math.random() * W, y: Math.random() * H, p: Math.random() * 6 }));
  const n = small ? 5 : Math.max(7, Math.round(W * H / 4200));
  const flock = Array.from({ length: n }, () => ({ x: Math.random() * W * 1.4, y: Math.random() * H * 1.2 - H * 0.3, sp: 14 + Math.random() * 14, ph: Math.random() * 6, fish: Math.random() < 0.2 }));
  return { draw(t) {
    const d = dt(t);
    c.fillStyle = "#060a2a"; c.fillRect(0, 0, W, H);
    for (const s of stars) if (Math.sin(t * 2 + s.p) > -0.6) px(c, s.x | 0, s.y | 0, Math.sin(t * 3 + s.p) > 0.7 ? "#ffffff" : "#555a7a");
    flock.sort((a, b) => a.sp - b.sp);
    for (const f of flock) {
      f.x -= f.sp * d; f.y += f.sp * d * 0.5;
      if (f.x < -24 || f.y > H + 16) { if (Math.random() < 0.5) { f.x = W + Math.random() * 40; f.y = Math.random() * H - 20; } else { f.x = Math.random() * W + 30; f.y = -16 - Math.random() * 30; } f.fish = Math.random() < 0.2; }
      const x = Math.round(f.x), y = Math.round(f.y);
      if (f.fish) { drawMap(c, FISHY, x, y, { K, B: "#8fb3ff" }); continue; }
      drawMap(c, CAT, x, y, CAT_PAL);
      const up = Math.floor(t * 5 + f.ph) % 2;
      drawMap(c, up ? WING_UP : WING_DN, x + 6, up ? y - 3 : y + 4, { K, G: "#b9c6f5" });
    }
  } };
}

// late night: me on a floor cushion by a big window, coding over the city, sipping, dozing off, jolting awake
const ZED = ["KKKK", "..K.", ".K..", "KKKK"];
const BANG = ["K", "K", "K", ".", "K"];
const LOOP = 40; // seconds: code 0-18, sip 18-22, sleepy 22-26, nap 26-35, wake 35-36.2, code again
const CODE = [[3, 5, 6], [2, 4, 7, 3], [2, 2, 6, 4], [3, 8], [2, 5, 3, 5], [1, 3], [2, 6, 4], [3, 4, 5, 2], [1, 2]]; // [indent, token lengths...]
const TOK = ["#b98ae0", "#6f8cff", "#3fd16b", "#f7c437", "#cfe0ff", "#f39a76"];
function nightScene(c, W, H, dt) {
  const rnd = ((s) => () => (s = (s * 16807) % 2147483647) / 2147483647)(7);
  const floorY = H - Math.max(10, Math.round(H * 0.12));
  const wx0 = Math.round(W * 0.1), wx1 = W - wx0, wy0 = Math.round(H * 0.07), wy1 = Math.round(floorY - H * 0.2);
  const sx = Math.round(W * 0.5 - GW / 2), sy = floorY - GH + 2;

  // the still parts, drawn once: wall, window, skyline, floor, lamp, books
  const bg = document.createElement("canvas"); bg.width = W; bg.height = H;
  const b = bg.getContext("2d");
  px(b, 0, 0, "#141a45", W, H);
  for (let y = 0; y < floorY; y += 2) for (let x = (y >> 1) & 1; x < W; x += 4) px(b, x, y, "#171e4f");
  const sky = ["#060a2a", "#0b1240", "#141c5a", "#20287a"];
  for (let y = wy0; y < wy1; y++) {
    const f = (y - wy0) / (wy1 - wy0) * (sky.length - 1), k = Math.floor(f), r = f - k;
    for (let x = wx0; x < wx1; x++) px(b, x, y, sky[Math.min(sky.length - 1, k + ((x + y) % 4 < r * 4 ? 1 : 0))]);
  }
  disc(b, wx1 - Math.round((wx1 - wx0) * 0.16), wy0 + Math.round((wy1 - wy0) * 0.24), Math.max(4, Math.round(H * 0.045)), ["#f3eccd", "#fffbe8", "#c9c2a4"]);
  const lights = [], stars = [];
  for (let x = wx0; x < wx1;) {
    const bw = 8 + Math.floor(rnd() * 14), bh = Math.round((wy1 - wy0) * (0.18 + rnd() * 0.42)), top = wy1 - bh, col = rnd() < 0.5 ? "#0b1030" : "#0e1440";
    px(b, x, top, col, Math.min(bw, wx1 - x), bh);
    if (rnd() < 0.3) px(b, x + (bw >> 1), top - 4, col, 1, 4);
    for (let yy = top + 3; yy < wy1 - 2; yy += 4) for (let xx = x + 2; xx < Math.min(x + bw - 1, wx1 - 1); xx += 3) lights.push({ x: xx, y: yy, on: rnd() < 0.28 });
    x += bw + (rnd() < 0.3 ? 2 : 0);
  }
  for (let i = 0; i < (wx1 - wx0) * (wy1 - wy0) / 260; i++) stars.push({ x: wx0 + Math.floor(rnd() * (wx1 - wx0)), y: wy0 + Math.floor(rnd() * (wy1 - wy0) * 0.55), p: rnd() * 6 });
  // frame, mullion and sill
  px(b, wx0 - 3, wy0 - 3, K, wx1 - wx0 + 6, 3); px(b, wx0 - 3, wy1, K, wx1 - wx0 + 6, 2); px(b, wx0 - 3, wy0, K, 3, wy1 - wy0); px(b, wx1, wy0, K, 3, wy1 - wy0);
  px(b, Math.round((wx0 + wx1) / 2) - 1, wy0, K, 2, wy1 - wy0); px(b, wx0, Math.round(wy0 + (wy1 - wy0) * 0.45), K, wx1 - wx0, 2);
  px(b, wx0 - 6, wy1 + 2, "#2d356e", wx1 - wx0 + 12, 3); px(b, wx0 - 6, wy1 + 2, "#4b5b82", wx1 - wx0 + 12, 1);
  // floor and rug
  px(b, 0, floorY, "#0e1236", W, H - floorY); px(b, 0, floorY, "#20275e", W, 1);
  for (let x = 0; x < W; x += 9) px(b, x, floorY + 1, "#141a45", 1, H - floorY);
  px(b, sx - 10, floorY - 1, "#3a2766", GW + 20, 4); px(b, sx - 10, floorY + 3, "#24183f", GW + 20, 1);
  // lamp, left
  const lx = Math.round(W * 0.2);
  px(b, lx, floorY - 34, "#33405e", 2, 34); px(b, lx - 4, floorY - 2, "#33405e", 10, 2);
  px(b, lx - 6, floorY - 44, K, 14, 10); px(b, lx - 5, floorY - 43, "#f39c3d", 12, 8); px(b, lx - 5, floorY - 43, "#ffd27a", 12, 2);
  // books and a plant, right
  const bx = Math.round(W * 0.76);
  [["#d94d4a", 12], ["#4169ad", 14], ["#3fae6a", 11], ["#f7c437", 13]].forEach(([col, w], i) => { px(b, bx - (w >> 1), floorY - 4 * (i + 1), K, w, 4); px(b, bx - (w >> 1) + 1, floorY - 4 * (i + 1) + 1, col, w - 2, 2); });
  px(b, bx + 14, floorY - 8, "#a65a4c", 8, 8); px(b, bx + 14, floorY - 8, K, 8, 1);
  [[-3, -14], [0, -18], [3, -15], [6, -12], [-1, -11], [4, -10]].forEach(([dx, dy]) => { px(b, bx + 18 + dx, floorY - 8 + dy, "#2f6f4c", 2, -dy); px(b, bx + 18 + dx, floorY - 8 + dy, "#46a64c", 1, 3); });

  const glow = (cx, cy, r, col, dense) => {
    for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
      const d = Math.hypot(x, y * 1.4) / r;
      if (d > 1 || ((x + y) & 1) || (!dense && d > 0.55 && (x & 1))) continue;
      px(c, cx + x, cy + y, col);
    }
  };
  let shoot = null, nextShoot = 6, last = -1;
  return { draw(t) {
    dt(t);
    const T = t % LOOP;
    c.drawImage(bg, 0, 0);
    for (const s of stars) if (Math.sin(t * 1.7 + s.p) > -0.5) px(c, s.x, s.y, Math.sin(t * 2.3 + s.p) > 0.8 ? "#ffffff" : "#6b7194");
    if (Math.floor(t) !== last) { last = Math.floor(t); for (let i = 0; i < 2; i++) { const l = lights[Math.floor(Math.random() * lights.length)]; if (l) l.on = !l.on; } }
    for (const l of lights) if (l.on) px(c, l.x, l.y, (l.x + l.y) % 5 ? "#f7c437" : "#ffe58a");
    if (!shoot && t > nextShoot) shoot = { x: wx0 + (wx1 - wx0) * (0.3 + Math.random() * 0.6), y: wy0 + 4 + Math.random() * (wy1 - wy0) * 0.25, t };
    if (shoot) {
      const k = (t - shoot.t) * 60, hx = Math.round(shoot.x - k), hy = Math.round(shoot.y + k * 0.45);
      for (let i = 0; i < 8; i++) { const x = hx + i * 2, y = Math.round(hy - i * 0.9); if (x > wx0 && x < wx1 && y > wy0 && y < wy1) px(c, x, y, i < 2 ? "#ffffff" : "#9aa3d8"); }
      if (hx < wx0 || k > 60) { shoot = null; nextShoot = t + 9 + Math.random() * 10; }
    }
    // lamp light and the laptop's glow on the wall
    glow(lx + 1, floorY - 36, 16, "#2a2a5a", false);
    const nap = T >= 26 && T < 35, sip = T >= 18 && T < 22;
    glow(sx + 18, sy + 28, nap ? 15 : 20, "#22307a", !nap);

    let o;
    if (sip) o = { pose: "sip", f: 0, shut: T > 19 && T < 20.2 };
    else if (nap) o = { pose: "nap", lid: 7 };
    else if (T >= 35 && T < 36.2) o = { pose: "laptop", f: 0, lid: 7, mouth: 3 };
    else { const sleepy = T >= 22 && T < 26; o = { pose: "laptop", f: Math.floor(t * (sleepy ? 2 : 6)), lid: 7, lookY: 1, shut: sleepy ? T % 1.3 < 0.4 : t % 5 < 0.14 }; }
    drawMe(c, sx, sy, o);

    // a little editor window over my shoulder, filling with code while I'm awake
    const pw = 46, ph = 32, pxx = Math.min(W - pw - 4, sx + GW + 4), pyy = Math.max(2, sy - 18);
    px(c, pxx + 2, pyy + 2, "rgba(0,0,0,.35)", pw, ph);
    px(c, pxx, pyy, K, pw, ph); px(c, pxx + 1, pyy + 1, "#6f8cff", pw - 2, 3); px(c, pxx + pw - 4, pyy + 1, "#d9534f", 2, 2);
    px(c, pxx + 1, pyy + 4, "#0b0e24", pw - 2, ph - 5);
    const typed = T < 18 ? T * 2.2 : T < 22 ? 40 : T < 26 ? 40 + (T - 22) * 0.8 : 43;
    // each line takes 5.5 units to type; keep the last six on screen
    let ly = pyy + 6;
    const cur = Math.floor(typed / 5.5), first = Math.max(0, cur - 5);
    for (let i = first; i <= cur; i++) {
      const line = CODE[i % CODE.length], p = typed - i * 5.5;
      let x = pxx + 3 + line[0] * 2;
      for (let j = 1; j < line.length && x < pxx + pw - 3; j++) {
        const n = Math.min(line[j], Math.max(0, Math.floor(p - (j - 1) * 1.5)));
        if (n <= 0) break;
        px(c, x, ly, TOK[(i + j) % TOK.length], Math.min(n * 2, pxx + pw - 3 - x), 1);
        x += line[j] * 2 + 2;
      }
      ly += 4;
    }
    if (Math.floor(t * 2) % 2) px(c, pxx + 3, Math.min(pyy + ph - 4, ly), "#ffffff", 2, 2);

    if (sip) for (let i = 0; i < 3; i++) { const k = (t * 0.8 + i / 3) % 1; px(c, sx + 18 + Math.round(Math.sin(t * 3 + i) * 1.5), sy + 22 - Math.round(k * 10), k < 0.6 ? "#9aa3d8" : "#555a7a"); }
    if (nap) for (let i = 0; i < 3; i++) {
      const k = ((T - 26) * 0.45 + i / 3) % 1;
      if (T - 26 < i * 0.8) continue;
      drawMap(c, ZED, sx + 22 + Math.round(k * 10 + Math.sin(t * 2 + i) * 2), sy + 4 - Math.round(k * 18), { K: k < 0.7 ? "#cfe0ff" : "#6b7194" });
    }
    if (T >= 35 && T < 36.2) drawMap(c, BANG, sx + 26, sy - 2, { K: "#f7c437" });
  } };
}

let saverEl = null;
function runSaver(id, preview) {
  if (saverEl || !SAVERS.some((s) => s.id === id)) return;
  const cv = h("canvas", { "aria-hidden": "true" });
  saverEl = h("div", { class: "overlay saver", role: "presentation", tabindex: "-1" }, cv, h("span", { class: "sr" }, "Screen saver. Press any key to return."));
  document.body.append(saverEl);
  const back = document.activeElement;
  const sc = saverScene(id, cv, false);
  let raf, t0 = performance.now(), lastDraw = 0;
  const loop = (now) => { if (now - lastDraw > (reduce ? 200 : 33)) { lastDraw = now; sc.draw((now - t0) / 1000); } raf = requestAnimationFrame(loop); };
  raf = requestAnimationFrame(loop);
  saverEl.focus({ preventScroll: true });
  const born = performance.now();
  let sx = null, sy = null;
  const stop = (e) => {
    if (performance.now() - born < (preview ? 600 : 300)) return;
    if (e.type === "pointermove") { if (sx == null) { sx = e.clientX; sy = e.clientY; return; } if (Math.hypot(e.clientX - sx, e.clientY - sy) < 8) return; }
    if (e.type === "keydown" || e.type === "pointerdown") { e.preventDefault(); e.stopPropagation(); }
    cancelAnimationFrame(raf);
    for (const ev of ["pointermove", "pointerdown", "keydown", "wheel"]) removeEventListener(ev, stop, true);
    saverEl.remove(); saverEl = null; idleAt = performance.now();
    back && back.isConnected && back.focus({ preventScroll: true });
  };
  for (const ev of ["pointermove", "pointerdown", "keydown", "wheel"]) addEventListener(ev, stop, { capture: true });
}
export const previewSaver = (id) => runSaver(id, true);

let idleAt = performance.now();
function initIdle() {
  for (const ev of ["pointermove", "pointerdown", "keydown", "wheel", "touchstart"]) addEventListener(ev, () => (idleAt = performance.now()), { capture: true, passive: true });
  setInterval(() => {
    if (settings.saver === "none" || reduce || document.hidden || saverEl || $(".overlay")) return;
    if (winList().some((w) => w.id === "welcome" && !w.min)) return; // never hide the intro while someone may be reading it
    if (document.fullscreenElement && document.fullscreenElement.tagName === "VIDEO") return;
    if (performance.now() - idleAt > (settings.saverWait || 3) * 60000) runSaver(settings.saver, false);
  }, 4000);
}

/* ---------- boot ---------- */
function logoCanvas(scale) {
  const cv = h("canvas", { class: "px logo", width: "12", height: "14", "aria-hidden": "true", style: { width: 12 * scale + "px", height: 14 * scale + "px" } });
  drawMap(cv.getContext("2d"), LOGO, 1, 1, { K, W: "#ffffff" });
  return cv;
}
function skippable(el) {
  let done, skip = false;
  const p = new Promise((r) => (done = r));
  const go = (e) => { if (e.type === "keydown" && ["Shift", "Control", "Alt", "Meta"].includes(e.key)) return; skip = true; done(); };
  el.addEventListener("pointerdown", go);
  addEventListener("keydown", go, true);
  return { wait: (ms) => Promise.race([sleep(ms), p]), get skipped() { return skip; }, off: () => removeEventListener("keydown", go, true) };
}
async function splash(ov, sk, ms, text = "ROHAN AHIRE · 2026") {
  ov.className = "overlay splash";
  const bar = h("div", { class: "bar", "aria-hidden": "true" }, h("i"), h("i"), h("i"));
  ov.replaceChildren(h("div", {}, logoCanvas(8), h("h1", {}, "Pixel", h("b", {}, "OS")), h("p", {}, text), bar), h("div", { class: "skip" }, "Press any key to skip"));
  ov.setAttribute("aria-label", "PixelOS is starting");
  let x = -48;
  const iv = setInterval(() => { x = x > bar.clientWidth ? -48 : x + 15; bar.firstChild.style.marginLeft = x + "px"; }, 70);
  await sk.wait(ms);
  clearInterval(iv);
}
function overlay() {
  const ov = h("div", { class: "overlay", role: "status", "aria-live": "polite" });
  document.body.append(ov);
  return ov;
}
async function fadeOut(ov) {
  if (!reduce) { ov.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 260, easing: "steps(4, end)", fill: "forwards" }); await sleep(260); }
  ov.remove();
}

// Plays the boot film on the first desktop visit of a session (?boot replays it). Resolves when the desktop is in front.
// The film runs over the real desktop, so open (the Welcome window) is called once, in time for the wash to show it.
export async function boot(open) {
  const replay = new URLSearchParams(location.search).has("boot"), seen = session.get("booted");
  session.set("booted", "1");
  let opened = false, title = null;
  const desk = async () => { if (opened) return; opened = true; await open(); if ($(".win h1")) title?.remove(); };
  if ((seen && !replay) || small()) return desk();
  const ov = overlay();
  ov.classList.add("film"); // black straight away, before the film's code arrives
  title = h("h1", { class: "sr" }, "Rohan Ahire"); // the page's heading until Welcome opens
  ov.append(title);
  import("./apps/welcome.js").catch(() => {}); // so the window is ready when the wash reaches it
  let seamless = false;
  try { seamless = await (await import("./film/player.js")).playBoot(ov, { desk, dock: meDock, land: meLand }); }
  catch (e) { console.error(e); ov.remove(); return desk(); }
  await desk();
  if (seamless) ov.remove(); else await fadeOut(ov);
}

/* ---------- shut down ---------- */
let busy = false;
async function closeAll() {
  for (const w of winList().slice().reverse()) {
    if (w.modal) continue;
    await w.close();
    if (winList().includes(w)) return false; // the user cancelled (unsaved work)
  }
  return true;
}
function trapTab(root) {
  root.addEventListener("keydown", (e) => {
    if (e.key !== "Tab") return;
    const f = [...root.querySelectorAll("button:not([disabled]), input:not([disabled])")].filter((x) => x.offsetParent && !(x.type === "radio" && !x.checked));
    if (!f.length) return;
    const i = f.indexOf(document.activeElement), n = e.shiftKey ? (i <= 0 ? f.length - 1 : i - 1) : (i + 1) % f.length;
    e.preventDefault(); f[n].focus();
  });
}
function askShutdown() {
  return new Promise((resolve) => {
    const back = document.activeElement;
    const opt = (v, label, checked) => {
      const r = h("input", { type: "radio", name: "sd", value: v, id: "sd-" + v, checked });
      return h("label", { for: "sd-" + v }, r, label);
    };
    const opts = h("div", { class: "opts", role: "radiogroup", "aria-label": "What do you want the computer to do?" },
      opt("off", "Shut down the computer", true), opt("restart", "Restart the computer", false), opt("standby", "Stand by", false));
    const finish = (v) => { ov.remove(); document.removeEventListener("keydown", esc, true); if (!v && back?.isConnected) back.focus({ preventScroll: true }); resolve(v); };
    const esc = (e) => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); finish(null); } };
    const ok = h("button", { type: "button", class: "btn def", onclick: () => finish(opts.querySelector("input:checked").value) }, "Yes");
    const ttl = h("span", { class: "ttl", id: "sd-t" }, "Shut Down PixelOS");
    const win = h("section", { class: "win dialog active", role: "alertdialog", "aria-modal": "true", "aria-labelledby": "sd-t" },
      h("div", { class: "tbar" }, h("span", { class: "ticon" }, logoCanvas(1)), ttl),
      h("div", { class: "wbody dlg" },
        h("div", { class: "msg" }, logoCanvas(3), h("div", {}, h("p", { style: { marginTop: 0 } }, "What do you want the computer to do?"), opts)),
        h("div", { class: "btnrow", style: { justifyContent: "center" } }, ok, h("button", { type: "button", class: "btn", onclick: () => finish(null) }, "No"))));
    const ov = h("div", { class: "overlay shade" }, win);
    ov.addEventListener("pointerdown", (e) => { if (e.target === ov) { sfx("ding"); win.classList.remove("flash"); void win.offsetWidth; win.classList.add("flash"); } });
    opts.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); ok.click(); } });
    document.addEventListener("keydown", esc, true);
    trapTab(win);
    document.body.append(ov);
    sfx("ding");
    opts.querySelector("input").focus();
  });
}
async function standby() {
  const ov = h("div", { class: "overlay off", style: { background: "#000" }, tabindex: "-1" },
    h("div", {}, h("div", { class: "led", "aria-hidden": "true", style: { width: "10px", height: "10px", margin: "0 auto 18px", background: "#f5a623", animation: reduce ? "none" : "blink 2s steps(1) infinite" } }),
      h("p", { style: { fontSize: "var(--fs-md)", color: "#6b7194", fontFamily: "var(--ui)" } }, "Stand by. Move the mouse or press a key to wake.")));
  document.body.append(ov);
  ov.focus();
  await sleep(700);
  await new Promise((r) => { const go = (e) => { if (e.type === "keydown") e.preventDefault(); ["pointerdown", "keydown", "pointermove"].forEach((ev) => removeEventListener(ev, go, true)); r(); }; ["pointerdown", "keydown", "pointermove"].forEach((ev) => addEventListener(ev, go, true)); });
  ov.remove();
  sfx("max");
}
async function powerOff(mode, onReady) {
  if (!(await closeAll())) return;
  const ov = overlay();
  ov.className = "overlay off wait";
  ov.replaceChildren(h("div", {}, logoCanvas(6), h("p", { style: { marginTop: "22px" } }, mode === "restart" ? "PixelOS is restarting…" : "PixelOS is shutting down…")));
  sfx("shutdown");
  document.body.classList.add("busy");
  await sleep(reduce ? 400 : 1400);
  document.body.classList.remove("busy");
  if (mode === "off") {
    ov.className = "overlay off";
    const again = h("button", { type: "button", class: "btn", style: { fontFamily: "var(--ui)" } }, "Start PixelOS again");
    ov.replaceChildren(h("div", {}, h("p", {}, "It's now safe to close this tab."), again,
      h("p", { style: { fontSize: "var(--fs-sm)", marginTop: "26px", fontFamily: "var(--ui)", color: "#8a6a2a" } }, "Thanks for visiting. ahirerohan3.14@gmail.com")));
    again.focus();
    await new Promise((r) => again.addEventListener("click", r, { once: true }));
  }
  const sk = skippable(ov);
  await splash(ov, sk, reduce ? 300 : 1500);
  sk.off();
  bus.emit("shell:restart");
  sfx("startup");
  await fadeOut(ov);
  onReady && onReady();
}

export function initPower({ onReady } = {}) {
  initIdle();
  bus.on("shell:shutdown", async (how) => {
    if (busy) return;
    busy = true;
    try {
      const mode = how === "now" ? "off" : how === "restart" ? "restart" : await askShutdown();
      if (mode === "standby") await standby();
      else if (mode) await powerOff(mode, onReady);
    } finally { busy = false; }
  });
}
