// One Cut, the scenes. Each scene takes its own clock in seconds, at the pace it was designed; js/film/one-cut.js decides how fast that clock runs.
import { clamp, lerp, ease, seeded, box, T, map, sprite } from "./kit.js";

export const W = 380, H = 238;
const P = 2, FLOOR = 206, INK = "#10132e", NAVY = "#0e1236", GOLD = "#f7c437", GREEN = "#3fd16b", RED = "#d94d4a", HI = "#6f8cff", PAPER = "#f3f4f9", COFFEE = "#a86a32";
const stage = (c, bg, line) => { box(c, 0, 0, W, H, bg); if (line) for (let x = 0; x < W; x += 12) box(c, x, FLOOR, 8, 2, line); };

/* Rohan keeps the mug from the boot through the whole film */
function me(c, x, y, o) {
  sprite(c, x, y, o, P);
  const up = o.pose === "startle", mx = Math.round(x) + (up ? 6 : 16), my = Math.round(y) + (up ? 18 : 56);
  box(c, mx - 5, my + 1, 6, 8, INK); box(c, mx - 3, my + 3, 3, 4, PAPER);
  box(c, mx - 1, my - 1, 12, 13, INK); box(c, mx, my, 10, 11, PAPER); box(c, mx, my, 10, 3, COFFEE);
}

/* the drop from the boot lands and its ripple draws the radar */
const CX = 264, CY = 118;
const ring = (c, r, col) => { for (let i = 0; i < 72; i++) { const q = (i / 72) * Math.PI * 2; box(c, CX + Math.cos(q) * r, CY + Math.sin(q) * r, 2, 2, col); } };
export function drop(c, t) {
  const land = 0.65, u = t - land, hit = u >= 0;
  box(c, 0, 0, W, H, "#0b0806");
  if (hit) { c.fillStyle = "#071f2c"; c.beginPath(); c.arc(CX, CY, ease(clamp(u / 0.6)) * 320, 0, Math.PI * 2); c.fill(); }
  [33, 66, 100].forEach((r, k) => { const q = ease(clamp((u - k * 0.1) / 0.4)); if (q > 0) ring(c, r * q, q < 1 ? COFFEE : "#1f6f5c"); });
  const g = ease(clamp((u - 0.4) / 0.3));
  if (g > 0) { box(c, CX - 100 * g, CY, 200 * g, 2, "#14503f"); box(c, CX, CY - 100 * g, 2, 200 * g, "#14503f"); }
  if (!hit) { const y = lerp(-14, CY, (t / land) * (t / land)); box(c, CX - 2, y - 10, 4, 6, COFFEE); box(c, CX - 3, y - 4, 6, 6, COFFEE); }
  else if (u < 0.4) for (let i = 0; i < 6; i++) { const q = (i / 6) * Math.PI * 2 + 0.4; box(c, CX + Math.cos(q) * u * 90, CY + Math.sin(q) * u * 60 - 60 * u + 200 * u * u, 4, 4, COFFEE); }
  me(c, 8, FLOOR - 74, { pose: "stand", look: hit ? 1 : 0 });
}

/* Scoutline: the radar sweeps, one lead gets locked */
const BLIPS = [[0.25, 72], [0.5, 40], [0.75, 86], [1, 60], [1.25, 30], [1.45, 76]];
const blip = (at, r) => { const q = at * 4 - Math.PI / 2; return [CX + Math.cos(q) * r, CY + Math.sin(q) * r]; };
const [LX, LY] = blip(1, 60);
export function scoutline(c, t, solo) {
  box(c, 0, 0, W, H, "#071f2c");
  const st = Math.min(t, 1.9), a = st * 4 - Math.PI / 2, lock = t >= 1.9;
  [33, 66, 100].forEach((r) => ring(c, r, "#1f6f5c"));
  box(c, CX - 100, CY, 200, 2, "#14503f"); box(c, CX, CY - 100, 2, 200, "#14503f");
  for (let k = 7; k >= 0; k--) { const q = a - k * 0.08, col = k ? "#1f6f5c" : "#6dffc0"; for (let r = 6; r < 100; r += 6) box(c, CX + Math.cos(q) * r, CY + Math.sin(q) * r, 2, 2, col); }
  BLIPS.forEach(([at, r], i) => {
    if (t < at) return;
    const [x, y] = blip(at, r), top = i === 3;
    box(c, x - 3, y - 3, 6, 6, lock && !top ? "#1f6f5c" : top && t >= 1.6 ? GOLD : "#6dffc0");
    if (top && t >= 1.6) {
      const s = Math.round(lerp(46, 11, clamp((t - 1.6) / 0.3)));
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([u, v]) => { box(c, x + u * s - (u > 0 ? 8 : 0), y + v * s, 8, 2, GOLD); box(c, x + u * s, y + v * s - (v > 0 ? 8 : 0), 2, 8, GOLD); });
      if (lock) { box(c, x - 54, y + 18, 108, 28, GOLD); T(c, "TOP LEAD", x - 44, y + 39, 20, INK, true); }
    }
  });
  if (!solo) me(c, 8, FLOOR - 74, { pose: lock ? "thumbs" : "point", mouth: lock ? 2 : 0, look: 1 });
}

/* an invoice page at any size, so the lead card can grow into one */
function paper(c, x, y, w, h) {
  x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
  box(c, x - 2, y - 2, w + 4, h + 4, INK); box(c, x, y, w, h, PAPER);
  box(c, x + 6, y + 6, Math.max(0, w - 12), 6, "#9aa3d8");
  for (let i = 1; i < 4; i++) box(c, x + 6, y + 8 + (i * h) / 5, Math.max(0, w - 12 - i * 4), 3, "#c9cde0");
  box(c, x + 6, y + h - 12, Math.max(0, w - 12), 6, RED);
}
/* handoff: the TOP LEAD tag fills the screen, then shrinks into the invoice */
export function lead(c, t, p) {
  const x0 = LX - 54, y0 = LY + 18;
  if (p < 0.5) {
    const q = ease(p * 2), x = lerp(x0, 0, q), y = lerp(y0, 0, q), w = lerp(108, W, q), h = lerp(28, H, q);
    scoutline(c, 2.5);
    if (q < 0.6) { box(c, x, y, w, h, GOLD); T(c, "TOP LEAD", x + 10, y + 21 + h * 0.1, 20, INK, true); }
    else paper(c, x, y, w, h);
  } else {
    const q = ease((p - 0.5) * 2);
    recoup(c, 0, true);
    paper(c, lerp(0, 130, q), lerp(0, 156, q), lerp(W, 36, q), lerp(H, 46, q));
  }
}

/* Recoup: the invoice runs, you catch it, PAID lands */
const COINS = (() => { const r = seeded(7), a = []; for (let i = 0; i < 16; i++) a.push({ vx: (r() - 0.5) * 340, vy: -80 - r() * 220 }); return a; })();
export function recoup(c, t, solo) {
  stage(c, NAVY, "#20275e");
  const f = Math.floor(t * 14), p = clamp(t / 1.7), big = clamp((t - 1.7) / 0.12), caught = t >= 1.7;
  const iw = Math.round(lerp(36, 92, big)), ih = Math.round(lerp(46, 118, big)), ix = Math.round(lerp(lerp(130, 300, p), 230, big)), iy = Math.round(lerp(FLOOR - 50 - (f % 2) * 8, 44, big));
  box(c, ix - 2, iy - 2, iw + 4, ih + 4, INK); box(c, ix, iy, iw, ih, PAPER);
  box(c, ix + 6, iy + 6, iw - 12, 6, "#9aa3d8");
  for (let i = 1; i < 4; i++) box(c, ix + 6, iy + 8 + (i * ih) / 5, iw - 12 - i * 4, 3, "#c9cde0");
  if (big < 1) box(c, ix + 6, iy + ih - 12, iw - 12, 6, RED);
  else if (t < 1.95) T(c, "UNPAID", ix + 16, iy + ih - 10, 16, RED, true);
  if (!caught) { box(c, ix + 8, iy + ih, 4, f % 2 ? 6 : 3, INK); box(c, ix + 24, iy + ih, 4, f % 2 ? 3 : 6, INK); }
  if (t >= 1.95) {
    const d = t - 1.95, q = 1 - clamp(d / 0.1), z = 1 + 2 * q * q;
    c.save(); c.translate(ix + 46, iy + 62); c.rotate(-0.18); c.scale(z, z);
    box(c, -46, -20, 92, 4, "#178a4a"); box(c, -46, 16, 92, 4, "#178a4a"); box(c, -46, -20, 4, 40, "#178a4a"); box(c, 42, -20, 4, 40, "#178a4a");
    T(c, "PAID", -32, 11, 30, "#178a4a", true);
    c.restore();
  }
  if (t >= 2) { const d = t - 2; COINS.forEach((m) => { if (d < 1) box(c, ix + 46 + m.vx * d, iy + 60 + m.vy * d + 420 * d * d, 6, 6, GOLD); }); }
  if (solo) return;
  if (caught) me(c, 96, FLOOR - 84, { pose: t >= 1.95 ? "thumbs" : "point", mouth: 2 });
  else me(c, lerp(-70, 96, p), FLOOR - 84 - (f % 2) * 3, { pose: "point", lift: [1, 0, 2, 0][f % 4], look: 1, mouth: 3 });
}

/* handoff: one coin rolls back across the screen and unrolls the array behind it */
export function coin(c, t) {
  const fly = clamp(t / 0.35), roll = ease(clamp((t - 0.35) / 0.8)), x = t < 0.35 ? lerp(276, 366, fly) : lerp(366, 49, roll), y = t < 0.35 ? lerp(106, 195, fly * fly) - Math.sin(fly * Math.PI) * 30 : 195, edge = t < 0.35 ? W : x + 6;
  recoup(c, 2.6 + t, true);
  if (edge < W) { c.save(); c.beginPath(); c.rect(edge, 0, W - edge, H); c.clip(); pointer(c, 0, true); c.restore(); }
  const hop = clamp((t - 0.75) / 0.4);
  me(c, lerp(96, 13, hop), lerp(122, 64, hop) - Math.sin(hop * Math.PI) * 30, hop > 0 ? { pose: "startle", mouth: 3, look: -1 } : { pose: "thumbs", mouth: 2, look: 1 });
  box(c, x - 4, y - 6, 8, 12, GOLD); box(c, x - 6, y - 4, 12, 8, GOLD);
  const a = x * 0.25; box(c, x + Math.cos(a) * 3 - 1, y + Math.sin(a) * 3 - 1, 2, 2, "#fff3b0");
}

/* Pointer: the coin is now the left pointer and you ride it to the answer */
const NUMS = [1, 3, 4, 6, 8, 9, 11, 14], STEPS = [[0, 7], [0, 6], [1, 6], [1, 5], [2, 5]];
export function pointer(c, t, solo, leave) {
  leave = leave || 0;
  if (!leave) stage(c, INK);
  const s = Math.min(4, Math.floor(Math.max(0, t - 0.2) / 0.42)), f = clamp((t - 0.2 - s * 0.42) / 0.14), found = t >= 2.12;
  const [L, R] = STEPS[s], [PL, PR] = STEPS[Math.max(0, s - 1)], l = lerp(PL, L, f), r = lerp(PR, R, f), x0 = 30, a = NUMS[L], b = NUMS[R], up = leave * 80, down = leave * 60;
  T(c, a + " + " + b + " = " + (a + b), 18, 38 - up, 26, found ? GREEN : "#ffffff", true);
  T(c, "target 13", 262, 38 - up, 20, "#9aa3d8");
  if (!leave) NUMS.forEach((n, i) => {
    const on = i === L || i === R, bg = found && on ? GREEN : i === L ? GOLD : i === R ? "#1238c4" : "#20275e", col = on && (i === L || found) ? INK : "#ffffff";
    box(c, x0 + i * 40, 148, 38, 38, bg);
    T(c, String(n), x0 + i * 40 + (n > 9 ? 8 : 14), 174, 20, col, true);
  });
  box(c, x0 + l * 40 + 13, 192 + down, 12, 6, GOLD); T(c, "L", x0 + l * 40 + 14, 216 + down, 16, GOLD, true);
  box(c, x0 + r * 40 + 13, 192 + down, 12, 6, HI); T(c, "R", x0 + r * 40 + 14, 216 + down, 16, HI, true);
  if (!solo) me(c, x0 + l * 40 - 17, 64 - (L !== PL ? Math.sin(f * Math.PI) * 18 : 0), found ? { pose: "wave", f: Math.floor(t * 6), mouth: 2 } : { pose: "stand", look: 1 });
  if (found) T(c, "FOUND", 250, 96 - up, 32, GOLD, true);
}

/* Multibagger: the array stacks into candles and you climb them */
const TOPS = [190, 178, 186, 170, 178, 164, 172, 152, 134, 112, 92, 74, 58];
export const HOP = 0.18;
const candleX = (i) => 14 + i * 25;
const rise = (k) => (k === 0 || TOPS[k] < TOPS[k - 1] ? GREEN : RED);
const lines = (c, dy, w) => { for (let y = 30; y < H; y += 40) if (y + dy < H) box(c, 0, y + dy, w, 2, "#171d4a"); };
function candle(c, k, x, y, w, h, q) {
  if (q > 0.5) box(c, x + w / 2 - 1, y - 6, 2, h + 16, rise(k));
  box(c, x, y, w, h, rise(k));
}
export function stack(c, t) {
  stage(c, NAVY); lines(c, 0, W * ease(clamp(t / 0.9)));
  pointer(c, 2.6, true, ease(clamp(t / 0.4)));
  NUMS.forEach((n, k) => {
    const q = ease(clamp((t - k * 0.05) / 0.5)), x = lerp(30 + k * 40, candleX(k), q), y = lerp(148, TOPS[k], q), w = lerp(38, 18, q), h = lerp(38, 42, q), hit = k === 2 || k === 5;
    if (q < 0.5) { box(c, x, y, w, h, hit ? GREEN : "#20275e"); if (q < 0.3) T(c, String(n), x + (n > 9 ? 8 : 14), y + 26, 20, hit ? INK : "#ffffff", true); }
    else candle(c, k, x, y, w, h, q);
    if (k === 2) me(c, x + w / 2 - 36, y - lerp(84, 90, q), { pose: "stand", look: 1 });
  });
}
export function climb(c, t) {
  stage(c, NAVY); lines(c, 0, W);
  const i = Math.min(12, 2 + Math.floor(t / HOP)), done = t >= HOP * 10, p = Math.max(2, i - 1), f = done ? 1 : (t - (i - 2) * HOP) / HOP, hop = clamp(f * 1.6), base = lerp(TOPS[p], TOPS[i], hop) - 90, cam = Math.max(0, 30 - base);
  c.save(); c.translate(0, cam);
  for (let k = 0; k <= Math.max(7, i); k++) candle(c, k, candleX(k), TOPS[k], 18, 42, 1);
  me(c, lerp(candleX(p), candleX(i), hop) - 28, base - Math.sin(hop * Math.PI) * 16, done ? { pose: "pointUp", mouth: 2 } : { pose: "stand", mouth: i > 8 ? 3 : 0, look: 1 });
  c.restore();
  if (done) { box(c, 14, 20, 214, 36, GREEN); T(c, "BACKTEST PASSED", 24, 45, 22, INK, true); }
}

/* Flaggo: you run on a spinning globe and plant a flag */
const STARS = (() => { const r = seeded(13), a = []; for (let i = 0; i < 26; i++) a.push([r() * W, r() * 110]); return a; })();
const FLAGS = [[0.9, ["#d94d4a", "#f3f4f9", "#3d7bea"]], [1.8, ["#3fae6a", "#f3f4f9", "#f39c3d"]], [2.6, ["#f7c437", "#10132e", "#d94d4a"]], [3.5, ["#3d7bea", "#f7c437", "#3d7bea"]]];
const SPIN = 2.96;
function earth(dx, dy, R, rot) {
  const d = dx * dx + dy * dy;
  if (d > R * R) return null;
  const z = Math.sqrt(R * R - d), u = Math.atan2(dx, z) + rot, v = Math.asin(dy / R), land = Math.sin(u * 3) * Math.cos(v * 5) + Math.sin(u * 5 + 1.7) * 0.6 > 0.35, lit = (dx + dy * 0.4) / R < 0.21;
  return land ? (lit ? "#3fae6a" : "#1f7042") : lit ? "#3d7bea" : "#1f4bb0";
}
function flagAt(c, cx, cy, R, a, h, cols) {
  c.save(); c.translate(cx + Math.sin(a) * R, cy - Math.cos(a) * R); c.rotate(a);
  box(c, -1, -h, 2, h, "#eef0f8");
  cols.forEach((col, i) => box(c, 1 + i * 7, -h, 7, 14, col));
  c.restore();
}
function globe(c, cy, rot) {
  const cx = 190, R = 160;
  cy = Math.round(cy);
  for (let y = cy - R; y < H; y += 4) for (let x = cx - R; x < cx + R; x += 4) { const col = earth(x - cx, y - cy, R, rot); if (col) box(c, x, y, 4, 4, col); }
  FLAGS.forEach(([lon, cols]) => { const a = lon - rot; if (Math.abs(a) < 0.95) flagAt(c, cx, cy, R, a, 26, cols); });
}
/* handoff: leap off the top candle, the chart drops away, the globe rises */
export function leap(c, t, p) {
  const cam = 62 + 260 * ease(clamp(p / 0.55)), dy = cam - 62;
  box(c, 0, 0, W, H, "#0a1540");
  STARS.forEach(([x, y], i) => { if (i / 26 < p * 1.8) box(c, x, y, 2, 2, HI); });
  lines(c, dy, W);
  c.save(); c.translate(0, cam);
  for (let k = 0; k < 13; k++) candle(c, k, candleX(k), TOPS[k], 18, 42, 1);
  c.restore();
  box(c, 14, 20 + dy, 214, 36, GREEN); T(c, "BACKTEST PASSED", 24, 45 + dy, 22, INK, true);
  globe(c, lerp(462, 262, ease(clamp((p - 0.35) / 0.65))), 0);
  me(c, lerp(286, 154, p), lerp(30, 20, p) - Math.sin(p * Math.PI) * 30, { pose: "startle", mouth: 3, look: -1 });
}
export function flaggo(c, t, solo) {
  box(c, 0, 0, W, H, "#0a1540");
  STARS.forEach(([x, y]) => box(c, x, y, 2, 2, HI));
  const slow = clamp((t - 1.7) / 0.3), rot = t < 1.7 ? 1.6 * t : 2.72 + 0.24 * (1 - (1 - slow) * (1 - slow)), done = t >= 2.05;
  globe(c, 262, rot);
  if (done) { flagAt(c, 190, 262, 160, 0.25, Math.round(36 * clamp((t - 2.05) / 0.08)), [RED, GOLD, GREEN]); T(c, "+1 COUNTRY", 12, 42, 24, GOLD, true); }
  if (solo) return;
  const f = Math.floor(t * 14);
  me(c, 154, 20 - (!done && t < 1.9 ? (f % 2) * 3 : 0), done ? { pose: "thumbs", mouth: 2 } : t < 1.9 ? { pose: "stand", lift: [1, 0, 2, 0][f % 4], look: 1, mouth: 3 } : { pose: "point", look: 1 });
}
/* handoff: the globe's pixels grow until they are chess squares, then flip */
export function flat(c, t, p) {
  const m = clamp(p / 0.55), px = [4, 8, 12, 16, 24][Math.min(4, Math.floor(m * 5))], tiles = p > 0.55, u = (p - 0.55) / 0.45, R = lerp(160, 560, m * m), cx = lerp(190, 112, m), cy = lerp(262, 120, m);
  if (tiles) coachmate(c, 0, true);
  for (let y = -1; y < H; y += px) for (let x = -8; x < W; x += px) {
    const f = tiles ? clamp((u - ((x + y + 9) / (W + H + 40)) * 0.7) / 0.3) : 0;
    if (f >= 1) continue;
    const w = px * (1 - f);
    box(c, x + (px - w) / 2, y, w, px, earth(x + px / 2 - cx, y + px / 2 - cy, R, SPIN) || "#0a1540");
  }
  if (px === 4) {
    STARS.forEach(([x, y]) => { if (Math.hypot(x - cx, y - cy) > R) box(c, x, y, 2, 2, HI); });
    flagAt(c, cx, cy, R, 0.25, 36, [RED, GOLD, GREEN]); T(c, "+1 COUNTRY", 12, 42, 24, GOLD, true);
  }
  const q = ease(clamp(p / 0.7));
  me(c, lerp(154, 244, q), lerp(20, FLOOR - 84, q) - Math.sin(q * Math.PI) * 24, q < 1 ? { pose: "startle", mouth: 3, look: 1 } : { pose: "stand", look: -1 });
}

/* Coachmate: the blunder gets flagged and rewound, then the best move lands */
const PIECE = {
  p: ["........", "...OO...", "..OXXO..", "..OXXO..", "...OO...", "..OXXO..", ".OXXXXO.", ".OOOOOO."],
  n: ["..OO....", ".OXXOO..", "OXXXXXO.", "OXXOXXXO", "..OXXXXO", ".OXXXXO.", "OXXXXXXO", "OOOOOOOO"],
  q: ["O..OO..O", "OXOXXOXO", ".OXXXXO.", ".OXXXXO.", "..OXXO..", "..OXXO..", ".OXXXXO.", ".OOOOOO."],
  k: ["...OO...", "..OXXO..", ".OOXXOO.", "OXXXXXXO", ".OXXXXO.", "..OXXO..", ".OXXXXO.", ".OOOOOO."],
};
const piece = (c, k, x, y, white) => map(c, PIECE[k], Math.round(x), Math.round(y), 2, white ? { O: INK, X: "#ffffff" } : { O: "#ffffff", X: INK });
const sq = (n) => 16 + n * 24, rk = (n) => 23 + n * 24;
export function coachmate(c, t, solo) {
  stage(c, NAVY, "#20275e");
  box(c, 12, 19, 200, 200, HI);
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) box(c, sq(x), rk(y), 24, 24, (x + y) % 2 ? "#3a4690" : "#d9dbe6");
  const bad = t >= 0.85 && t < 1.4, best = t >= 1.6, q = t < 0.5 ? 0 : t < 0.75 ? (t - 0.5) / 0.25 : t < 1.4 ? 1 : t < 1.6 ? 1 - (t - 1.4) / 0.2 : 0, n = clamp((t - 1.9) / 0.3), done = t >= 2.2;
  if (bad) box(c, sq(3), rk(2), 24, 24, RED);
  if (best) box(c, sq(4), rk(3), 24, 24, GREEN);
  [[1, 1], [4, 1], [5, 1], [6, 1]].forEach(([x, y]) => piece(c, "p", sq(x) + 4, rk(y) + 4, false));
  [[4, 6], [5, 6], [6, 6]].forEach(([x, y]) => piece(c, "p", sq(x) + 4, rk(y) + 4, true));
  piece(c, "k", sq(6) + 4, rk(0) + 4, false); piece(c, "q", sq(2) + 4, rk(2) + 4, false); piece(c, "k", sq(6) + 4, rk(7) + 4, true);
  piece(c, "q", sq(3) + 4, lerp(rk(7), rk(2), q) + 4, true);
  if (best && !done) for (let i = 0; i < 7; i++) { const p = i / 6; box(c, lerp(sq(5), sq(4), p) + 10, lerp(rk(5), rk(3), p) + 10, 4, 4, GREEN); }
  piece(c, "n", lerp(sq(5), sq(4), n) + 4, lerp(rk(5), rk(3), n) + 4 - Math.sin(n * Math.PI) * 28, true);
  if (bad) { box(c, sq(3) + 14, rk(2) - 10, 28, 22, RED); T(c, "??", sq(3) + 18, rk(2) + 7, 18, "#ffffff", true); T(c, "BLUNDER", 224, 52, 28, "#ff6a63", true); }
  if (done) T(c, "BEST MOVE", 224, 52, 26, GREEN, true);
  if (!solo) me(c, 244, FLOOR - 84, bad ? { pose: "startle", mouth: 3, look: -1 } : done ? { pose: "thumbs", mouth: 2 } : { pose: "stand", look: -1 });
}

/* the end card, where the film stops and the visitor can act */
export function card(c, t, solo) {
  stage(c, NAVY, "#20275e");
  const x = 14, y = 18, w = 232, h = 184;
  box(c, x + 6, y + 6, w, h, "rgba(0,0,0,.45)"); box(c, x, y, w, h, INK); box(c, x + 2, y + 2, w - 4, h - 4, "#d9dbe6"); box(c, x + 4, y + 4, w - 8, 22, "#0b2fa8"); box(c, x + 4, y + 28, w - 8, h - 32, PAPER);
  T(c, "Rohan Ahire", x + 10, y + 21, 15, "#ffffff");
  T(c, "Rohan Ahire", x + 16, y + 62, 32, INK, true);
  T(c, "Full-stack engineer · Mumbai", x + 16, y + 84, 14, "#3a4690");
  T(c, "Open to remote (US/EU)", x + 16, y + 102, 14, "#3a4690");
  // the real buttons sit on top of these once the card lands (see .film-card in os.css)
  box(c, x + 16, y + 118, 98, 26, GOLD); box(c, x + 118, y + 118, 98, 26, "#1238c4");
  box(c, x + 16, y + 148, 98, 26, "#d9dbe6"); box(c, x + 118, y + 148, 98, 26, "#d9dbe6");
  if (!solo) me(c, 272, FLOOR - 84, { pose: "wave", f: Math.floor(t * 6), mouth: 2 });
}
/* handoff: the winning square flips the whole board into the end card */
export function flip(c, t, p) {
  card(c, 0, true);
  const ox = sq(4) + 12, oy = rk(3) + 12;
  c.save(); c.beginPath();
  for (let y = -1; y < H; y += 24) for (let x = -8; x < W; x += 24) {
    const f = clamp((p * 1.4 - Math.hypot(x + 12 - ox, y + 12 - oy) / 330) / 0.4);
    if (f < 1) { const w = 24 * (1 - f); c.rect(x + (24 - w) / 2, y, w, 24); }
  }
  c.clip(); coachmate(c, 2.7, true); c.restore();
  me(c, lerp(244, 272, ease(p)), FLOOR - 84, { pose: "thumbs", mouth: 2 });
}
