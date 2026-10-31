// One Cut, the reel: one continuous shot through six projects, each handing an object to the next.
// This file sets the pace. The drawing is in one-cut-scenes.js.
import { clamp, box } from "./kit.js";
import { W, H, HOP, drop, scoutline, lead, recoup, coin, pointer, stack, climb, leap, flaggo, flat, coachmate, flip, card } from "./one-cut-scenes.js";

export { W, H };
export const S = 3;
export const LABEL = "A short film through Rohan's six projects: a coffee drop becomes a radar, the top lead becomes an invoice, a coin becomes a pointer, an array becomes a chart, the chart gives way to a globe, the globe turns into a chessboard, and the board flips into a contact card.";

// len: seconds on screen. was: the scene's own length, so its clock runs at was / len.
// hold: extra seconds on the last frame, so a stamp stays readable. hits: screen shakes, on the scene's clock.
export const SEGS = [
  { id: "drop", len: 0.5, was: 1.4, run: drop },
  { id: "scout", len: 1.4, was: 2.5, hold: 0.05, hits: [1.9], run: (c, t) => scoutline(c, t) },
  { id: "lead", len: 0.35, was: 0.7, run: lead },
  { id: "recoup", len: 1.5, was: 2.6, hits: [1.95], run: (c, t) => recoup(c, t) },
  { id: "coin", len: 0.65, was: 1.2, run: coin },
  { id: "pointer", len: 1.4, was: 2.6, hold: 0.05, hits: [2.12], run: (c, t) => pointer(c, t) },
  { id: "stack", len: 0.45, was: 0.9, run: stack },
  { id: "climb", len: 1.25, was: 2.3, hits: [HOP * 10], run: climb },
  { id: "leap", len: 0.75, was: 1.5, run: leap },
  { id: "flag", len: 1.4, was: 2.6, hold: 0.06, hits: [0, 2.05], run: (c, t) => flaggo(c, t) },
  { id: "flat", len: 0.6, was: 1.2, run: flat },
  { id: "chess", len: 1.5, was: 2.7, hits: [2.2], run: (c, t) => coachmate(c, t) },
  { id: "flip", len: 0.4, was: 0.8, run: flip },
];
let clock = 0;
SEGS.forEach((s) => { s.at = clock; s.end = clock += s.len + (s.hold || 0); });
export const LEN = clock;
export const HITS = SEGS.flatMap((s) => (s.hits || []).map((at) => s.at + (at * s.len) / s.was));

const seg = (id) => SEGS.find((s) => s.id === id);
const CHAPTER = { scoutline: "scout", recoup: "recoup", pointer: "pointer", multibagger: "climb", flaggo: "flag", coachmate: "chess" };
const HANDOFF = { scoutline: "lead", recoup: "coin", pointer: "stack", multibagger: "leap", flaggo: "flat", coachmate: "flip" };
const span = (s) => [s.at, s.end];
export const chapter = (project) => span(seg(CHAPTER[project]));
export const handoff = (project) => span(seg(HANDOFF[project]));

export function draw(c, t) {
  c.setTransform(S, 0, 0, S, 0, 0);
  c.save(); c.imageSmoothingEnabled = false;
  box(c, 0, 0, W, H, "#000");
  HITS.forEach((at) => { const d = t - at; if (d >= 0 && d < 0.2) { const k = Math.round(6 * (1 - d / 0.2)); c.translate(Math.floor(t * 20) % 2 ? k : -k, Math.floor(t * 10) % 2 ? k >> 1 : -(k >> 1)); } });
  if (t >= LEN) card(c, t - LEN);
  else {
    const s = SEGS.findLast((x) => t >= x.at), u = Math.min(s.was, ((t - s.at) * s.was) / s.len);
    s.run(c, u, clamp(u / s.was));
  }
  c.restore();
  c.fillStyle = "rgba(0,0,0,.14)"; for (let y = 0; y < H; y += 4) c.fillRect(0, y, W, 2);
}
