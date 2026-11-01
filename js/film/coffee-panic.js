// Coffee Panic, the boot film: the BIOS panics, a thrown mug fixes it, coffee washes the screen into the desktop.
import { tone, noise, NOTE, sfx } from "../sound.js";
import { LOGO } from "../px.js";
import { clamp, lerp, seeded, FONT, map, sprite as drawSprite } from "./kit.js";

export const W = 1200, H = 750, END = 5.9, HOLD = 2.1, STILL = 3.04;
export const LABEL = "Animated boot sequence: the BIOS panics because coffee is not detected, a thrown mug fixes it, a caffeine surge launches pixel Rohan into the air, coffee washes the BIOS away to show the desktop, and Rohan slams down on the taskbar.";
// OPEN: the real desktop gets its Welcome window, just before the wash shows it. WAVE: the real Rohan takes over.
export const OPEN = 2.85, MELT = 3.1, SLAM = 3.72, WAVE = 4.85;
const P = 4, FLOOR = 590, SY = FLOOR - 168, HIGH = 24, SX = 620;
const WAIT = 1.3, IMPACT = 2.5, SURGE = 2.62, LAUNCH = 2.98, DROP = 3.42, CATCH = 3.95, CAT_ON = 4.18, SIP = 4.3, LEAVE = 5.3;
const LY = (i) => 118 + i * 28;
const sprite = (c, x, y, o) => drawSprite(c, x, y, o, P);

const MUG = ["EEEEEE..", "RRRRRRRR", "RRRRRR.R", "RRRRRR.R", "RRRRRRRR", "rRRRRr..", ".rrrr..."];
const CAT = ["..K.....K.......", ".KWK...KWK......", ".KWWKKKWWK....K.", ".KWWWWWWWK...KWK", "KWWKWWWKWWK..KWK", "KWPWWKWWWPK..KWK", ".KWWWWWWWK...KWK", "..KWWWWWWKKKKWK.", "..KWWWWWWWWWWWK.", "..KWWWWWWWWWWK..", "..KWK.KWK.KWK...", "..KK..KK..KK...."];
const CAT2 = CAT.map((r, j) => (j > 1 && j < 7 ? r.slice(0, 11) + "." + r.slice(11) : r));
const mug = (c, x, y, s = 3) => map(c, MUG, Math.round(x), Math.round(y), s, { E: "#231a16", R: "#d94d4a", r: "#a93533" });
function spun(c, x, y, a, s = 3) { const m = 4 * s, n = Math.round((10 * s) / 3); c.save(); c.translate(x + m, y + n); c.rotate(a); mug(c, -m, -n, s); c.restore(); }
const slot = (c) => { c.font = FONT(22); return 48 + c.measureText("Coffee ").width; };

/* the BIOS page: POST, then the panic, then the surge */
const LINES = [
  ["CPU: ", "8-core browser engine", "0.3 MHz, one core crying"],
  ["Memory Test: ", "16,777,216 KB OK", "640 KB, should be enough"],
  ["Detecting drive C: ", "PIXELOS", "WHERE DID IT GO"],
  ["Detecting drive D: ", "PROJECTS", "ON FIRE"],
  ["Display: 1920x1080, ", "16 colours", "2 colours, both sad"],
  ["Sound: ", "synth ready", "screaming"],
  ["Rohan ", "found, coding", "found, asleep"],
];
const BAD = (i) => 1.12 + (6 - i) * 0.055, FIX = (i) => SURGE + i * 0.05;
const SPLATS = (() => { const r = seeded(17), a = []; for (let i = 0; i < 18; i++) a.push({ x: (r() - 0.3) * 460, y: (r() - 0.45) * 190, s: 8 + Math.floor(r() * 3) * 8, drip: 20 + r() * 150 }); return a; })();
const DROPS = (() => { const r = seeded(29), a = []; for (let i = 0; i < 46; i++) a.push({ vx: (r() - 0.3) * 760, vy: -120 - r() * 520, s: 4 + Math.floor(r() * 2) * 4 }); return a; })();
const STREAKS = (() => { const r = seeded(41), a = []; for (let i = 0; i < 16; i++) a.push({ y: Math.floor(r() * 150) * 4, v: 1400 + r() * 1800, w: 120 + r() * 320, o: r() * W }); return a; })();
function splats(c, t) {
  const d = t - IMPACT - 0.08;
  if (d < 0) return;
  const sx = slot(c), sy = LY(7) - 10, out = clamp(d / 0.08);
  SPLATS.forEach((s) => {
    const x = Math.round((sx + 40 + s.x * out) / 4) * 4, y = Math.round((sy + s.y * out) / 4) * 4, drip = Math.round(Math.min(s.drip, d * s.drip * 1.7) / 4) * 4;
    c.fillStyle = "#4a2c17"; c.fillRect(x, y, s.s, s.s); c.fillRect(x + (s.s >> 1) - 2, y, 4, s.s + drip);
    c.fillStyle = "#7a4a27"; c.fillRect(x, y, s.s, 4);
  });
}
function bios(c, t, w, snap) {
  c.fillStyle = "#000"; c.fillRect(0, 0, W, H);
  const panic = t >= 1.12 && t < IMPACT, tint = panic ? clamp((t - 1.12) / 0.3) * 0.16 : 0;
  c.font = FONT(22); c.textBaseline = "alphabetic";
  const txt = (s, x, y, col) => { c.fillStyle = col; c.fillText(s, x, y); return x + c.measureText(s).width; };
  txt("PixelBIOS (C) 2026 Rohan Ahire", 48, 56, "#fff");
  txt("Release 1.07, built for the web", 48, 84, "#6b7194");
  map(c, LOGO, W - 110, 32, 5, { K: "#6f8cff", W: "#fff" });
  LINES.forEach((l, i) => {
    if (t < 0.08 + i * 0.1) return;
    const bad = t >= BAD(i) && t < FIX(i), jx = bad ? Math.round(Math.sin(w * 37 + i * 2.1) * 3) : 0, jy = bad ? Math.round(Math.cos(w * 29 + i) * 2) : 0;
    const x = txt(l[0], 48 + jx, LY(i) + jy, "#c9cde0");
    if (bad) txt(l[2], x, LY(i) + jy, "#ff6a63");
    else if (i === 0 && t >= SURGE) { const v = clamp((t - SURGE) / 0.42); txt(Math.round(33 + 9966 * v * v).toLocaleString("en-US") + " MHz", x, LY(0), "#f7c437"); }
    else if (i === 1 && t < 0.48) txt(Math.round(16777216 * clamp((t - 0.18) / 0.3)).toLocaleString("en-US") + " KB", x, LY(1), "#c9cde0");
    else txt(l[1], x, LY(i), "#3fd16b");
  });
  if (t >= 0.85) {
    const x = txt("Coffee ", 48, LY(7), "#c9cde0");
    if (t < 1.05) txt(".".repeat(1 + Math.floor((t - 0.85) / 0.05)), x, LY(7), "#c9cde0");
    else if (t < IMPACT) { const jx = Math.round(Math.sin(w * 53) * 3); txt("NOT DETECTED", x + jx, LY(7), "#ff6a63"); }
    else {
      const d = Math.max(0, t - IMPACT - 0.08), r = seeded(11);
      if (d < 0.7) { let cx = x; for (const ch of "NOT DETECTED") { const vx = (r() - 0.3) * 620, vy = -220 - r() * 420; txt(ch, cx + vx * d, LY(7) + vy * d + 1500 * d * d, "#ff6a63"); cx += c.measureText(ch).width; } }
      if (!snap) mug(c, x, LY(7) - 20);
      txt("DETECTED", x + 34, LY(7), "#3fd16b");
    }
  }
  if (t >= 1.5 && t < IMPACT + 0.08 && (t === HOLD ? Math.floor(w * 3) % 2 === 0 : true)) { c.fillStyle = "#d94d4a"; c.fillRect(44, LY(9) - 24, 500, 34); txt("BOOT HALTED. Insert coffee to continue.", 56, LY(9), "#fff"); }
  if (t >= SURGE) {
    const v = clamp((t - SURGE) / 0.42), hot = ["#f7c437", "#f39c3d", "#ff6a63", "#f39c3d"][Math.floor(t * 12) % 4];
    c.font = FONT(58, true); txt("CAFFEINE " + Math.round(9000 * v) + "%", 48, LY(10) + 8, hot);
    c.fillStyle = "#20275e"; c.fillRect(48, LY(10) + 24, 520, 24);
    c.fillStyle = hot; c.fillRect(48, LY(10) + 24, 520 * v, 24);
    c.font = FONT(22);
    c.fillStyle = "rgba(111,140,255,.55)";
    STREAKS.forEach((s) => { const x = (s.o + (t - SURGE) * s.v) % (W + s.w) - s.w; c.fillRect(x, s.y, s.w, 4); });
  }
  c.fillStyle = "#6b7194"; for (let x = 0; x < W; x += 16) c.fillRect(x, FLOOR, 10, 4);
  txt("Press any key to skip", 48, H - 28, "#6b7194");
  splats(c, t);
  if (tint) { c.fillStyle = "rgba(170,20,20," + tint + ")"; c.fillRect(0, 0, W, H); }
  const d = t - IMPACT - 0.08;
  if (d >= 0 && d < 0.8) { const sx = slot(c), sy = LY(7) - 10; c.fillStyle = "#4a2c17"; DROPS.forEach((p) => c.fillRect(sx + 40 + p.vx * d, sy + p.vy * d + 1100 * d * d, p.s, p.s)); }
}

/* the landing, as numbers: the player applies them to the real taskbar, window and icons */
export const dipAt = (t) => { const d = t - SLAM; return d > 0 && d < 0.5 ? Math.round(14 * Math.exp(-d * 8) * Math.cos(d * 26)) : 0; };
export const hop = (t, dist, h) => { const p = (t - SLAM - dist / 2400) / 0.3; return p > 0 && p < 1 ? Math.round(Math.sin(p * Math.PI) * h) : 0; };

/* Doom's wipe, poured: each column of the BIOS falls on its own beat with coffee on top of it, and what's left behind is the real desktop */
const COLS = 75;
const LAG = (() => { const r = seeded(4), a = [Math.floor(r() * 14)]; for (let i = 1; i < COLS; i++) a[i] = Math.max(0, Math.min(14, a[i - 1] + Math.floor(r() * 3) - 1)); return a; })();
let biosLayer = null, shot = null;
export const resetLayers = () => { biosLayer = shot = null; };
const layer = (w, h) => { const l = document.createElement("canvas"); l.width = w; l.height = h; return l; };
const scanlines = (c) => { c.fillStyle = "rgba(0,0,0,.16)"; for (let y = 0; y < H; y += 4) c.fillRect(0, y, W, 2); };
// the BIOS as the screen shows it: letterboxed on black, without the mug that's about to fly
function biosShot(d) {
  if (shot && shot.width === d.vw && shot.height === d.vh) return shot;
  if (!biosLayer) { biosLayer = layer(W, H); const b = biosLayer.getContext("2d"); bios(b, MELT - 0.01, MELT - 0.01, true); scanlines(b); }
  shot = layer(d.vw, d.vh);
  const s = shot.getContext("2d");
  s.imageSmoothingEnabled = false;
  s.fillStyle = "#000"; s.fillRect(0, 0, d.vw, d.vh);
  s.drawImage(biosLayer, d.ox, d.oy, W * d.fit, H * d.fit);
  return shot;
}
function pour(c, t, d) {
  if (t > MELT + 0.8) return;
  const from = biosShot(d), cw = d.vw / COLS, far = d.vh + 110;
  for (let i = 0; i < COLS; i++) {
    const p = Math.max(0, (t - MELT - LAG[i] * 0.012) / 0.52), dy = Math.round(p * p * far);
    if (dy >= far) continue;
    const x = Math.round(i * cw), w = Math.round((i + 1) * cw) - x;
    if (dy < d.vh) c.drawImage(from, x, 0, w, d.vh, x, dy, w, d.vh);
    if (dy > 0) {
      const b = 36 + (LAG[i] % 5) * 12;
      c.fillStyle = "#4a2c17"; c.fillRect(x, dy - b, w, b);
      c.fillStyle = "#7a4a27"; c.fillRect(x, dy - b, w, 8);
    }
  }
}

function dust(c, x, y, d, n) {
  c.fillStyle = "#eef0f8";
  for (let i = 0; i < n; i++) { const o = d * (30 + i * 26); c.fillRect(x - 40 - o, y - i * 5 - d * 12, 8, 8); c.fillRect(x + 40 + o, y - i * 5 - d * 12, 8, 8); }
}
function steam(c, x, y, w) {
  c.fillStyle = "rgba(255,255,255,.75)";
  for (let i = 0; i < 3; i++) { const p = (w * 0.9 + i / 3) % 1; c.fillRect(Math.round(x + Math.sin(p * 6 + i) * 6), Math.round(y - p * 34), 4, 4); }
}
function hero(c, t, w, gone) {
  if (t < 1.5) return;
  const air = Math.floor(t * 16);
  if (t < 2.1) {
    const run = t < 1.98, x = run ? lerp(-150, SX + 30, (t - 1.5) / 0.48) : lerp(SX + 30, SX, (t - 1.98) / 0.12), f = Math.floor(t * 18);
    sprite(c, x, SY - (run ? (f % 2) * 5 : 0), { pose: "point", lift: run ? [1, 0, 2, 0][f % 4] : 0, look: 1, mouth: run ? 3 : 0 });
    mug(c, x + 132, SY + 66);
    if (!run) dust(c, x + 72, FLOOR - 4, (t - 1.98) / 0.12, 3);
  } else if (t <= HOLD) {
    const bob = Math.round(Math.sin(w * 8) * 3);
    sprite(c, SX, SY, { pose: "pointUp", look: -1, lookY: -1 });
    mug(c, SX + 104, SY + 12 + bob);
    if (Math.floor(w * 3) % 2 === 0) { c.font = FONT(26, true); const s = "CLICK TO THROW", tw = c.measureText(s).width; c.fillStyle = "#f7c437"; c.fillRect(SX - 20, SY - 64, tw + 32, 44); c.fillStyle = "#10132e"; c.fillText(s, SX - 4, SY - 32); }
  } else if (t < IMPACT) sprite(c, SX, SY, { pose: "pointUp", look: -1, lookY: -1, mouth: 3 });
  else if (t < SURGE) sprite(c, SX, SY, { pose: "thumbs", mouth: 2 });
  else if (t < LAUNCH) sprite(c, SX + (Math.floor(w * 40) % 2 ? 4 : -4), SY, { pose: "startle", mouth: 2 });
  else if (t < 3.18) {
    const p = (t - LAUNCH) / 0.2, sy = lerp(SY, HIGH, 1 - Math.pow(1 - p, 3));
    c.fillStyle = "#f7c437"; [20, 52, 84, 116].forEach((x, i) => c.fillRect(SX + x, sy + 170, 8, 40 + (i % 2) * 40));
    sprite(c, SX, sy, { pose: "flail", f: air, lift: air % 2 ? 2 : 1, mouth: 2 });
  } else if (gone) sprite(c, SX, lerp(HIGH, -240, clamp((t - 3.18) / 0.2)), { pose: "flail", f: air, lift: 2, mouth: 2 });
  else if (t < 3.3) sprite(c, SX, HIGH, { pose: "flail", f: air, lift: 0, mouth: 2, lookY: 1 });
  else sprite(c, SX, HIGH, { pose: "stand", mouth: 3 });
}
/* from the drop on he's on the live screen: d.me says where the real Rohan stands and how big he is, and the film lands him there */
const behind = (c, d, draw) => { c.save(); c.beginPath(); c.rect(0, 0, d.vw, d.bar); c.clip(); draw(); c.restore(); };
function landing(c, t, w, d) {
  const { x, y: rest, S: p } = d.me, u = p / P, s = Math.max(1, Math.round(p * 0.75)), y = rest + dipAt(t), turn = Math.floor(t * 18) * (Math.PI / 2);
  const me = (o, q = p, ax = x, ay = y) => drawSprite(c, ax, ay, o, q);
  if (t < CATCH) { const q = clamp((t - MELT) / (CATCH - MELT)); spun(c, lerp(d.ox + slot(c) * d.fit, x + 132 * u, q), lerp(d.oy + (LY(7) - 20) * d.fit, rest + 66 * u, q * q) - Math.sin(q * Math.PI) * 70, turn, s); }
  if (t < DROP) return;
  const air = Math.floor(t * 16);
  if (t < SLAM) { const e = ((t - DROP) / (SLAM - DROP)) ** 2; me({ pose: "flail", f: air, lift: air % 2 ? 2 : 1, mouth: 3 }, Math.round(lerp(P * d.fit, p, e)), lerp(d.ox + SX * d.fit, x, e), lerp(d.oy + HIGH * d.fit, rest, e)); }
  else if (t < SLAM + 0.16) { me({ pose: "stand", mouth: 3 }); dust(c, x + 18 * p, d.bar - 6, (t - SLAM) / 0.16, 6); }
  else if (t < CATCH) me({ pose: "point" });
  else if (t < SIP) { me({ pose: "point", mouth: t >= CAT_ON && t < CAT_ON + 0.1 ? 3 : 2 }); mug(c, x + 132 * u, y + 66 * u, s); steam(c, x + 144 * u, y + 62 * u, w); }
  else if (t < WAVE) { me({ pose: "sipUp", shut: 1 }); mug(c, x + 68 * u, y + 72 * u, s); steam(c, x + 80 * u, y + 68 * u, w); }
  else if (t < WAVE + 0.45) { const q = (t - WAVE) / 0.45; behind(c, d, () => spun(c, x + 68 * u + q * 70, lerp(rest + 72 * u, d.bar + 30, q * q) - Math.sin(q * Math.PI) * 60, turn, s)); }
  // there's no cat on the live desktop, so it hops down behind the taskbar before the film ends
  if (t >= CATCH + 0.03 && t < LEAVE + 0.45) {
    const q = clamp((t - CATCH - 0.03) / (CAT_ON - CATCH - 0.03)), e = t - CAT_ON, boing = e > 0 && e < 0.24 ? Math.round(Math.sin((e / 0.24) * Math.PI) * 18 * u) : 0;
    const head = rest + 18 * u - CAT.length * s + dipAt(t), cx = x + 18 * p - 8 * s, off = clamp((t - LEAVE) / 0.45);
    behind(c, d, () => map(c, e > 0.24 && Math.floor(w * 3) % 2 ? CAT2 : CAT, Math.round(cx - off * 120), Math.round(lerp(lerp(-60, head, q * q), d.bar + 20, off * off) - Math.sin(off * Math.PI) * 70) - boing, s, { K: "#10132e", W: "#eef0f8", P: "#ff8fb0" }));
    if (e > 0 && e < 0.36) { c.fillStyle = "#f7c437"; for (let i = 0; i < 8; i++) { const a = (i * Math.PI) / 4, r = (34 + e * 360) * u, b = i % 2 ? 4 : 8; c.fillRect(Math.round(x + 18 * p + Math.cos(a) * r), Math.round(rest + 4 * p + Math.sin(a) * r * 0.6), b, b); } }
  }
}
function powerOn(c, t) {
  const p = clamp(t / 0.24), open = p < 0.4 ? 0 : (p - 0.4) / 0.6, h = Math.round(open * open * H), lw = Math.round(clamp(p / 0.4) * W);
  c.fillStyle = "#000"; c.fillRect(0, 0, W, (H - h) / 2); c.fillRect(0, (H + h) / 2, W, (H - h) / 2);
  if (p < 0.85) { c.fillStyle = "#eef2ff"; c.fillRect((W - lw) / 2, H / 2 - 2, lw, 4); }
}

// the film's own canvas: the BIOS, then clear, with Rohan still at BIOS size until he drops. gone: no Rohan on the desktop to land on
export function frame(c, t, crt, w, gone) {
  w = w ?? t;
  if (t >= MELT) { c.clearRect(0, 0, W, H); if (t < DROP) hero(c, t, w, gone); return; }
  c.save(); c.imageSmoothingEnabled = false;
  c.fillStyle = "#000"; c.fillRect(0, 0, W, H);
  const hit = t - IMPACT;
  let kick = t >= 1.05 && t < 1.25 ? 6 : hit >= 0 && hit < 0.34 ? 16 * (1 - hit / 0.34) : t >= SURGE ? 3 : 0;
  if (kick) c.translate(Math.round(Math.floor(w * 60) % 2 ? kick : -kick), Math.round(Math.floor(w * 40) % 2 ? kick / 2 : -kick / 2));
  const sx = slot(c);
  if (t > 2.24 && t < IMPACT) { const z = 1 + 0.5 * clamp((t - 2.24) / 0.2); c.translate(sx + 60, LY(7)); c.scale(z, z); c.translate(-sx - 60, -LY(7)); }
  bios(c, t, w, false);
  if (t > HOLD && t < IMPACT) {
    const at = (q) => { const x = clamp(q), p = 1 - Math.pow(1 - x, 2.2); return [lerp(SX + 104, sx, p), lerp(SY + 12, LY(7) - 20, p) - Math.sin(x * Math.PI) * 150]; }, q = (t - HOLD) / (IMPACT - HOLD);
    c.fillStyle = "#4a2c17"; for (let i = 1; i <= 7; i++) { const [x, y] = at(q - i * 0.05); c.fillRect(x + 8 + i * 3, y + 4 + (i % 3) * 6, 6, 6); }
    const [x, y] = at(q); spun(c, x, y, Math.floor(t * 26) * (Math.PI / 2));
  }
  hero(c, t, w, gone);
  if (hit >= 0 && hit < 0.16) { c.fillStyle = "rgba(255,255,255," + (hit < 0.08 ? 0.95 : 0.95 * (1 - (hit - 0.08) / 0.08)) + ")"; c.fillRect(-30, -30, W + 60, H + 60); }
  c.restore();
  if (t < 0.24) powerOn(c, t);
  if (crt) scanlines(c);
}
// the screen-sized canvas over the desktop, clear wherever the wash has passed. d comes from the live page; once Rohan has taken over and the cat has gone it paints nothing
export function wash(c, t, w, d) {
  c.save(); c.imageSmoothingEnabled = false;
  c.clearRect(0, 0, d.vw, d.vh);
  pour(c, t, d);
  if (d.me) landing(c, t, w, d);
  c.restore();
}

/* the soundtrack, from the site's own synth in js/sound.js */
export const CUES = [
  [0.01, () => { noise(0.08, { f: 500, vol: 0.12 }); tone(7000, 0.24, { type: "sine", vol: 0.012 }); }],
  ...[0.08, 0.18, 0.28, 0.38, 0.48, 0.58, 0.68].map((at) => [at, () => tone(1800, 0.015, { vol: 0.04 })]),
  [0.88, () => tone(880, 0.04, { vol: 0.05 })], [0.96, () => tone(880, 0.04, { vol: 0.05 })],
  [1.05, () => { tone(196, 0.13, { vol: 0.1 }); tone(185, 0.18, { vol: 0.1, at: 0.15 }); }],
  [1.3, () => [0, 0.09, 0.18].forEach((at) => tone(330, 0.05, { vol: 0.06, at }))],
  [1.5, () => [0, 0.08, 0.16, 0.24, 0.32, 0.4].forEach((at) => tone(120, 0.05, { to: 60, type: "sine", vol: 0.14, at }))],
  [1.98, () => noise(0.14, { f: 2600, fTo: 700, vol: 0.09, filter: "bandpass" })],
  [HOLD, () => tone(260, 0.12, { to: 620, vol: 0.07 })],
  [HOLD + 0.01, () => tone(900, 0.4, { to: 240, slide: 0.4, vol: 0.06, type: "triangle" })],
  [IMPACT, () => { tone(110, 0.1, { to: 45, vol: 0.22, type: "sine" }); noise(0.3, { f: 1600, fTo: 200, vol: 0.3 }); tone(NOTE(81), 0.7, { type: "sine", vol: 0.16, at: 0.06 }); tone(NOTE(88), 0.5, { type: "sine", vol: 0.06, at: 0.06 }); }],
  [SURGE, () => { tone(180, 0.46, { to: 2600, vol: 0.05, type: "sawtooth" }); [60, 64, 67, 72, 76, 79, 84, 88].forEach((n, i) => tone(NOTE(n), 0.05, { vol: 0.04, at: i * 0.05 })); }],
  [LAUNCH, () => tone(300, 0.24, { to: 1500, vol: 0.07, type: "triangle" })],
  [MELT, () => noise(0.7, { f: 500, fTo: 1500, vol: 0.2, filter: "bandpass" })],
  [DROP, () => tone(900, 0.3, { to: 120, slide: 0.3, vol: 0.06, type: "triangle" })],
  [SLAM, () => {
    noise(0.7, { f: 900, fTo: 60, vol: 0.5 }); tone(90, 0.5, { to: 30, type: "sine", vol: 0.3 });
    [60, 64, 67, 72, 76].forEach((n, i) => tone(NOTE(n), 1.3 - i * 0.12, { type: "triangle", vol: 0.13, at: 0.12 + i * 0.11, a: 0.02 }));
    [48, 55].forEach((n) => tone(NOTE(n), 1.8, { type: "sine", vol: 0.1, at: 0.55, a: 0.25 }));
  }],
  [CATCH, () => tone(NOTE(84), 0.25, { type: "sine", vol: 0.1 })],
  [CAT_ON, () => {
    tone(110, 0.1, { to: 45, vol: 0.22, type: "sine" }); noise(0.08, { f: 300, vol: 0.16 });
    [0.12, 0.2, 0.28].forEach((at, i) => tone(1800 - i * 200, 0.05, { type: "sine", vol: 0.05, at }));
  }],
  [CAT_ON + 0.1, () => sfx("meow")],
  [SIP, () => noise(0.3, { f: 900, fTo: 2200, vol: 0.06, filter: "bandpass" })],
  [WAVE + 0.4, () => noise(0.09, { f: 2600, vol: 0.05 })],
];

/* the film's clock: it waits at the throw until the visitor clicks, or for WAIT seconds */
export const startClock = () => ({ t: 0, w: 0, held: 0, thrown: false });
export const canThrow = (s) => s.t >= 1.5 && s.t <= HOLD;
export function advance(s, dt) {
  s.w += dt;
  if (s.t === HOLD && !s.thrown) { s.held += dt; if (s.held >= WAIT) s.thrown = true; return; }
  const next = s.t + dt;
  s.t = s.t < HOLD && next >= HOLD && !s.thrown ? HOLD : next;
}
