// Pixel Rohan: the sprite. Pure drawing on a small grid (no DOM), so the taskbar, the welcome window
// and the tray icon can all draw the same person. Black tee, blue jeans, white sneakers, beard, quiff.
export const GW = 36, GH = 42;
export const PAL = {
  K: "#10132e", H: "#231a16", h: "#55402f", S: "#c08259", s: "#9d6446", E: "#140e0c", b: "#231a16", B: "#2b1f19", M: "#a65a4c",
  T: "#30303a", t: "#4a4a5a", U: "#232329", J: "#4169ad", j: "#2d4c84", L: "#5b84c8", N: "#f4f4f4", n: "#b9bfcc", O: "#e2504c",
  W: "#ffffff", G: "#c6ecff", A: "#bcc1cc", a: "#8c93a1", D: "#5d6372", R: "#d94d4a", r: "#a93533", Y: "#f39c3d", P: "#ff8fa3",
};
const HEAD = [
  "....HHHHHH....",
  "..HHHhhHHHHH..",
  ".HHHHHHhhHHHH.",
  ".HHHHHHHHHHHHH",
  "HHHHHHHHHHHHHH",
  "HHSSSSSSSSSSHH",
  "HSSSSSSSSSSSSH",
  "HSbbbSSSSbbbSH",
  "sSSSSSSSSSSSSs",
  "sSSSSSSSSSSSSs",
  ".SSSSSSSSSSSS.",
  ".BSSSSssSSSSB.",
  ".BBBBBBBBBBBB.",
  ".BBBBBBBBBBBB.",
  ".BBBBBBBBBBBB.",
  "..BBBBBBBBBB..",
  "....BBBBBB....",
];

const grid = new Array(GW * GH), out = new Array(GW * GH);
const gset = (x, y, c) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && x < GW && y >= 0 && y < GH) grid[y * GW + x] = c; };
const gget = (x, y) => (x >= 0 && x < GW && y >= 0 && y < GH ? grid[y * GW + x] : null);
const grect = (x, y, w, hh, c) => { for (let j = 0; j < hh; j++) for (let i = 0; i < w; i++) gset(x + i, y + j, c); };
const stamp = (rows, x, y) => rows.forEach((r, j) => { for (let i = 0; i < r.length; i++) if (r[i] !== ".") gset(x + i, y + j, r[i]); });
// a hand held over the face, outlined so it reads against skin
const palm = (x, y, w, hh) => { grect(x - 1, y - 1, w + 2, hh + 2, "K"); grect(x, y, w, hh, "S"); grect(x, y + hh - 1, w, 1, "s"); };
// an arm: a 2px line from shoulder to hand, sleeve first, skin after
function arm(x0, y0, x1, y1, sleeve = 3) {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  for (let i = 0; i <= n; i++) grect(Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n), 2, 2, i < sleeve ? "T" : "S");
}

// x0 = left edge of the 14px head; y0 = top of the hair
function head(x0, y0, o) {
  stamp(HEAD, x0, y0);
  const ex = o.look || 0, ey = o.lookY || 0;
  const eyes = [3 + ex, 10 + ex];
  if (o.shut) eyes.forEach((x) => grect(x0 + x - (x > 6 ? 0 : 1), y0 + 9, 2, 1, "E"));
  else if (o.wide) eyes.forEach((x) => grect(x0 + x, y0 + 8 + ey, 1, 2, "E"));
  else eyes.forEach((x) => grect(x0 + x, y0 + 8 + ey, 1, 2, "E"));
  if (o.wide) { grect(x0 + 2, y0 + 6, 3, 1, "b"); grect(x0 + 9, y0 + 6, 3, 1, "b"); grect(x0 + 2, y0 + 7, 3, 1, "S"); grect(x0 + 9, y0 + 7, 3, 1, "S"); }
  if (o.frown) { gset(x0 + 4, y0 + 6, "b"); gset(x0 + 9, y0 + 6, "b"); }
  const m = o.mouth || 0;
  if (m === 1) { grect(x0 + 5, y0 + 13, 4, 1, "E"); grect(x0 + 6, y0 + 14, 2, 1, "M"); }
  else if (m === 2) { grect(x0 + 4, y0 + 13, 6, 1, "M"); gset(x0 + 4, y0 + 12, "M"); gset(x0 + 9, y0 + 12, "M"); }
  else if (m === 3) { grect(x0 + 5, y0 + 13, 4, 2, "E"); grect(x0 + 6, y0 + 15, 2, 1, "M"); }
  else grect(x0 + 5, y0 + 13, 4, 1, "M");
}

function torso(y) {
  grect(13, y, 10, 1, "T"); grect(12, y + 1, 12, 9, "T");
  grect(13, y, 3, 1, "t"); grect(20, y, 3, 1, "t");
  grect(12, y + 9, 12, 1, "U"); grect(17, y + 4, 1, 4, "U");
}
function legsStand(lift = 0) {
  grect(12, 30, 12, 1, "j");
  grect(12, 31, 12, 2, "J");
  const L = lift === 1 ? 1 : 0, R = lift === 2 ? 1 : 0;
  grect(12, 33, 5, 5 - L, "J"); grect(16, 33, 1, 5 - L, "j");
  grect(19, 33, 5, 5 - R, "J"); grect(19, 33, 1, 5 - R, "j");
  grect(11, 38 - L, 6, 2, "N"); grect(11, 40 - L, 6, 1, "n"); gset(11, 38 - L, "O");
  grect(19, 38 - R, 6, 2, "N"); grect(19, 40 - R, 6, 1, "n"); gset(24, 38 - R, "O");
}
function legsSit() {
  grect(11, 36, 14, 1, "J"); grect(9, 37, 18, 1, "J"); grect(8, 38, 20, 2, "J"); grect(9, 40, 18, 1, "J");
  grect(10, 37, 3, 1, "L"); grect(23, 37, 3, 1, "L");
  grect(17, 37, 2, 2, "j");
  grect(13, 38, 4, 2, "N"); grect(13, 40, 4, 1, "n");
  grect(19, 39, 4, 1, "N"); grect(19, 40, 4, 1, "n");
}
function laptop(lid, typing) {
  if (lid <= 0) { grect(10, 34, 16, 2, "A"); grect(10, 35, 16, 1, "a"); return; }
  grect(11, 35, 14, 1, "D");
  const top = 35 - lid;
  grect(12, top, 12, lid, "A"); grect(12, top + lid - 1, 12, 1, "a");
  if (lid >= 4) { grect(12, top, 12, 1, "G"); grect(17, top + 2, 2, 2, "Y"); }
}
function mug(x, y) { grect(x, y, 3, 4, "R"); grect(x, y + 3, 3, 1, "r"); gset(x + 3, y + 1, "R"); gset(x + 3, y + 2, "R"); grect(x, y, 3, 1, "E"); }
function envelope(x, y) {
  grect(x, y, 10, 6, "W");
  for (let i = 0; i < 5; i++) { gset(x + i, y + Math.round(i * 0.6), "n"); gset(x + 9 - i, y + Math.round(i * 0.6), "n"); }
  grect(x + 4, y + 3, 2, 2, "O");
}

// o: { pose, f (frame), look (0 front, 1 toward dir), lookY, shut, mouth (0 shut,1 talk,2 smile,3 shout), lid (0..9), dir }
export function build(o) {
  grid.fill(null);
  const p = o.pose || "stand", f = o.f || 0, face = { look: o.look, lookY: o.lookY, shut: o.shut, mouth: o.mouth, frown: o.frown };
  const sit = ["sit", "laptop", "sip", "nap", "think"].includes(p);
  if (sit) {
    const dy = 7;
    legsSit();
    torso(20 + dy);
    if (p === "laptop" || p === "think") {
      const tl = f % 2;
      arm(11, 22 + dy, 12, 33 + tl, 4); arm(23, 22 + dy, 22, 33 + (1 - tl), 4);
    } else if (p === "sip") { arm(11, 22 + dy, 9, 35, 4); arm(23, 22 + dy, 20, 33, 4); arm(20, 33, 19, 29, 0); }
    else { arm(11, 22 + dy, 9, 35, 4); arm(23, 22 + dy, 25, 35, 4); }
    const droop = p === "nap" ? 1 : 0;
    head(11, 4 + dy + droop, { ...face, lookY: p === "laptop" ? (face.lookY ?? 1) : face.lookY, shut: face.shut || p === "nap", mouth: p === "nap" ? 0 : face.mouth });
    if (p === "laptop" || p === "think") laptop(o.lid ?? 7, f);
    else if (o.lid != null) laptop(o.lid, null);
    if (p === "sip") mug(17, 25);
    else if (o.mug) mug(29, 37);
  } else {
    const bob = o.bob || 0;
    const sh = 22 + bob;
    const lift = o.lift ?? (p === "walk" ? [1, 0, 2, 0][f % 4] : p === "dance" ? (f % 2 ? 2 : 1) : p === "held" || p === "flail" ? (f % 2 ? 2 : 1) : 0);
    legsStand(lift);
    torso(20 + bob);
    const down = (side) => (side < 0 ? arm(10, sh, 10, 29 + bob, 3) : arm(24, sh, 24, 29 + bob, 3));
    if (p === "walk") { arm(10, sh, 9, 28 + bob + (f % 4 === 2 ? 1 : 0), 3); arm(24, sh, 25, 28 + bob + (f % 4 === 0 ? 1 : 0), 3); }
    else if (p === "wave") { down(-1); arm(24, sh, f % 2 ? 29 : 28, f % 2 ? 15 : 13, 2); }
    else if (p === "point") { down(-1); arm(24, sh, 31, sh, 2); grect(33, sh, 1, 1, "S"); }
    else if (p === "pointUp") { down(-1); arm(24, sh, 28, 13, 2); grect(28, 11, 1, 2, "S"); }
    else if (p === "thumbs") { down(-1); arm(24, sh, 27, 27, 2); arm(27, 27, 27, 22, 0); grect(27, 20, 1, 2, "S"); }
    else if (p === "facepalm") { down(-1); arm(24, sh, 22, 18, 2); }
    else if (p === "cover") { arm(10, sh, 12, 17, 2); arm(24, sh, 22, 17, 2); }
    else if (p === "startle") { arm(10, sh, 6, 12, 2); arm(24, sh, 28, 12, 2); }
    else if (p === "held") { arm(10, sh, 8, 3, 2); arm(24, sh, 26, 3, 2); }
    else if (p === "flail") { arm(10, sh, f % 2 ? 5 : 6, f % 2 ? 14 : 10, 2); arm(24, sh, f % 2 ? 28 : 29, f % 2 ? 10 : 14, 2); }
    else if (p === "dance") { if (f % 2) { arm(10, sh, 6, 13 + bob, 2); down(1); } else { down(-1); arm(24, sh, 28, 13 + bob, 2); } }
    else if (p === "carry") { arm(10, sh, 13, 27, 3); arm(24, sh, 21, 27, 3); }
    else if (p === "stretch") { arm(10, sh, 12, 9, 2); arm(24, sh, 22, 9, 2); }
    else { down(-1); down(1); }
    const hy = 4 + bob + (p === "facepalm" ? 1 : 0);
    head(11, hy, { ...face, wide: p === "startle" || p === "flail", shut: face.shut || p === "stretch" || p === "cover", mouth: p === "startle" || p === "flail" || p === "stretch" ? 3 : face.mouth });
    if (p === "facepalm") palm(17, hy + 8, 6, 4);
    if (p === "cover") { palm(12, hy + 8, 5, 3); palm(19, hy + 8, 5, 3); }
    if (p === "carry") envelope(13, 23 + bob);
  }
  // mirror for poses that face the other way
  if (o.dir < 0) for (let y = 0; y < GH; y++) for (let x = 0; x < GW / 2; x++) { const a = y * GW + x, b = y * GW + GW - 1 - x, t = grid[a]; grid[a] = grid[b]; grid[b] = t; }
  for (let i = 0; i < GW * GH; i++) {
    out[i] = grid[i] ? PAL[grid[i]] : null;
    if (grid[i]) continue;
    const x = i % GW, y = (i / GW) | 0;
    if (gget(x - 1, y) || gget(x + 1, y) || gget(x, y - 1) || gget(x, y + 1)) out[i] = PAL.K;
  }
  return out;
}
// the raw letter grid, for debugging in node
export const letters = () => grid.map((c) => c || ".");

// draw onto a 2d context at (x, y) in canvas pixels, one grid cell = one pixel
export function drawMe(ctx, x, y, o) {
  const g = build(o);
  for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) { const c = g[j * GW + i]; if (c) { ctx.fillStyle = c; ctx.fillRect(x + i, y + j, 1, 1); } }
}
