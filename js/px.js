// Pixel art: drawing helpers, every icon in the OS (32px and 16px), and the pixel cursors.
import { reduce } from "./core.js";
import { GW, build } from "./me-sprite.js";

export const K = "#10132e";
const W = "#fff", C = "#d9dbe6", CD = "#9a9fbb", CL = "#eef0f8";
const Y = "#f7c437", YH = "#ffe58a", YD = "#de9418";
const B = "#2a4fd1", BL = "#2a62d6", BH = "#5a92f2", NAVY = "#0b2fa8";
const G = "#3fd16b", RED = "#d9534f", INK = "#0b0e24";

export const px = (ctx, x, y, c, w = 1, h = 1) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };
// The 16 colours Paint offers; dropped photos are dithered down to these too.
export const PAL16 = ["#10132e", "#555a7a", "#9a9fbb", "#ffffff", "#0b2fa8", "#6f8cff", "#3fd16b", "#1f6f4c",
  "#d9534f", "#f39a76", "#f7c437", "#ffe58a", "#7a34ad", "#ff8fa3", "#f3a03d", "#8b5a2b"];
export const PAL = { K, W: "#eef0f8", G: "#b9bfd8", B: "#8fa0de", L: "#2a4fd1" };
export const drawMap = (ctx, rows, ox, oy, pal = PAL) => rows.forEach((row, y) => {
  for (let x = 0; x < row.length; x++) if (row[x] !== ".") px(ctx, ox + x, oy + y, pal[row[x]]);
});
export const shadow = (ctx, cx, cy, rx, ry = 1.6) => {
  for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
    const dx = (x - cx) / rx, dy = (y - cy) / ry;
    if (dx * dx + dy * dy < 1 && (x + y) % 2 === 0) px(ctx, x, y, "rgba(16,19,46,.35)");
  }
};
export function disc(ctx, cx, cy, r, [base, hi, sh]) {
  for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
    const d = Math.hypot(x, y);
    if (d > r + 0.3) continue;
    const l = (-x - y) / (r * 1.4);
    let c = l > 0.35 ? hi : l < -0.4 ? sh : base;
    if (d > r - 0.8) c = K;
    px(ctx, Math.round(cx + x), Math.round(cy + y), c);
  }
}
const tri = (c, cx, top, h, col) => { for (let i = 0; i < h; i++) px(c, cx - i, top + i, col, 2 * i + 1, 1); };

export const LOGO = [
  "KKKKKKK...", "KWWWWWKK..", "KWWWWWKWK.", "KWWWWWKKKK", "KWWWWWWWWK", "KWWKWWKWWK",
  "KWWWWWWWWK", "KWKWWWWKWK", "KWWKKKKWWK", "KWWWWWWWWK", "KWWWWWWWWK", "KKKKKKKKKK",
];

/* ---------- 32px icons ---------- */
function shortcut(ctx) {
  px(ctx, 0, 22, K, 10, 10); px(ctx, 1, 23, "#fff", 8, 8);
  const A = "#1d34a8";
  [[2, 29], [3, 28], [4, 27], [5, 26], [6, 25]].forEach(([x, y]) => px(ctx, x, y, A, 1, 1));
  px(ctx, 4, 24, A, 4, 1); px(ctx, 7, 24, A, 1, 4);
}
const SEA = ["#1d3fa8", "#2a62d6", "#5a92f2"], LAND = ["#2c6e30", "#46a64c", "#86d870"];
function sphere(ctx, t, cx, cy, r, size, mode) {
  const rot = t * 0.7;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const nx = (x + 0.5 - cx) / r, ny = (y + 0.5 - cy) / r, d2 = nx * nx + ny * ny;
    if (d2 > 1) continue;
    const nz = Math.sqrt(1 - d2);
    const lon = Math.atan2(nx, nz) + rot, lat = Math.asin(ny);
    const light = -0.5 * nx - 0.6 * ny + 0.62 * nz;
    const lvl = light > 0.55 ? 2 : light > 0.12 ? 1 : 0;
    let c;
    if (mode === "web") {
      const grid = Math.abs(Math.sin(lon * 3)) < 0.16 || Math.abs(Math.sin(lat * 4.5)) < 0.13;
      c = grid ? (lvl ? "#e4ebff" : "#9cc0ff") : SEA[lvl];
    } else {
      const land = Math.sin(lon * 2 + 1) * Math.cos(lat * 2.5) + 0.55 * Math.sin(lon * 5 + lat * 3 + 2) + 0.35 * Math.cos(lon * 3 - lat * 7) > 0.5;
      c = land ? LAND[lvl] : SEA[lvl];
      if (!land && Math.abs(Math.sin(lon * 4)) < 0.12) c = SEA[Math.min(2, lvl + 1)];
    }
    if (Math.sqrt(d2) * r > r - 1) c = K;
    px(ctx, x, y, c);
  }
}
function globe(ctx, t) { shadow(ctx, 16, 29.5, 10); sphere(ctx, t, 16, 14.5, 12.5, 32, "land"); }
function web(ctx, t) { shadow(ctx, 16, 29.5, 10); sphere(ctx, t * 0.6, 16, 14.5, 12.5, 32, "web"); }
const ROOK = [
  "KKK..KKKK..KKK", "KWK..KWWK..KWK", "KWKKKKWWKKKKWK", "KWWWWWWWWWWWWK", "KKWWWWWWWWWWKK", ".KKKKKKKKKKKK.",
  "..KWWWWWWWWK..", "..KWWWWWWGWK..", "..KWWWWWWGWK..", "..KWWWWWWGWK..", "..KWWWWWWGWK..", "..KWWWWWWGWK..",
  ".KKKKKKKKKKKK.", ".KWWWWWWWWGWK.", "KKKKKKKKKKKKKK", "KWWWWWWWWWWGWK", "KWWWWWWWWWWGWK", "KKKKKKKKKKKKKK",
];
// Doom: an old monitor showing a hellish corridor, a fireball flying in and the pistol at the bottom.
function doom(ctx, t) {
  shadow(ctx, 16, 30, 12);
  px(ctx, 2, 3, K, 28, 24); px(ctx, 3, 4, C, 26, 22); px(ctx, 3, 4, CL, 26, 1);
  px(ctx, 5, 6, K, 22, 17);
  const sky = ["#2a0606", "#3d0a08", "#55120c", "#6e1a10", "#8a2814", "#6b3a22", "#55301c", "#45281a", "#3a2216", "#2e1b12"];
  for (let y = 0; y < 15; y++) px(ctx, 6, 7 + y, sky[Math.min(9, y * 10 / 15 | 0)], 20, 1);
  px(ctx, 6, 13, "#a8401c", 20, 1);
  const f = reduce ? 0 : Math.floor(t * 6) % 10, fx = 8 + f, fl = Math.floor(t * 10) % 2;
  px(ctx, fx, 10, YD, 3, 3); px(ctx, fx + 1, 11, fl ? YH : Y, 1, 1); px(ctx, fx - 1 - fl, 11, "#de5a18", 1, 1);
  px(ctx, 14, 16, K, 5, 6); px(ctx, 15, 16, CD, 3, 6); px(ctx, 16, 16, CL, 1, 3); px(ctx, 13, 20, "#c08259", 7, 2); px(ctx, 13, 20, K, 1, 2); px(ctx, 19, 20, K, 1, 2);
  px(ctx, 6, 22, RED, 2, 1);
  px(ctx, 12, 27, K, 8, 2); px(ctx, 13, 27, CD, 6, 1);
}
function chess(ctx, t) {
  shadow(ctx, 16, 30, 12);
  px(ctx, 2, 2, K, 28, 27);
  for (let y = 0; y < 6; y++) for (let x = 0; x < 6; x++) px(ctx, 4 + x * 4, 4 + y * 4, (x + y) % 2 ? "#585e86" : "#2b2f4a", 4, 4);
  drawMap(ctx, ROOK, 9, 7 - (Math.floor(t * 1.5) % 2));
}
function chart(ctx, t) {
  shadow(ctx, 16, 30, 12);
  px(ctx, 2, 3, K, 28, 25); px(ctx, 3, 4, "#121733", 26, 23);
  for (let x = 6; x < 29; x += 5) px(ctx, x, 4, "#27306a", 1, 23);
  for (let y = 8; y < 27; y += 5) px(ctx, 3, y, "#27306a", 26, 1);
  const base = [22, 21, 22, 19, 20, 17, 18, 14];
  base.forEach((b, i) => {
    const up = i % 3 !== 1;
    let hh = 3 + (i % 2);
    if (i === base.length - 1) hh += Math.floor((Math.sin(t * 3) + 1) * 1.5);
    const x = 5 + i * 3;
    px(ctx, x + 1, b - hh - 1, up ? G : "#ef4d5a", 1, hh + 3);
    px(ctx, x, b - hh, up ? G : "#ef4d5a", 3, hh);
  });
  [[20, 13], [21, 12], [22, 11], [23, 10], [24, 9], [25, 8]].forEach(([x, y]) => px(ctx, x, y, G, 2, 1));
  px(ctx, 23, 6, G, 4, 1); px(ctx, 26, 6, G, 1, 4);
}
function page(ctx, bg) {
  px(ctx, 5, 3, K, 15, 1); px(ctx, 5, 3, K, 1, 26); px(ctx, 5, 28, K, 20, 1); px(ctx, 24, 9, K, 1, 20);
  px(ctx, 6, 4, bg, 13, 24); px(ctx, 19, 9, bg, 5, 19);
  for (let i = 0; i < 6; i++) px(ctx, 19 + i, 3 + i, K);
  px(ctx, 19, 4, "#c9cde0", 1, 5); px(ctx, 19, 9, K, 6, 1);
}
function extracta(ctx, t) {
  shadow(ctx, 15, 30, 10); page(ctx, W);
  [[10, 16], [13, 12], [16, 15], [19, 10], [22, 14], [25, 11]].forEach(([y, w]) => px(ctx, 8, y, "#4f74e6", w, 2));
  if (Math.floor(t * 2.5) % 2 === 0) { px(ctx, 24, 4, "#ffd84a", 7, 1); px(ctx, 27, 1, "#ffd84a", 1, 7); px(ctx, 27, 4, "#fff"); }
  else { px(ctx, 25, 4, "#ffd84a", 5, 1); px(ctx, 27, 2, "#ffd84a", 1, 5); }
}
function txt(ctx) {
  shadow(ctx, 15, 30, 10); page(ctx, W);
  [11, 14, 17, 20, 23].forEach((y, i) => px(ctx, 8, y, "#6b7194", i === 4 ? 8 : i % 2 ? 11 : 13, 1));
}
function note(ctx) {
  shadow(ctx, 15, 30, 10); page(ctx, "#fff3a6");
  [11, 14, 17, 20].forEach((y, i) => px(ctx, 8, y, "#a08a3a", i === 3 ? 7 : 12, 1));
}
function binBody(ctx, ox = 0) {
  px(ctx, 5, 11, K, 22, 4); px(ctx, 6, 12, "#c9cde0", 20, 2); px(ctx, 12, 9, K, 8, 2);
  for (let y = 15; y < 29; y++) { const inset = Math.floor((y - 15) / 5); px(ctx, 7 + inset, y, K, 18 - inset * 2, 1); px(ctx, 8 + inset, y, C, 16 - inset * 2, 1); }
  px(ctx, 9, 28, K, 14, 1);
  [12, 16, 20].forEach((x) => px(ctx, x + ox, 17, "#8b90ad", 1, 9));
}
function wabin(ctx, t) {
  shadow(ctx, 16, 30, 11);
  const drop = reduce ? 0 : Math.floor(t * 2) % 4;
  px(ctx, 9, 2 + drop, K, 9, 9); px(ctx, 10, 3 + drop, "#7fb2ff", 7, 4); px(ctx, 10, 7 + drop, "#46a64c", 7, 3);
  px(ctx, 17, 4, K, 8, 8); px(ctx, 18, 5, "#ffb347", 6, 6);
  binBody(ctx);
}
function recycle(ctx) { shadow(ctx, 16, 30, 11); binBody(ctx); }
function recycleFull(ctx) {
  shadow(ctx, 16, 30, 11);
  px(ctx, 7, 4, K, 8, 7); px(ctx, 8, 5, W, 6, 5); px(ctx, 9, 6, "#b9bfd8", 3, 1); px(ctx, 10, 8, "#b9bfd8", 3, 1);
  px(ctx, 15, 2, K, 9, 9); px(ctx, 16, 3, "#fff3a6", 7, 7); px(ctx, 17, 5, "#a08a3a", 4, 1); px(ctx, 17, 7, "#a08a3a", 3, 1);
  binBody(ctx);
}
function momentum(ctx, t) {
  shadow(ctx, 16, 30, 12);
  px(ctx, 3, 4, K, 26, 24); px(ctx, 4, 5, "#fff", 24, 22);
  const grow = reduce ? 1 : Math.min(1, (t % 4) / 1.2);
  [4, 7, 10, 14, 18].forEach((hh, i) => { const v = Math.max(1, Math.round(hh * grow)); px(ctx, 7 + i * 4, 26 - v, i === 4 ? RED : "#1d34a8", 3, v); });
  [[7, 15], [9, 14], [11, 13], [13, 12], [15, 11], [17, 10], [19, 9], [21, 8]].forEach(([x, y]) => px(ctx, x, y, G, 2, 1));
  px(ctx, 20, 6, G, 4, 1); px(ctx, 23, 6, G, 1, 4);
}
function computer(ctx, t, color) {
  shadow(ctx, 16, 30, 12);
  px(ctx, 3, 2, K, 26, 20); px(ctx, 4, 3, C, 24, 18); px(ctx, 4, 3, W, 24, 1); px(ctx, 4, 3, W, 1, 18);
  px(ctx, 6, 5, K, 20, 13); px(ctx, 7, 6, BL, 18, 11);
  if (color) {
    ["#d9534f", "#f39c3d", "#f7c437", "#46a64c", "#2a62d6", "#7a4fd1"].forEach((c, i) => px(ctx, 7 + i * 3, 6, c, 3, 11));
  } else {
    px(ctx, 7, 6, "#4a68dc", 18, 3); px(ctx, 7, 9, "#7290f0", 18, 4);
    tri(ctx, 12, 10, 4, "#8f98cc"); tri(ctx, 19, 9, 5, "#727cb4"); px(ctx, 19, 9, "#eef2ff"); px(ctx, 12, 10, "#eef2ff");
    px(ctx, 7, 14, "#3c6a45", 18, 1); px(ctx, 7, 15, "#4566d4", 18, 2);
  }
  px(ctx, 8, 7, "rgba(255,255,255,.55)", 4, 1);
  px(ctx, 24, 19, G);
  px(ctx, 12, 22, K, 8, 3); px(ctx, 13, 22, CD, 6, 2);
  px(ctx, 6, 25, K, 20, 4); px(ctx, 7, 26, C, 18, 2); px(ctx, 7, 26, W, 18, 1); px(ctx, 17, 27, K, 6, 1);
}
function folder(ctx, t, emblem) {
  shadow(ctx, 16, 30, 13);
  px(ctx, 2, 4, K, 12, 6); px(ctx, 3, 5, YD, 10, 5);
  px(ctx, 6, 6, K, 22, 9); px(ctx, 7, 7, W, 20, 8); px(ctx, 9, 9, "#b9bfd8", 14, 1); px(ctx, 9, 11, "#b9bfd8", 10, 1);
  px(ctx, 1, 10, K, 30, 19); px(ctx, 2, 11, Y, 28, 17); px(ctx, 2, 11, YH, 28, 2); px(ctx, 2, 25, YD, 28, 3);
  if (emblem === "star") { px(ctx, 15, 14, NAVY, 2, 8); px(ctx, 12, 17, NAVY, 8, 2); px(ctx, 14, 16, NAVY, 4, 4); }
  if (emblem === "app") { px(ctx, 10, 14, K, 12, 9); px(ctx, 11, 15, NAVY, 10, 2); px(ctx, 11, 17, W, 10, 5); }
  if (emblem === "gear") { px(ctx, 13, 14, K, 6, 9); px(ctx, 11, 16, K, 10, 5); px(ctx, 14, 15, C, 4, 7); px(ctx, 12, 17, C, 8, 3); px(ctx, 15, 18, K, 2, 1); }
}
const folderStar = (c, t) => folder(c, t, "star"), folderApp = (c, t) => folder(c, t, "app"), folderGear = (c, t) => folder(c, t, "gear");
function terminal(ctx, t) {
  shadow(ctx, 16, 30, 13);
  px(ctx, 1, 3, K, 30, 25); px(ctx, 2, 4, NAVY, 28, 3); px(ctx, 26, 5, W, 2, 1); px(ctx, 2, 7, INK, 28, 20);
  [[5, 11], [6, 12], [7, 13], [6, 14], [5, 15]].forEach(([x, y]) => px(ctx, x, y, G, 2, 1));
  if (reduce || Math.floor(t * 2) % 2 === 0) px(ctx, 11, 15, G, 6, 2);
  px(ctx, 5, 19, "#3a4a8a", 16, 1); px(ctx, 5, 22, "#3a4a8a", 10, 1);
}
function paint(ctx) {
  shadow(ctx, 15, 30, 12);
  for (let y = 7; y < 29; y++) for (let x = 1; x < 29; x++) {
    const d = ((x + 0.5 - 14) / 12.5) ** 2 + ((y + 0.5 - 18) / 9.5) ** 2;
    if (d > 1) continue;
    const hole = (x - 19) ** 2 + (y - 23) ** 2;
    if (hole < 4.5) continue;
    px(ctx, x, y, d > 0.8 || hole < 8 ? K : y < 13 ? "#f3d9a8" : "#e2b67a");
  }
  [[7, 15, RED], [11, 11, Y], [17, 11, BL], [7, 20, "#46a64c"], [13, 21, W]].forEach(([x, y, c]) => { px(ctx, x - 1, y - 1, K, 4, 4); px(ctx, x, y, c, 2, 2); });
  for (let i = 0; i < 9; i++) px(ctx, 26 - i, 2 + i, K, 4, 3);
  for (let i = 0; i < 9; i++) px(ctx, 27 - i, 3 + i, "#b0763a", 2, 1);
  px(ctx, 16, 10, K, 5, 5); px(ctx, 17, 11, "#c9cde0", 3, 3);
  px(ctx, 13, 14, K, 5, 5); px(ctx, 14, 15, RED, 3, 3);
}
function mines(ctx) {
  px(ctx, 2, 2, K, 28, 28); px(ctx, 3, 3, C, 26, 26); px(ctx, 3, 3, W, 26, 2); px(ctx, 3, 3, W, 2, 26); px(ctx, 3, 27, CD, 26, 2); px(ctx, 27, 3, CD, 2, 26);
  px(ctx, 15, 6, K, 2, 20); px(ctx, 6, 15, K, 20, 2);
  for (let i = 0; i < 12; i++) { px(ctx, 9 + i, 9 + i, K, 2, 2); px(ctx, 21 - i, 9 + i, K, 2, 2); }
  disc(ctx, 16, 16, 6, ["#2b2f4a", "#585e86", K]);
  px(ctx, 13, 13, W, 2, 2);
}
function tunes(ctx, t, playing) {
  shadow(ctx, 16, 30, 13);
  px(ctx, 1, 6, K, 30, 21); px(ctx, 2, 7, "#33405e", 28, 19); px(ctx, 2, 7, "#4b5b82", 28, 1);
  px(ctx, 4, 9, K, 24, 11); px(ctx, 5, 10, "#f3f4f9", 22, 9); px(ctx, 5, 11, RED, 22, 1); px(ctx, 5, 12, Y, 22, 1);
  px(ctx, 9, 13, K, 14, 5); px(ctx, 10, 14, "#141a52", 12, 3);
  const spin = playing && !reduce ? Math.floor(t * 8) % 2 : 0;
  [11, 19].forEach((x) => { px(ctx, x, 14, W, 3, 3); if (spin) { px(ctx, x, 14, K); px(ctx, x + 2, 16, K); } else { px(ctx, x + 1, 15, K); } });
  px(ctx, 8, 21, K, 16, 5); px(ctx, 9, 22, "#4b5b82", 14, 3); px(ctx, 11, 23, K, 2, 2); px(ctx, 19, 23, K, 2, 2);
  [[3, 8], [28, 8], [3, 24], [28, 24]].forEach(([x, y]) => px(ctx, x, y, CD));
}
function calc(ctx) {
  shadow(ctx, 16, 30, 10);
  px(ctx, 6, 1, K, 20, 28); px(ctx, 7, 2, C, 18, 26); px(ctx, 7, 2, W, 18, 1);
  px(ctx, 8, 4, K, 16, 7); px(ctx, 9, 5, "#b8d8a8", 14, 5); px(ctx, 15, 6, "#2c4a2c", 2, 3); px(ctx, 19, 6, "#2c4a2c", 2, 3); px(ctx, 12, 6, "#2c4a2c", 2, 3);
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) { px(ctx, 8 + c * 4, 13 + r * 4, K, 4, 4); px(ctx, 8 + c * 4, 13 + r * 4, c === 3 ? "#f39c3d" : W, 3, 3); }
}
function mail(ctx) {
  shadow(ctx, 16, 30, 13);
  px(ctx, 1, 7, K, 30, 20); px(ctx, 2, 8, W, 28, 18); px(ctx, 2, 8, "#e6e8f2", 28, 2);
  for (let i = 0; i < 14; i++) { const y = 8 + Math.round((i * 10) / 13); px(ctx, 2 + i, y, K); px(ctx, 29 - i, y, K); }
  px(ctx, 14, 17, RED, 4, 3); px(ctx, 15, 20, RED, 2, 1);
  px(ctx, 2, 25, CD, 28, 1);
}
function control(ctx, t) {
  shadow(ctx, 16, 30, 13);
  px(ctx, 2, 4, K, 28, 24); px(ctx, 3, 5, C, 26, 22); px(ctx, 3, 5, W, 26, 1); px(ctx, 3, 5, W, 1, 22);
  const m = reduce ? 0 : t;
  [[9, 12, 0], [16, 19, 1.7], [23, 10, 3.1]].forEach(([x, y, ph]) => {
    px(ctx, x, 8, K, 2, 17);
    const yy = y + Math.round(Math.sin(m * 0.9 + ph) * 3);
    px(ctx, x - 2, yy, K, 6, 4); px(ctx, x - 1, yy + 1, NAVY, 4, 2);
  });
}
function sound(ctx, t) {
  shadow(ctx, 15, 30, 11);
  px(ctx, 3, 11, K, 9, 10); px(ctx, 4, 12, C, 7, 8);
  for (let i = 0; i < 8; i++) { px(ctx, 12 + i, 11 - i, K, 1, 10 + 2 * i); if (i < 7) px(ctx, 12 + i, 12 - i, CD, 1, 8 + 2 * i); }
  const f = reduce ? 2 : Math.floor(t * 2) % 3;
  if (f >= 1) { px(ctx, 23, 12, K, 1, 8); px(ctx, 22, 11, K); px(ctx, 22, 20, K); }
  if (f >= 2) { px(ctx, 27, 9, K, 1, 14); px(ctx, 26, 8, K); px(ctx, 26, 23, K); }
}
function catface(ctx, t) {
  shadow(ctx, 16, 30, 11);
  const O = "#f3a03d", D = "#c96a1e";
  for (let y = 7; y < 28; y++) for (let x = 3; x < 29; x++) {
    const d = ((x + 0.5 - 16) / 12) ** 2 + ((y + 0.5 - 18) / 9.5) ** 2;
    if (d <= 1) px(ctx, x, y, d > 0.82 ? K : O);
  }
  for (let i = 0; i < 6; i++) { px(ctx, 5 + Math.floor(i / 2), 3 + i, K, 2 + i, 1); px(ctx, 24 - i, 3 + i, K, 2 + i, 1); }
  for (let i = 1; i < 5; i++) { px(ctx, 6 + Math.floor(i / 2), 4 + i, "#ff8fa3", i, 1); px(ctx, 25 - i, 4 + i, "#ff8fa3", i, 1); }
  px(ctx, 13, 9, D, 1, 3); px(ctx, 16, 8, D, 1, 4); px(ctx, 19, 9, D, 1, 3);
  const blink = !reduce && t % 4 < 0.2;
  if (blink) { px(ctx, 9, 17, K, 4, 1); px(ctx, 19, 17, K, 4, 1); }
  else { px(ctx, 10, 15, K, 2, 4); px(ctx, 20, 15, K, 2, 4); px(ctx, 10, 15, W); px(ctx, 20, 15, W); }
  px(ctx, 15, 20, "#ff8fa3", 2, 1); px(ctx, 14, 22, K, 1, 1); px(ctx, 17, 22, K); px(ctx, 15, 23, K, 2, 1);
  px(ctx, 4, 20, K, 6, 1); px(ctx, 22, 20, K, 6, 1);
}
function help(ctx) {
  shadow(ctx, 16, 30, 11);
  px(ctx, 5, 3, K, 22, 26); px(ctx, 6, 4, B, 20, 22); px(ctx, 6, 26, W, 20, 2); px(ctx, 8, 4, "#1d34a8", 1, 22);
  px(ctx, 13, 8, W, 7, 2); px(ctx, 12, 9, W, 2, 2); px(ctx, 19, 9, W, 2, 4); px(ctx, 16, 13, W, 4, 2); px(ctx, 15, 14, W, 2, 3); px(ctx, 15, 19, W, 2, 2);
}
function logoBig(ctx) { shadow(ctx, 16, 30, 10); ctx.save(); ctx.scale(2, 2); drawMap(ctx, LOGO, 3, 2); ctx.restore(); }
function recoup(ctx) {
  shadow(ctx, 16, 30, 10);
  px(ctx, 6, 2, K, 20, 26); px(ctx, 7, 3, W, 18, 24);
  [[7, 12], [11, 12], [15, 7]].forEach(([y, w]) => px(ctx, 10, y, "#9a9caa", w, 2));
  disc(ctx, 22, 23, 6, ["#f7c437", "#ffe58a", "#de9418"]);
  px(ctx, 21, 20, "#9a6a10", 2, 6);
}
function pointer(ctx) {
  shadow(ctx, 16, 30, 11);
  px(ctx, 3, 3, K, 26, 25); px(ctx, 4, 4, "#2f5fd8", 24, 23);
  for (let i = 0; i < 11; i++) { px(ctx, 11, 7 + i, K, i + 2, 1); if (i) px(ctx, 12, 7 + i, W, i, 1); }
  px(ctx, 11, 18, K, 11, 1); px(ctx, 15, 18, K, 4, 6); px(ctx, 16, 18, W, 2, 5);
}
function scoutline(ctx) {
  shadow(ctx, 16, 30, 11);
  px(ctx, 3, 3, K, 26, 25); px(ctx, 4, 4, "#cfe8c4", 24, 23);
  px(ctx, 4, 21, W, 24, 2); px(ctx, 22, 4, W, 2, 23);
  for (let i = 0; i < 5; i++) px(ctx, 11 + i, 18 + i, "#922b2b", 10 - 2 * i, 1);
  disc(ctx, 16, 12, 7, ["#d9534f", "#ff9b8f", "#922b2b"]);
  px(ctx, 15, 11, W, 3, 3);
}
function find(ctx) {
  shadow(ctx, 15, 30, 10); page(ctx, W);
  [11, 14, 17].forEach((y) => px(ctx, 8, y, "#b9bfd8", 12, 1));
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
    const d = Math.hypot(x + 0.5 - 14, y + 0.5 - 15);
    if (d < 8.2) px(ctx, x, y, d > 6.2 ? K : d < 3 && x < 14 && y < 15 ? W : "#bfe0ff");
  }
  for (let i = 0; i < 8; i++) { px(ctx, 19 + i, 20 + i, K, 4, 3); px(ctx, 20 + i, 21 + i, "#b0763a", 2, 1); }
}
function runBig(ctx) {
  shadow(ctx, 16, 30, 12);
  px(ctx, 2, 5, K, 26, 22); px(ctx, 3, 6, NAVY, 24, 4); px(ctx, 3, 10, W, 24, 16); px(ctx, 23, 7, W, 2, 2);
  px(ctx, 6, 15, K, 14, 4); for (let i = 0; i < 6; i++) px(ctx, 18 + i, 11 + i, K, 2, 12 - 2 * i);
  px(ctx, 7, 16, BH, 12, 2);
}
function power(ctx) {
  shadow(ctx, 16, 30, 11);
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
    const d = Math.hypot(x + 0.5 - 16, y + 0.5 - 16), a = Math.atan2(x + 0.5 - 16, -(y + 0.5 - 16));
    if (d > 7.5 && d < 12.5 && Math.abs(a) > 0.6) px(ctx, x, y, d > 11.3 || d < 8.7 ? K : RED);
  }
  px(ctx, 14, 3, K, 4, 14); px(ctx, 15, 4, RED, 2, 12);
}
function msgIcon(kind) {
  return (ctx) => {
    if (kind === "warn") {
      for (let i = 0; i < 24; i++) { const hw = Math.round(i * 0.56); px(ctx, 16 - hw, 4 + i, K, 2 * hw + 2, 1); if (i > 1 && i < 23) px(ctx, 17 - hw + 1, 4 + i, Y, Math.max(0, 2 * hw - 2), 1); }
      px(ctx, 15, 11, K, 3, 9); px(ctx, 15, 22, K, 3, 3);
      return;
    }
    disc(ctx, 16, 16, 13, kind === "error" ? [RED, "#ff9b8f", "#922b2b"] : [BL, BH, "#1f4bb0"]);
    if (kind === "info") { px(ctx, 15, 8, W, 3, 3); px(ctx, 13, 13, W, 5, 2); px(ctx, 15, 13, W, 3, 10); px(ctx, 13, 22, W, 7, 2); }
    if (kind === "error") for (let i = 0; i < 11; i++) { px(ctx, 10 + i, 10 + i, W, 2, 2); px(ctx, 20 - i, 10 + i, W, 2, 2); }
    if (kind === "question") { px(ctx, 13, 8, W, 7, 2); px(ctx, 12, 9, W, 2, 2); px(ctx, 19, 9, W, 2, 5); px(ctx, 16, 14, W, 4, 2); px(ctx, 15, 15, W, 2, 3); px(ctx, 15, 21, W, 2, 2); }
  };
}

/* ---------- 16px icons ---------- */
// Pixel Rohan's head (16px) and bust (32px), cut from the taskbar sprite so they always match
function meCrop(ctx, t, sx, sy, n, pose) {
  const g = build({ pose, shut: !reduce && t % 4.2 < 0.16, mouth: 2, f: Math.floor(t * 3) });
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const c = g[(sy + y) * GW + sx + x]; if (c) px(ctx, x, y, c); }
}
const S = {
  me: (c, t) => meCrop(c, t || 0, 10, 3, 16, "stand"),
  doom: (c, t) => {
    px(c, 1, 1, K, 14, 11); px(c, 2, 2, "#3d0a08", 12, 4); px(c, 2, 6, "#8a2814", 12, 1); px(c, 2, 7, "#45281a", 12, 4);
    px(c, 4 + (reduce ? 0 : Math.floor(t * 5) % 6), 3, Y, 2, 2);
    px(c, 7, 7, K, 3, 4); px(c, 8, 7, CD, 1, 4);
    px(c, 5, 12, K, 6, 2); px(c, 3, 14, K, 10, 1);
  },
  logo: (c) => drawMap(c, LOGO, 3, 2),
  computer: (c, t, color) => {
    px(c, 1, 1, K, 14, 10); px(c, 2, 2, C, 12, 8); px(c, 3, 3, K, 10, 6);
    if (color) ["#d9534f", "#f7c437", "#46a64c", "#2a62d6"].forEach((col, i) => px(c, 4 + i * 2, 4, col, 2, 4));
    else { px(c, 4, 4, BL, 8, 4); px(c, 4, 4, BH, 3, 1); px(c, 4, 7, "#3c6a45", 8, 1); }
    px(c, 6, 11, K, 4, 2); px(c, 3, 13, K, 10, 3); px(c, 4, 14, C, 8, 1);
  },
  folder: (c) => { px(c, 1, 2, K, 7, 3); px(c, 2, 3, YD, 5, 2); px(c, 0, 5, K, 16, 10); px(c, 1, 6, Y, 14, 8); px(c, 1, 6, YH, 14, 1); px(c, 1, 12, YD, 14, 2); },
  recycle: (c, t, full) => {
    if (full) { px(c, 3, 0, K, 5, 4); px(c, 4, 1, W, 3, 2); px(c, 8, 0, K, 5, 4); px(c, 9, 1, "#fff3a6", 3, 2); }
    px(c, 2, 3, K, 12, 3); px(c, 3, 4, C, 10, 1); px(c, 6, 2, K, 4, 1);
    for (let y = 6; y < 15; y++) { const i = (y - 6) / 4 | 0; px(c, 3 + i, y, K, 10 - 2 * i, 1); px(c, 4 + i, y, C, 8 - 2 * i, 1); }
    px(c, 4, 15, K, 8, 1); px(c, 6, 7, CD, 1, 6); px(c, 9, 7, CD, 1, 6);
  },
  txt: (c, t, bg = W, line = "#6b7194") => {
    px(c, 2, 0, K, 9, 1); px(c, 2, 0, K, 1, 16); px(c, 2, 15, K, 12, 1); px(c, 13, 4, K, 1, 12);
    px(c, 11, 1, K); px(c, 12, 2, K); px(c, 13, 3, K);
    px(c, 3, 1, bg, 7, 14); px(c, 10, 5, bg, 3, 10); px(c, 10, 1, K, 1, 4); px(c, 10, 4, K, 3, 1); px(c, 11, 2, "#c9cde0"); px(c, 11, 3, "#c9cde0", 2, 1);
    [6, 8, 10, 12].forEach((y, i) => px(c, 4, y, line, i === 3 ? 5 : 8, 1));
  },
  terminal: (c) => { px(c, 0, 1, K, 16, 14); px(c, 1, 2, NAVY, 14, 2); px(c, 1, 4, INK, 14, 10); px(c, 3, 6, G); px(c, 4, 7, G); px(c, 3, 8, G); px(c, 6, 8, G, 4, 1); },
  paint: (c) => {
    for (let y = 3; y < 15; y++) for (let x = 0; x < 15; x++) {
      const d = ((x + 0.5 - 7.5) / 7.2) ** 2 + ((y + 0.5 - 9) / 5.6) ** 2;
      if (d > 1 || (x - 10) ** 2 + (y - 11) ** 2 < 2) continue;
      px(c, x, y, d > 0.7 ? K : "#e2b67a");
    }
    px(c, 3, 7, RED, 2, 2); px(c, 6, 5, Y, 2, 2); px(c, 9, 6, BL, 2, 2); px(c, 4, 10, "#46a64c", 2, 2);
    for (let i = 0; i < 5; i++) px(c, 15 - i, i, K, 2, 2);
    px(c, 10, 4, RED, 2, 2);
  },
  mines: (c) => {
    px(c, 7, 1, K, 2, 14); px(c, 1, 7, K, 14, 2);
    [[3, 3], [11, 3], [3, 11], [11, 11]].forEach(([x, y]) => px(c, x, y, K, 2, 2));
    px(c, 4, 5, K, 8, 6); px(c, 5, 4, K, 6, 8); px(c, 6, 6, W, 2, 2);
  },
  tunes: (c) => {
    px(c, 0, 3, K, 16, 11); px(c, 1, 4, "#33405e", 14, 9); px(c, 2, 5, "#f3f4f9", 12, 4); px(c, 2, 6, RED, 12, 1);
    px(c, 4, 7, K, 2, 2); px(c, 10, 7, K, 2, 2); px(c, 4, 11, K, 8, 2);
  },
  calc: (c) => {
    px(c, 2, 0, K, 12, 16); px(c, 3, 1, C, 10, 14); px(c, 4, 2, K, 8, 4); px(c, 5, 3, "#b8d8a8", 6, 2);
    for (let r = 0; r < 3; r++) for (let k = 0; k < 3; k++) px(c, 4 + k * 3, 7 + r * 3, k === 2 ? "#f39c3d" : K, 2, 2);
  },
  mail: (c) => {
    px(c, 0, 3, K, 16, 11); px(c, 1, 4, W, 14, 9);
    for (let i = 0; i < 7; i++) { const y = 4 + Math.round((i * 4) / 6); px(c, 1 + i, y, K); px(c, 14 - i, y, K); }
    px(c, 7, 8, RED, 2, 2);
  },
  web: (c, t) => sphere(c, t * 0.6, 8, 8, 7, 16, "web"),
  globe: (c, t) => sphere(c, t, 8, 8, 7, 16, "land"),
  control: (c) => {
    px(c, 0, 1, K, 16, 14); px(c, 1, 2, C, 14, 12); px(c, 1, 2, W, 14, 1);
    [[4, 5], [8, 9], [12, 6]].forEach(([x, y]) => { px(c, x, 3, K, 1, 10); px(c, x - 1, y, NAVY, 3, 2); });
  },
  sound: (c) => {
    px(c, 1, 5, K, 4, 6); px(c, 2, 6, C, 2, 4);
    for (let i = 0; i < 4; i++) px(c, 5 + i, 5 - i, K, 1, 6 + 2 * i);
    px(c, 6, 5, CD, 1, 6); px(c, 7, 4, CD, 1, 8);
    px(c, 11, 5, K, 1, 6); px(c, 13, 3, K, 1, 10);
  },
  soundOff: (c) => {
    px(c, 1, 5, K, 4, 6); px(c, 2, 6, C, 2, 4);
    for (let i = 0; i < 4; i++) px(c, 5 + i, 5 - i, K, 1, 6 + 2 * i);
    for (let i = 0; i < 5; i++) { px(c, 10 + i, 5 + i, RED); px(c, 14 - i, 5 + i, RED); }
  },
  cat: (c) => {
    for (let y = 3; y < 15; y++) for (let x = 1; x < 15; x++) { const d = ((x + 0.5 - 8) / 6.6) ** 2 + ((y + 0.5 - 9.5) / 5.4) ** 2; if (d <= 1) px(c, x, y, d > 0.7 ? K : "#f3a03d"); }
    px(c, 2, 1, K, 2, 4); px(c, 12, 1, K, 2, 4); px(c, 3, 3, "#f3a03d"); px(c, 12, 3, "#f3a03d");
    px(c, 5, 8, K, 1, 2); px(c, 10, 8, K, 1, 2); px(c, 7, 11, "#ff8fa3", 2, 1);
  },
  help: (c) => {
    px(c, 2, 0, K, 12, 16); px(c, 3, 1, B, 10, 13); px(c, 3, 14, W, 10, 1);
    px(c, 6, 3, W, 4, 1); px(c, 5, 4, W); px(c, 10, 4, W, 1, 2); px(c, 8, 6, W, 2, 1); px(c, 8, 7, W, 1, 2); px(c, 8, 10, W, 1, 2);
  },
  run: (c) => {
    px(c, 0, 2, K, 13, 12); px(c, 1, 3, NAVY, 11, 2); px(c, 1, 5, W, 11, 8);
    px(c, 5, 8, K, 9, 2); px(c, 11, 6, K, 2, 6); px(c, 13, 7, K, 1, 4); px(c, 14, 8, K, 1, 2);
  },
  find: (c) => {
    px(c, 2, 0, K, 6, 1); px(c, 1, 1, K, 1, 1); px(c, 8, 1, K); px(c, 0, 2, K, 1, 6); px(c, 9, 2, K, 1, 6); px(c, 1, 8, K); px(c, 8, 8, K); px(c, 2, 9, K, 6, 1);
    px(c, 1, 2, "#bfe0ff", 8, 6); px(c, 2, 1, "#bfe0ff", 6, 8); px(c, 2, 2, W, 2, 2);
    for (let i = 0; i < 5; i++) px(c, 9 + i, 9 + i, K, 3, 2);
  },
  power: (c) => {
    for (let a = 0; a < 40; a++) {
      const ang = (a / 40) * Math.PI * 2;
      if (Math.abs(ang - Math.PI * 1.5) < 0.6) continue;
      px(c, Math.round(7.5 + Math.cos(ang) * 6), Math.round(8.5 + Math.sin(ang) * 6), RED, 2, 2);
    }
    px(c, 7, 1, K, 2, 8);
  },
  chess: (c) => {
    px(c, 0, 1, K, 16, 15);
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) px(c, 1 + x * 3.5, 2 + y * 3.5, (x + y) % 2 ? "#585e86" : "#2b2f4a", 4, 4);
    drawMap(c, ["K.K.K.K", "KWKWKWK", "KWWWWWK", ".KWWWK.", ".KWWWK.", ".KWWWK.", "KKKKKKK", "KWWWWWK", "KKKKKKK"], 4, 4);
  },
  recoup: (c) => {
    px(c, 2, 0, K, 10, 14); px(c, 3, 1, W, 8, 12);
    px(c, 4, 3, "#9a9caa", 6, 1); px(c, 4, 6, "#9a9caa", 6, 1);
    px(c, 8, 8, K, 7, 7); px(c, 9, 9, "#f7c437", 5, 5); px(c, 11, 10, "#9a6a10", 1, 3);
  },
  pointer: (c) => {
    px(c, 1, 1, K, 14, 14); px(c, 2, 2, "#2f5fd8", 12, 12);
    for (let i = 0; i < 7; i++) px(c, 5, 3 + i, W, i + 1, 1);
    px(c, 7, 10, W, 2, 3);
  },
  scoutline: (c) => {
    px(c, 1, 1, K, 14, 14); px(c, 2, 2, "#cfe8c4", 12, 12);
    px(c, 2, 11, W, 12, 1);
    px(c, 5, 3, "#d9534f", 6, 5); px(c, 6, 8, "#d9534f", 4, 2); px(c, 7, 10, "#922b2b", 2, 2); px(c, 7, 5, W, 2, 1);
  },
  chart: (c) => {
    px(c, 0, 1, K, 16, 14); px(c, 1, 2, "#121733", 14, 12);
    [[2, 8, 3, G], [5, 9, 3, "#ef4d5a"], [8, 6, 4, G], [11, 3, 5, G]].forEach(([x, y, hh, col]) => { px(c, x + 1, y - 1, col, 1, hh + 2); px(c, x, y, col, 3, hh); });
  },
  extracta: (c) => { S.txt(c, 0, W, "#4f74e6"); px(c, 12, 0, "#ffd84a", 1, 5); px(c, 10, 2, "#ffd84a", 5, 1); },
  wabin: (c) => { S.recycle(c, 0, false); px(c, 4, 0, K, 5, 4); px(c, 5, 1, "#7fb2ff", 3, 1); px(c, 5, 2, "#46a64c", 3, 1); },
  momentum: (c) => {
    px(c, 0, 1, K, 16, 14); px(c, 1, 2, W, 14, 12);
    [3, 5, 7, 10].forEach((hh, i) => px(c, 2 + i * 3, 13 - hh, i === 3 ? RED : "#1d34a8", 2, hh));
    px(c, 2, 6, G, 3, 1); px(c, 5, 5, G, 3, 1); px(c, 8, 4, G, 3, 1); px(c, 11, 3, G, 3, 1);
  },
  note: (c) => S.txt(c, 0, "#fff3a6", "#a08a3a"),
  display: (c) => S.computer(c, 0, true),
  system: (c) => S.computer(c, 0, false),
  info: (c) => { disc(c, 8, 8, 7, [BL, BH, "#1f4bb0"]); px(c, 7, 3, W, 2, 2); px(c, 7, 6, W, 2, 6); },
  error: (c) => { disc(c, 8, 8, 7, [RED, "#ff9b8f", "#922b2b"]); for (let i = 0; i < 6; i++) { px(c, 5 + i, 5 + i, W); px(c, 10 - i, 5 + i, W); } },
  net: (c, t, off) => {
    px(c, 0, 1, K, 9, 7); px(c, 1, 2, off ? CD : BL, 7, 4); px(c, 3, 8, K, 3, 1);
    px(c, 7, 7, K, 9, 7); px(c, 8, 8, off ? CD : BL, 7, 4); px(c, 10, 14, K, 3, 1);
    if (off) for (let i = 0; i < 5; i++) { px(c, 5 + i, 4 + i, RED, 2, 1); px(c, 10 - i, 4 + i, RED, 2, 1); }
    else { px(c, 2, 3, BH, 3, 1); px(c, 9, 9, BH, 3, 1); }
  },
  netOff: (c, t) => S.net(c, t, true),
  battery: (c) => {
    const b = iconState.battery || { level: 1, charging: false };
    px(c, 0, 4, K, 14, 9); px(c, 14, 6, K, 2, 5); px(c, 1, 5, W, 12, 7);
    const n = Math.max(1, Math.round(b.level * 10));
    px(c, 2, 6, b.level < 0.2 ? RED : G, n, 5);
    if (b.charging) { px(c, 7, 5, Y, 2, 3); px(c, 5, 7, Y, 4, 2); px(c, 6, 9, Y, 2, 2); px(c, 5, 10, Y, 2, 2); }
  },
  warn: (c) => { for (let i = 0; i < 14; i++) { const hw = Math.round(i * 0.55); px(c, 8 - hw, 1 + i, i > 1 && i < 13 ? Y : K, 2 * hw + 1, 1); px(c, 8 - hw, 1 + i, K); px(c, 8 + hw, 1 + i, K); } px(c, 8, 5, K, 1, 5); px(c, 8, 11, K); },
};

const BIG = {
  computer: (c, t) => computer(c, t, false), display: (c, t) => computer(c, t, true), system: (c, t) => computer(c, t, false),
  folder, folderStar, folderApp, folderGear, recycle, recycleFull, txt, note, terminal, paint, mines,
  tunes: (c, t) => tunes(c, t, iconState.playing), calc, mail, web, control, sound, cat: catface, help, me: (c, t) => meCrop(c, t || 0, 2, 2, 32, "stand"), doom,
  globe, chess, chart, recoup, pointer, scoutline, extracta, wabin, momentum, logo: logoBig, find, run: runBig, power,
  info: msgIcon("info"), warn: msgIcon("warn"), error: msgIcon("error"), question: msgIcon("question"),
};
const SMALL_ALIAS = { folderStar: "folder", folderApp: "folder", folderGear: "folder", recycleFull: "recycle", question: "info" };
const ANIM = new Set(["globe", "chess", "chart", "extracta", "wabin", "momentum", "terminal", "web", "control", "sound", "tunes", "cat", "me", "doom"]);
export const iconState = { playing: false, battery: null };

const live = new Set();
let selColor = "#0b2fa8", lastT = 0;
export const setSelColor = (c) => { selColor = c; live.forEach((e) => e.sel && drawIcon(e, lastT)); };

function drawIcon(e, t) {
  const { ctx, size, name } = e;
  ctx.clearRect(0, 0, size, size);
  if (size === 16) {
    const fn = S[name] || S[SMALL_ALIAS[name]] || S.txt;
    fn(ctx, t, name === "recycleFull");
  } else (BIG[name] || BIG.txt)(ctx, t);
  if (e.shortcut && size === 32) shortcut(ctx);
  if (e.sel) {
    ctx.save(); ctx.globalCompositeOperation = "source-atop"; ctx.fillStyle = selColor; ctx.globalAlpha = 0.85;
    for (let y = 0; y < size; y++) for (let x = (y & 1); x < size; x += 2) ctx.fillRect(x, y, 1, 1);
    ctx.restore();
  }
}

// icon("globe", { size: 32, scale: 2, shortcut: true }) -> <canvas>
export function icon(name, { size = 32, scale = 2, shortcut: sc = false, still = false } = {}) {
  const cv = document.createElement("canvas");
  cv.width = cv.height = size; cv.className = "px"; cv.setAttribute("aria-hidden", "true");
  cv.style.width = cv.style.height = size * scale + "px";
  const e = { ctx: cv.getContext("2d"), name, size, shortcut: sc, sel: false, cv, seen: false };
  cv._icon = e;
  drawIcon(e, lastT);
  if (!still && !reduce) live.add(e);
  return cv;
}
export function iconSel(cv, on) { const e = cv && cv._icon; if (!e || e.sel === on) return; e.sel = on; drawIcon(e, lastT); }
export function iconName(cv, name) { const e = cv && cv._icon; if (!e || e.name === name) return; e.name = name; drawIcon(e, lastT); }
export function iconRedraw(cv) { const e = cv && cv._icon; if (e) drawIcon(e, lastT); }
export function tickIcons(t) {
  lastT = t;
  for (const e of live) {
    if (!e.cv.isConnected) { if (e.seen) live.delete(e); continue; }
    e.seen = true;
    if (ANIM.has(e.name) || e.sel) drawIcon(e, t);
  }
}
export function drawBigIcon(ctx, name, t = 0) { drawIcon({ ctx, size: 32, name, shortcut: false, sel: false }, t); }

/* ---------- cursors ---------- */
const ARROW = [
  "K...........", "KK..........", "KWK.........", "KWWK........", "KWWWK.......", "KWWWWK......", "KWWWWWK.....",
  "KWWWWWWK....", "KWWWWWWWK...", "KWWWWWWWWK..", "KWWWWWWWWWK.", "KWWWWWWKKKKK", "KWWWKWWK....", "KWWKKWWK....",
  "KWK..KWWK...", "KK...KWWK...", "K.....KWWK..", "......KWWK..", ".......KK...",
];
const HAND = [
  "....KK..........", "...KWWK.........", "...KWWK.........", "...KWWK.........", "...KWWKKK.......", "...KWWKWWKKK....",
  "...KWWKWWKWWKK..", "KK.KWWKWWKWWKWK.", "KWKKWWWWWWWWKWK.", "KWWKWWWWWWWWWWK.", ".KWWWWWWWWWWWWK.", "..KWWWWWWWWWWWK.",
  "..KWWWWWWWWWWK..", "...KWWWWWWWWWK..", "....KWWWWWWWK...", "....KWWWWWWWK...", "....KKKKKKKKK...",
];
const GLASS = [
  "KKKKKKKKK", ".KWWWWWK.", ".KYYYYYK.", "..KYYYK..", "...KYK...", "....K....", "...KWK...", "..KWWWK..", ".KWWYWWK.", ".KWYYYWK.", "KKKKKKKKK",
];
function svgCursor(rows, s = 2) {
  const col = { K, W: "#fff", Y };
  let rects = "";
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x];
      if (ch === ".") { x++; continue; }
      let n = 1; while (row[x + n] === ch) n++;
      rects += `<rect x="${x * s}" y="${y * s}" width="${n * s}" height="${s}" fill="${col[ch]}"/>`;
      x += n;
    }
  });
  const w = Math.max(...rows.map((r) => r.length)) * s, hh = rows.length * s;
  return `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${hh}" shape-rendering="crispEdges">${rects}</svg>`)}")`;
}
export function installCursors() {
  const busy = ARROW.map((r) => r.padEnd(22, "."));
  while (busy.length < 21) busy.push(".".repeat(22));
  GLASS.forEach((row, i) => { const y = 9 + i; busy[y] = busy[y].slice(0, 12) + row + busy[y].slice(12 + row.length); });
  const root = document.documentElement.style;
  root.setProperty("--cur", `${svgCursor(ARROW)} 1 1, default`);
  root.setProperty("--cur-hand", `${svgCursor(HAND)} 9 1, pointer`);
  root.setProperty("--cur-busy", `${svgCursor(busy)} 1 1, progress`);
}
