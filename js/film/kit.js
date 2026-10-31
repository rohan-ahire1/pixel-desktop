// Small drawing helpers shared by the films.
import { GW, GH, build } from "../me-sprite.js";

export const FONT = (s, b) => (b ? "600 " : "") + s + 'px "Pixelify Sans", ui-monospace, monospace';
export const clamp = (v) => Math.max(0, Math.min(1, v));
export const lerp = (a, b, p) => a + (b - a) * p;
export const ease = (p) => 1 - (1 - p) * (1 - p);
export const seeded = (s) => () => (s = (s * 16807) % 2147483647) / 2147483647;
export const box = (c, x, y, w, h, col) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), w, h); };
export const T = (c, s, x, y, size, col, bold) => { c.font = FONT(size, bold); c.fillStyle = col; c.fillText(s, x, y); };
export function map(c, rows, x, y, s, pal) {
  rows.forEach((r, j) => { for (let i = 0; i < r.length; i++) { const col = pal[r[i]]; if (col) { c.fillStyle = col; c.fillRect(x + i * s, y + j * s, s, s); } } });
}
// pixel Rohan from js/me-sprite.js, each cell drawn as a p-sized square
export function sprite(c, x, y, o, p) {
  const g = build(o);
  x = Math.round(x); y = Math.round(y);
  for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) { const col = g[j * GW + i]; if (col) { c.fillStyle = col; c.fillRect(x + i * p, y + j * p, p, p); } }
}
