// The wallpaper: a dithered pixel lake that follows the clock (day, sunset, night), plus a few classics.
import { px, disc } from "./px.js";
import { settings, bus, onTick, reduce } from "./core.js";

const rng = (seed) => () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]].map((r) => r.map((v) => (v + 0.5) / 16));
const hex = (h) => { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
const ramp = (stops, n) => Array.from({ length: n }, (_, i) => {
  const t = (i / (n - 1)) * (stops.length - 1), k = Math.min(Math.floor(t), stops.length - 2), f = t - k;
  const a = hex(stops[k]), b = hex(stops[k + 1]);
  return a.map((v, j) => Math.round(v + (b[j] - v) * f));
});
const THEMES = {
  day: { sky: ["#4a68dc", "#7290f0", "#b9caff"], lake: ["#7f9cf2", "#4566d4", "#2a47b0"], far: "#8f98cc", farShade: "#727cb4", snow: "#eef2ff",
    near: "#5f6aa3", nearShade: "#4c5690", tree: "#1f4f3b", treeHi: "#2f6f4c", shore: "#3c6a45", cloud: "#f5f7ff", cloudShade: "#c7d3fb", shimmer: "#e4ebff" },
  sunset: { sky: ["#3a2d7a", "#b4559a", "#f49a5a"], lake: ["#d77a6a", "#7a3f86", "#3a2766"], far: "#7a5a9e", farShade: "#5e4585", snow: "#ffd9c2",
    near: "#4f3a78", nearShade: "#3d2d64", tree: "#24183f", treeHi: "#3a2a5c", shore: "#2c1f48", cloud: "#ffb98a", cloudShade: "#d9809a", shimmer: "#ffd2a8" },
  night: { sky: ["#060a2a", "#141c5a", "#2d3585"], lake: ["#232c72", "#141a52", "#0a0f36"], far: "#343c7a", farShade: "#272e66", snow: "#9aa3d8",
    near: "#20275e", nearShade: "#181e4e", tree: "#0d2422", treeHi: "#163a33", shore: "#122a2a", cloud: "#3a4290", cloudShade: "#2a3175", shimmer: "#8f9cf0" },
};
export const WALLPAPERS = [
  { id: "auto", name: "Lake (follows the clock)" },
  { id: "day", name: "Lake at noon" },
  { id: "sunset", name: "Lake at sunset" },
  { id: "night", name: "Lake at night" },
  { id: "teal", name: "Classic teal" },
  { id: "painting", name: "My painting" },
];
export const resolveMode = (m) => {
  if (m !== "auto") return m;
  const h = new Date().getHours();
  return h >= 6 && h < 17 ? "day" : h >= 17 && h < 19 ? "sunset" : "night";
};

function makeCloud(w, h, seed, th) {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const ctx = c.getContext("2d"), R = rng(seed), circles = [];
  for (let i = 0; i < 5; i++) circles.push([w * (0.15 + 0.7 * i / 4), h * 0.62 - R() * h * 0.32, h * (0.28 + R() * 0.24)]);
  for (let y = 0; y < h * 0.86; y++) for (let x = 0; x < w; x++) {
    if (!circles.some(([cx, cy, r]) => (x - cx) ** 2 + (y - cy) ** 2 < r * r)) continue;
    px(ctx, x, y, y > h * 0.6 ? th.cloudShade : th.cloud);
  }
  return c;
}

export function createScene(cv) {
  const ctx = cv.getContext("2d");
  const stat = document.createElement("canvas"), sctx = stat.getContext("2d");
  let W = 320, H = 200, horizon = 120, clouds = [], stars = [], sprites = [], birds = [], kind = "day", shoot = null;

  function render(mode, aspect, pic) {
    kind = resolveMode(mode);
    W = 320; H = Math.max(160, Math.min(720, Math.round(W * aspect))) || 200;
    cv.width = stat.width = W; cv.height = stat.height = H;
    horizon = Math.round(H * 0.6);
    if (kind === "teal" || (kind === "painting" && !pic)) {
      sctx.fillStyle = "#0f7c7c"; sctx.fillRect(0, 0, W, H);
      for (let y = 0; y < H; y++) for (let x = (y & 1); x < W; x += 2) if (Math.hypot(x / W - 0.5, (y / H - 0.5) * 0.7) > 0.52) px(sctx, x, y, "#0b6969");
      ctx.drawImage(stat, 0, 0);
      return;
    }
    if (kind === "painting") {
      sctx.fillStyle = "#0e1236"; sctx.fillRect(0, 0, W, H);
      const img = new Image();
      img.onload = () => {
        const s = Math.max(1, Math.floor(Math.min(W / img.width, H / img.height) / 1.2)) || 1;
        sctx.imageSmoothingEnabled = false;
        for (let y = 0; y < H; y += img.height * s) for (let x = 0; x < W; x += img.width * s) sctx.drawImage(img, x, y, img.width * s, img.height * s);
        ctx.drawImage(stat, 0, 0);
      };
      img.src = pic;
      ctx.drawImage(stat, 0, 0);
      return;
    }
    const th = THEMES[kind];
    const im = sctx.createImageData(W, H), d = im.data;
    const put = (x, y, c) => { if (x < 0 || x >= W || y < 0 || y >= H) return; const i = (y * W + x) * 4; d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255; };
    const band = (cols, y0, y1) => {
      for (let y = y0; y < y1; y++) {
        const t = ((y - y0) / Math.max(1, y1 - y0 - 1)) * (cols.length - 1), k = Math.min(Math.floor(t), cols.length - 1), f = t - k;
        for (let x = 0; x < W; x++) put(x, y, f > BAYER[y & 3][x & 3] && k + 1 < cols.length ? cols[k + 1] : cols[k]);
      }
    };
    band(ramp(th.sky, 7), 0, horizon);
    band(ramp(th.lake, 6), horizon, H);

    if (kind === "sunset") {
      // striped sun sitting on the horizon, drawn before the hills so they overlap it
      const r = Math.round(H * 0.13), cx = Math.round(W * 0.5), cy = horizon - Math.round(r * 0.35);
      const sun = ramp(["#ffe58a", "#ffb35c", "#ff6f7d"], 2 * r + 1);
      for (let y = -r; y <= r; y++) {
        const yy = cy + y;
        if (yy >= horizon) break;
        const gap = y > -r * 0.1 && ((y + r) % 5 < Math.max(1, Math.round((y + r * 0.1) / (r * 0.35))));
        if (gap) continue;
        const hw = Math.sqrt(r * r - y * y);
        for (let x = Math.ceil(cx - hw); x <= cx + hw; x++) put(x, yy, sun[y + r]);
      }
    }

    const mount = (peaks, col, shade, snow) => {
      for (let x = 0; x < W; x++) {
        let top = horizon, who = null;
        for (const p of peaks) {
          const yy = horizon - p.h + Math.abs(x - p.x) * p.s + ((x * 7 + p.x) % 3 === 0 ? 1 : 0);
          if (yy < top) { top = yy; who = p; }
        }
        for (let y = Math.ceil(top); y < horizon; y++) {
          let c = x > who.x ? shade : col;
          if (snow && y < horizon - who.h * 0.74 + ((x * 5) % 3)) c = x > who.x + 1 ? hex(th.snow).map((v) => v - 18) : hex(th.snow);
          put(x, y, Array.isArray(c) ? c : hex(c));
        }
      }
    };
    const hh = H * 0.5;
    mount([
      { x: W * 0.03, h: hh * 0.62, s: 0.9 }, { x: W * 0.15, h: hh * 0.46, s: 1.0 }, { x: W * 0.27, h: hh * 0.3, s: 1.1 },
      { x: W * 0.72, h: hh * 0.34, s: 1.0 }, { x: W * 0.85, h: hh * 0.6, s: 0.9 }, { x: W * 0.97, h: hh * 0.48, s: 1.0 },
    ], th.far, th.farShade, true);
    mount([
      { x: W * 0.0, h: hh * 0.3, s: 0.7 }, { x: W * 0.12, h: hh * 0.2, s: 0.8 }, { x: W * 0.9, h: hh * 0.24, s: 0.8 }, { x: W * 1.02, h: hh * 0.32, s: 0.7 },
    ], th.near, th.nearShade, false);

    for (let x = 0; x < W; x++) { put(x, horizon - 1, hex(th.shore)); put(x, horizon, hex(th.shore)); }
    const R = rng(11), tree = hex(th.tree), treeHi = hex(th.treeHi);
    for (let x = 0; x < W; x += 2 + Math.floor(R() * 3)) {
      const side = Math.abs(x / W - 0.5) * 2;
      if (R() > 0.3 + side * 0.65) continue;
      const h = Math.round(4 + R() * 6 + side * 9);
      for (let i = 0; i < h; i++) {
        const hw = Math.max(0, Math.floor(i * 0.36) - (i % 4 === 0 && i > 3 ? 1 : 0));
        for (let dx = -hw; dx <= hw; dx++) put(x + dx, horizon - h + i, dx === -hw && hw > 1 ? treeHi : tree);
      }
    }
    sctx.putImageData(im, 0, 0);

    const R2 = rng(5);
    sprites = [makeCloud(44, 16, 3, th), makeCloud(30, 12, 9, th), makeCloud(56, 18, 21, th)];
    const nClouds = kind === "sunset" ? 4 : 7;
    clouds = Array.from({ length: nClouds }, (_, i) => ({ x0: R2() * (W + 60), y: Math.round(H * (0.06 + R2() * (kind === "sunset" ? 0.24 : 0.36))), v: 1.2 + R2() * 2.2, s: i % 3 }));
    stars = Array.from({ length: kind === "sunset" ? 24 : 70 }, () => ({ x: Math.floor(R2() * W), y: Math.floor(R2() * horizon * (kind === "sunset" ? 0.3 : 0.75)), p: Math.floor(R2() * 4) }));
    birds = kind === "day" ? Array.from({ length: 3 }, (_, i) => ({ x0: R2() * W, y: Math.round(H * (0.18 + i * 0.05)), v: 6 + R2() * 4, ph: R2() * 6 })) : [];
    draw(0);
  }

  function draw(t) {
    if (kind === "teal" || kind === "painting") return;
    const th = THEMES[kind];
    ctx.drawImage(stat, 0, 0);
    if (kind === "night" || kind === "sunset") {
      const f = Math.floor(t * 2);
      stars.forEach((s) => { if ((s.p + f) % 4 !== 0) px(ctx, s.x, s.y, kind === "night" ? "#dfe4ff" : "#ffe0e8"); });
    }
    if (kind === "night") {
      disc(ctx, Math.round(W * 0.82), Math.round(H * 0.12), 6, ["#f3f1d8", "#ffffff", "#c9c6a4"]);
      if (!shoot && !reduce && Math.random() < 0.004) shoot = { x: W * (0.2 + Math.random() * 0.5), y: H * 0.05 + Math.random() * H * 0.15, t };
      if (shoot) {
        const k = (t - shoot.t) * 60;
        if (k > 34) shoot = null;
        else for (let i = 0; i < 8; i++) { const j = k - i; if (j < 0) continue; px(ctx, Math.round(shoot.x + j * 2), Math.round(shoot.y + j), i < 2 ? "#ffffff" : i < 5 ? "#c9d3ff" : "#6b78d6"); }
      }
    }
    const lakeH = H - horizon;
    ctx.globalAlpha = 0.42;
    for (let r = 1; r < lakeH; r++) {
      const sy = horizon - 1 - Math.floor(r * 0.85);
      if (sy < 0) break;
      const off = Math.round(Math.sin(r * 0.55 - t * 2.2) * (0.6 + r * 0.04));
      ctx.drawImage(stat, 0, sy, W, 1, off, horizon + r, W, 1);
    }
    ctx.globalAlpha = 1;
    clouds.forEach((c) => {
      const spr = sprites[c.s];
      const x = ((c.x0 + t * c.v) % (W + spr.width + 20)) - spr.width - 10;
      ctx.drawImage(spr, Math.round(x), c.y);
    });
    birds.forEach((b) => {
      const x = Math.round(((b.x0 + t * b.v) % (W + 40)) - 20), y = b.y + Math.round(Math.sin(t * 0.8 + b.ph) * 2);
      const up = Math.floor(t * 4 + b.ph) % 2;
      px(ctx, x - 2, y - up, "#2b3170", 2, 1); px(ctx, x, y, "#2b3170"); px(ctx, x + 1, y - up, "#2b3170", 2, 1);
    });
    const f = Math.floor(t * 4);
    for (let i = 0; i < 14; i++) {
      const hsh = (i * 2654435761) >>> 0;
      if ((hsh + f) % 5 !== 0) continue;
      px(ctx, hsh % W, horizon + 3 + (hsh >> 8) % Math.max(1, lakeH - 4), th.shimmer, 2 + (hsh % 4), 1);
    }
  }
  return { render, draw, get kind() { return kind; } };
}

let main;
export function initWallpaper(cv) {
  main = createScene(cv);
  const paint = () => main.render(settings.wallpaper, innerHeight / innerWidth, settings.wallPic);
  paint();
  let rt;
  addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(paint, 150); });
  bus.on("settings", (p) => { if ("wallpaper" in p || "wallPic" in p) paint(); });
  let lastKind = resolveMode(settings.wallpaper);
  setInterval(() => { if (settings.wallpaper === "auto" && resolveMode("auto") !== lastKind) { lastKind = resolveMode("auto"); paint(); } }, 60000);
  if (!reduce) onTick((t) => main.draw(t));
}
