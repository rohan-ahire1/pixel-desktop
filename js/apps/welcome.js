// The welcome window: typed headline, the orbit, pixel me with tips, and the way into the work.
import { h, onTick, reduce, settings, setSettings, EMAIL, announce } from "../core.js";
import { K, px, shadow, disc, icon } from "../px.js";
import { GW, GH, drawMe } from "../me-sprite.js";
import { openWindow } from "../wm.js";
import { launch, openNode } from "./index.js";
import { PROJECTS, LINKS } from "../data.js";
import { WALLPAPERS } from "../wallpaper.js";
import { sfx } from "../sound.js";

const LINES = ["ROHAN", "AHIRE."];
// what a recruiter should get in ten seconds; the numbers are from the résumé
const ROLE = "Full-stack engineer · Mumbai · Open to remote (US/EU)";
const SUMMARY = "Software Engineer II at Pattern. Three years shipping SaaS in TypeScript, React, Node and Python, across billing and payments, creator commerce, data pipelines and AI tooling.";
const PROOF = [
  ["67,000+", "ambassadors paid through the commission system I built"],
  ["48+", "brands billed by the billing and payments system I designed"],
  ["60s to 0.5s", "query time, after I added targeted indexes"],
];
const FEATURED = ["recoup", "pointer", "multibagger"];
const RESUME = "resume.pdf";
const TIPS = [
  "Hi! I'm Rohan. Double-click any icon on the desktop to open it.",
  "Every project icon opens a real project.",
  "Right-click almost anything: the desktop, icons, the taskbar, even me.",
  "Drag a window to the side of the screen to snap it to half. Drag it to the top to fill the screen.",
  "Drop a photo from your computer onto the desktop. It turns into pixel art.",
  "Paint something, then use File › Set as Wallpaper.",
  "That's me on the taskbar. Right-click me for a quick tour.",
  "Open Terminal and type help. Try neofetch.",
  "Want to work together? Open Mail Rohan.",
];

// pixel me, the same sprite that lives on the taskbar: waves hello, talks while a tip is up
function drawRohan(c, t, talking, waveUntil) {
  c.clearRect(0, 0, GW, GH + 2);
  shadow(c, 18, GH, 12);
  const waving = t < waveUntil;
  drawMe(c, 0, 0, { pose: waving ? "wave" : "stand", f: Math.floor(t * 4), shut: !reduce && t % 4.2 < 0.16,
    mouth: talking ? (Math.floor(t * 8) % 2 ? 1 : 0) : 2, look: 0 });
}

const ORBITS = [{ rx: 26, ry: 10 }, { rx: 44, ry: 17 }, { rx: 64, ry: 25 }, { rx: 84, ry: 33 }];
const PLANETS = [
  { o: 1, r: 4, sp: 0.9, a: 3.6, c: ["#3d7bea", "#9cc0ff", "#1f4bb0"] },
  { o: 2, r: 4, sp: 0.6, a: 5.3, c: ["#3fae6a", "#9be3b0", "#1f7042"] },
  { o: 2, r: 5, sp: 0.6, a: 1.2, c: ["#d9534f", "#ff9b8f", "#922b2b"] },
  { o: 3, r: 5, sp: 0.4, a: 3.0, c: ["#9a9caa", "#d6d8e2", "#62647a"] },
];
function drawOrbit(c, t) {
  c.clearRect(0, 0, 180, 110);
  const cx = 92, cy = 56, tilt = -0.17;
  const rot = (x, y) => [cx + x * Math.cos(tilt) - y * Math.sin(tilt), cy + x * Math.sin(tilt) + y * Math.cos(tilt)];
  ORBITS.forEach((o) => {
    const n = Math.round(o.rx * 1.7);
    for (let k = 0; k < n; k += 2) { const a = (k / n) * Math.PI * 2, [x, y] = rot(o.rx * Math.cos(a), o.ry * Math.sin(a)); px(c, Math.round(x), Math.round(y), K); }
  });
  const pos = PLANETS.map((p) => { const a = p.a + t * p.sp * 0.5, o = ORBITS[p.o], [x, y] = rot(o.rx * Math.cos(a), o.ry * Math.sin(a)); return { p, x, y, back: Math.sin(a) < 0 }; });
  pos.filter((q) => q.back).forEach((q) => disc(c, q.x, q.y, q.p.r, q.p.c));
  disc(c, cx, cy, 10, ["#f7c437", "#ffe58a", "#de9418"]);
  pos.filter((q) => !q.back).forEach((q) => disc(c, q.x, q.y, q.p.r, q.p.c));
  const da = 2 + t * 0.25, [dx, dy] = rot(84 * Math.cos(da), 33 * Math.sin(da));
  [[0, -1], [-1, 0], [0, 0], [1, 0], [0, 1]].forEach(([x, y]) => px(c, Math.round(dx) + x, Math.round(dy) + y, K));
  [[20, 14], [150, 8], [168, 72], [136, 100], [40, 92]].forEach(([x, y], i) => {
    if ((Math.floor(t * 2) + i) % 3 === 0) return;
    px(c, x - 2, y, K, 5, 1); px(c, x, y - 2, K, 1, 5);
  });
}

const ARROW = '<svg width="26" height="16" viewBox="0 0 26 16" aria-hidden="true" shape-rendering="crispEdges"><path d="M0 7h20v2H0zM14 1h2v2h2v2h2v2h2v2h-2v2h-2v2h-2v2h-2v-2h2v-2h2V9h2V7h-2V5h-2V3h-2z" fill="currentColor"/></svg>';

export function open(arg, from) {
  let tipI = 0, bubT = 0, talkUntil = 0, waveUntil = 1e9, clock = 0, timers = [];
  const bubble = h("div", { class: "bubble", role: "status", hidden: true });
  const tip = (text) => {
    bubble.textContent = text || TIPS[tipI++ % TIPS.length];
    bubble.hidden = false;
    bubble.style.animation = "none"; void bubble.offsetWidth; bubble.style.animation = "";
    talkUntil = clock + 1.4;
    waveUntil = talkUntil;
    clearTimeout(bubT); bubT = setTimeout(() => (bubble.hidden = true), 7000);
    sfx("pop");
  };

  const work = () => openNode("projects", cta);
  const l1 = h("span"), l2 = h("span");
  const cta = h("button", { type: "button", class: "cta", onclick: work, html: "See all projects " + ARROW });
  const doc = h("canvas", { class: "px", width: String(GW), height: String(GH + 2), "aria-hidden": "true", style: { width: GW * 3 + "px", height: (GH + 2) * 3 + "px" } });
  const docBtn = h("button", { type: "button", class: "doc-btn", "aria-label": "Pixel Rohan. Click for a tip.", onclick: () => tip() }, doc);
  const startup = h("input", { type: "checkbox", id: "wl-startup" });
  startup.checked = settings.welcome !== false;
  startup.addEventListener("change", () => setSettings({ welcome: startup.checked }));

  const w = openWindow({
    id: "welcome", title: "Welcome to PixelOS", icon: "logo", app: "welcome", w: 900, h: 660, minW: 340, minH: 300, from, bodyClass: "welcome paper",
    menubar: [
      { label: "File", items: () => [
        { label: "Open Projects", icon: "folderStar", action: work },
        { label: "Open About me.txt", icon: "txt", action: () => openNode("readme") },
        { sep: true },
        { label: "Close", kbd: "Alt+F4", action: () => w.close() },
      ] },
      { label: "Edit", items: () => [
        { label: "Copy email address", action: () => navigator.clipboard?.writeText(EMAIL).then(() => { tip("Copied! " + EMAIL); announce("Email address copied."); }).catch(() => tip(EMAIL)) },
      ] },
      { label: "View", items: () => [
        { label: "Wallpaper", sub: WALLPAPERS.map((p) => ({ label: p.name, radio: settings.wallpaper === p.id, disabled: p.id === "painting" && !settings.wallPic, action: () => setSettings({ wallpaper: p.id }) })) },
        { label: "Night mode", checked: settings.wallpaper === "night", action: () => setSettings({ wallpaper: settings.wallpaper === "night" ? "auto" : "night" }) },
        { sep: true },
        { label: "Full screen", kbd: "F11", checked: !!document.fullscreenElement, disabled: !document.documentElement.requestFullscreen, action: () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()).catch(() => {}) },
      ] },
      { label: "Build", items: () => PROJECTS.map((p) => ({ label: p.name, icon: p.icon, action: () => openNode(p.id) })) },
      { label: "Help", items: () => [
        { label: "About Rohan", icon: "txt", action: () => openNode("readme") },
        { label: "Contact", icon: "mail", action: () => launch("mail") },
        { label: "Ask me for a tip", action: () => tip() },
        { sep: true },
        { label: "Help Topics", icon: "help", kbd: "F1", action: () => launch("help") },
      ] },
    ],
    onClose: () => { timers.forEach(clearTimeout); clearTimeout(bubT); },
  });
  if (w.body.childElementCount) return w; // already open

  const ext = (label, href, ic, cls = "btn") => h("a", { class: cls + " wl-link", href, target: href.startsWith("mailto") ? null : "_blank", rel: "noopener" }, icon(ic, { size: 16, scale: 1, still: true }), label);
  w.body.append(
    h("div", { class: "hero" },
      h("div", {},
        h("p", { class: "wl-eyebrow" }, ROLE),
        h("h1", { "aria-label": "Rohan Ahire" }, h("span", { "aria-hidden": "true" }, l1, h("br"), l2, h("span", { class: "caret" }))),
        h("p", { class: "lead" }, SUMMARY),
        h("div", { class: "wl-acts" }, ext("Résumé", RESUME, "txt", "btn blue"), ext("Email", "mailto:" + EMAIL, "mail"), ext("GitHub", LINKS.github, "web"), ext("LinkedIn", LINKS.linkedin, "web"))),
      h("div", { class: "art" },
        h("div", { class: "doc-wrap" }, bubble, docBtn))),
    h("ul", { class: "wl-proof", "aria-label": "At work" }, ...PROOF.map(([n, t]) => h("li", {}, h("b", {}, n), h("span", {}, t)))),
    h("div", { class: "wl-side" },
      h("h2", {}, "Built on the side"),
      h("div", { class: "wl-projects" }, ...FEATURED.map((id) => {
        const p = PROJECTS.find((x) => x.id === id);
        return h("button", { type: "button", class: "wl-proj", onclick: (e) => openNode(id, e.currentTarget) },
          icon(p.icon, { size: 32, scale: 1 }), h("span", {}, h("b", {}, p.name), h("small", {}, p.sum)));
      })),
      cta),
  );
  w.el.append(h("div", { class: "wfoot", style: { padding: "6px 10px 8px" } },
    h("label", { class: "check", for: "wl-startup" }, startup, " Show this window when PixelOS starts"),
    h("div", { class: "btnrow" },
      h("button", { type: "button", class: "btn", onclick: () => launch("mail", null) }, "Say hello"),
      h("button", { type: "button", class: "btn def", onclick: () => w.close() }, "Close"))));

  const dc = doc.getContext("2d");
  if (reduce) { l1.textContent = LINES[0]; l2.textContent = LINES[1]; drawRohan(dc, 1, false, 0); }
  else {
    let li = 0, ci = 0;
    const type = () => {
      const el = li === 0 ? l1 : l2;
      el.textContent = LINES[li].slice(0, ++ci);
      if (ci % 2) sfx("type");
      if (ci < LINES[li].length) return timers.push(setTimeout(type, 55 + Math.random() * 60));
      if (li === 0) { li = 1; ci = 0; timers.push(setTimeout(type, 380)); }
    };
    timers.push(setTimeout(type, 500));
    w.on(onTick((t) => { if (w.min) return; if (waveUntil === 1e9) waveUntil = t + 2.6; clock = t; drawRohan(dc, t, t < talkUntil, waveUntil); }));
  }
  timers.push(setTimeout(() => tip(), 3200));
  return w;
}
