// Color schemes: the title bar, selection and accent colors across the whole OS.
import { setSelColor } from "./px.js";

export const SCHEMES = [
  { id: "classic", name: "PixelOS Blue", c: ["#0b2fa8", "#1238c4", "#6f8cff", "#061a6e"] },
  { id: "teal", name: "Lagoon", c: ["#0a6b6b", "#0f8a85", "#5cc9c2", "#053d3d"] },
  { id: "plum", name: "Plum", c: ["#5b2385", "#7a34ad", "#b98ae0", "#321048"] },
  { id: "ember", name: "Ember", c: ["#a8361a", "#c94a24", "#f39a76", "#5c1a0b"] },
  { id: "slate", name: "Slate", c: ["#33405e", "#4b5b82", "#8d9cc4", "#1a2238"] },
];
export function applyScheme(id) {
  const s = SCHEMES.find((x) => x.id === id) || SCHEMES[0];
  const r = document.documentElement.style;
  ["--title", "--accent", "--hi", "--lo"].forEach((k, i) => r.setProperty(k, s.c[i]));
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", s.c[3]);
  setSelColor(s.c[0]);
}
