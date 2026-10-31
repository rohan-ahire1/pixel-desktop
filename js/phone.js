// PixelOS for phones: a home screen of app icons over the same wallpaper, apps and windows as the desktop.
import { h, $, bus, settings, onTick, runTicks, reduce, fmtTime, EMAIL, announce } from "./core.js";
import { icon, tickIcons, shadow } from "./px.js";
import { applyScheme } from "./theme.js";
import { initWallpaper } from "./wallpaper.js";
import { drawMe, GW, GH } from "./me-sprite.js";
import { list as winList, minimizeAll } from "./wm.js";
import { PROJECTS, NOW, LINKS } from "./data.js";
import * as fs from "./fs.js";
import { launch, openNode } from "./apps/index.js";
import { unlock } from "./sound.js";

applyScheme(settings.scheme);
bus.on("settings", (p) => { if ("scheme" in p) applyScheme(p.scheme); });
initWallpaper($("#bg"));

const t0 = performance.now();
setInterval(() => { if (document.hidden) return; const t = (performance.now() - t0) / 1000; runTicks(t); tickIcons(t); }, 80);
addEventListener("pointerdown", () => unlock(), { once: true });

const PX = (d) => h("span", { class: "p-svg", "aria-hidden": "true", html: `<svg viewBox="0 0 ${d[0]} ${d[1]}" shape-rendering="crispEdges">${d[2]}</svg>` });
const BATTERY = [18, 10, '<path d="M1 0h14v1h1v2h2v4h-2v2h-1v1H1v-1H0V1h1zM1 1v8h14V1z" fill="currentColor"/><rect x="3" y="3" width="9" height="4" fill="currentColor"/>'];
const SIGNAL = [14, 10, '<rect x="0" y="7" width="2" height="3" fill="currentColor"/><rect x="4" y="5" width="2" height="5" fill="currentColor"/><rect x="8" y="3" width="2" height="7" fill="currentColor"/><rect x="12" y="0" width="2" height="10" fill="currentColor" opacity=".45"/>'];

/* ---------- status bar ---------- */
const clock = h("b", {});
$(".p-status").append(clock, h("span", { class: "p-os" }, "PixelOS"), h("span", { class: "p-ind" }, PX(SIGNAL), PX(BATTERY)));
const tick = () => (clock.textContent = fmtTime());
tick(); setInterval(tick, 20000);

/* ---------- home screen ---------- */
function tile(id) {
  const n = fs.node(id);
  const b = h("button", { type: "button", class: "p-app", "aria-label": n.name }, icon(n.icon, { size: 32, scale: 2 }), h("span", { class: "lbl" }, n.name));
  b.addEventListener("click", () => {
    b.classList.remove("hop"); void b.offsetWidth; b.classList.add("hop");
    // Terminal and Paint open a new window each time, so a tile brings back the one tucked away
    const away = (id === "terminal" || id === "paint") && winList().find((w) => w.app === id && w.min);
    if (away) away.restore(); else openNode(id, b);
  });
  return b;
}

// pixel me: codes on the laptop, waves when tapped
const me = h("canvas", { class: "px p-me", width: GW, height: GH + 2, "aria-hidden": "true" });
const mctx = me.getContext("2d");
let waveTill = 2.2, say = null;
onTick((t) => {
  mctx.clearRect(0, 0, GW, GH + 2);
  shadow(mctx, 18, GH, 12);
  const waving = t < waveTill;
  drawMe(mctx, 0, 0, waving
    ? { pose: "wave", f: Math.floor(t * 4), mouth: 2, shut: !reduce && t % 4.2 < 0.16 }
    : { pose: "laptop", f: Math.floor(t * 4), lid: 7, lookY: 1, shut: !reduce && t % 5 < 0.14 });
});
const bubble = h("div", { class: "p-say", hidden: true });
const meBtn = h("button", { type: "button", class: "p-mebtn", "aria-label": "Say hi to pixel Rohan" }, me, bubble);
const LINES = ["Hi! Tap any app.", "Flaggo is my favourite.", "There's real Doom in Play.", "Mail me, I reply fast."];
let li = 0;
meBtn.addEventListener("click", () => {
  waveTill = (performance.now() - t0) / 1000 + 2.2;
  bubble.textContent = LINES[li++ % LINES.length];
  bubble.hidden = false; announce(bubble.textContent);
  clearTimeout(say); say = setTimeout(() => (bubble.hidden = true), 2600);
});

// what I'm on now: one line at a time, tap for the next
const now = h("span", { class: "p-now-t" }, NOW[0]);
let ni = 0;
const nextNow = () => { now.classList.remove("in"); void now.offsetWidth; now.textContent = NOW[++ni % NOW.length]; now.classList.add("in"); announce(now.textContent); };

const link = (label, href, ic) => h("a", { class: "btn sm p-link", href, target: href.startsWith("mailto") ? null : "_blank", rel: "noopener" }, icon(ic, { size: 16, scale: 1, still: true }), label);

const hero = h("section", { class: "p-hero" },
  h("div", { class: "p-hero-top" }, meBtn,
    h("div", {}, h("h1", {}, "Rohan Ahire"), h("p", {}, "Full-stack engineer at Pattern. I build SaaS products, data pipelines and AI tools."))),
  h("button", { type: "button", class: "p-now", "aria-label": "What I'm working on now, tap for more", onclick: nextNow }, h("b", {}, "NOW"), now, h("i", { "aria-hidden": "true" }, "›")),
  h("div", { class: "p-links" }, link("Email", "mailto:" + EMAIL, "mail"), link("GitHub", LINKS.github, "web"), link("LinkedIn", LINKS.linkedin, "web"), link("Resume", "resume.pdf", "txt")));

const section = (title, ids) => [h("h2", { class: "p-sec" }, title), h("div", { class: "p-grid" }, ids.map(tile))];
const home = h("div", { class: "p-home" }, hero,
  ...section("My work", PROJECTS.map((p) => p.id)),
  ...section("Play", ["terminal", "paint", "mines", "doom", "tunes", "calc"]),
  h("a", { class: "p-desk", href: "./?desktop" }, "Open the desktop version"));
$("#desk").append(home);

/* ---------- dock: always there, Home tucks every open app away ---------- */
const dockBtn = (label, ic, fn) => {
  const b = h("button", { type: "button", class: "p-dk", "aria-label": label }, icon(ic, { size: 32, scale: 1 }), h("span", {}, label));
  b.addEventListener("click", () => fn(b));
  return b;
};
const goHome = () => {
  // a message box can't be tucked away, so it closes and its app goes behind it
  winList().filter((w) => !w.min && (w.modal || w.o?.minimizable === false)).forEach((w) => w.close());
  if (winList().some((w) => !w.min)) minimizeAll(); else home.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
};
const homeBtn = dockBtn("Home", "logo", goHome);
$(".p-dock").append(homeBtn,
  dockBtn("About", "txt", (b) => openNode("readme", b)),
  dockBtn("Mail", "mail", (b) => launch("mail", null, b)),
  dockBtn("Settings", "display", (b) => launch("settings", "background", b)));
bus.on("wins", () => homeBtn.classList.toggle("on", winList().some((w) => !w.min)));

/* ---------- Android back: an open app goes back to the home screen instead of leaving the site ---------- */
let armed = false;
bus.on("wins", () => { if (!armed && winList().some((w) => !w.min)) { armed = true; history.pushState(null, ""); } });
addEventListener("popstate", () => {
  armed = false;
  if (winList().some((w) => !w.min)) goHome(); else history.back();
});

/* ---------- keyboard: keep the app above it, so the field being typed in stays on screen ---------- */
const vv = window.visualViewport;
if (vv) {
  let open = false;
  const fit = () => {
    const kb = vv.scale < 1.05 && document.activeElement?.matches("input, textarea") ? innerHeight - vv.height - vv.offsetTop : 0;
    const was = open;
    open = kb > 100;
    document.body.classList.toggle("kb", open);
    document.documentElement.style.setProperty("--kb", (open ? kb : 0) + "px");
    if (was && !open) scrollTo(0, 0); // iOS can leave the page nudged up after the keyboard goes
  };
  vv.addEventListener("resize", fit); vv.addEventListener("scroll", fit);
  addEventListener("focusout", () => setTimeout(fit, 100));
}

// the address bar should say rohanahire.com, not /phone.html
history.replaceState(null, "", "./");
