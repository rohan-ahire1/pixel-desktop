// Pixel Navigator: a home page, a search engine for this computer, and real sites where they allow being framed.
import { h, bus, store, session, EMAIL, fmtDate } from "../core.js";
import { icon } from "../px.js";
import { openWindow, msgbox } from "../wm.js";
import { sfx } from "../sound.js";
import * as fs from "../fs.js";
import { launch, openNode } from "./index.js";
import { PROJECTS, NOW, LINKS } from "../data.js";

const HOME = "pixel://home";
// Most sites refuse to load inside another page. Rohan's own projects allow it, but only from these origins
// (their frame-ancestors header lists the same ones). Add ?embed to the URL to try anyway from somewhere else.
const EMBED_FROM = ["https://rohanahire.com", "https://www.rohanahire.com", "http://localhost:3104", "http://127.0.0.1:3104"];
const canEmbedHere = EMBED_FROM.includes(location.origin) || new URLSearchParams(location.search).has("embed");
const hostname = (u) => { try { return new URL(u).hostname; } catch { return ""; } };
export const projectFor = (u) => PROJECTS.find((p) => p.live && hostname(p.live) === hostname(u)) || null;
const framable = (u) => !!projectFor(u) && canEmbedHere;
const normal = (raw) => {
  const s = raw.trim();
  if (!s) return HOME;
  if (/^pixel:\/\//i.test(s)) return s.toLowerCase();
  if (/^https?:\/\//i.test(s)) return s;
  if (/^[\w-]+(\.[\w-]+)+(:\d+)?(\/\S*)?$/.test(s)) return "https://" + s;
  return "pixel://search?q=" + encodeURIComponent(s);
};
const hostOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u; } };

let visits = store.get("visits", 0);
if (!session.get("counted")) { visits++; store.set("visits", visits); session.set("counted", "1"); }

export function open(arg, from) {
  // "app:flaggo" (or a project's own address) opens that project as an app: its own window, name and icon
  let proj = typeof arg === "string" && arg.startsWith("app:") ? PROJECTS.find((p) => p.id === arg.slice(4) && p.live) : null;
  const startUrl = proj ? proj.live : typeof arg === "string" && arg && !arg.startsWith("app:") ? normal(arg) : HOME;
  proj = proj || projectFor(startUrl);
  const view = h("div", { class: "web", tabindex: "-1" });
  const bar = h("div", { class: "webload", "aria-hidden": "true" });
  const field = h("input", { class: "field", type: "text", "aria-label": "Address", spellcheck: "false", autocomplete: "off" });
  const fav = h("span", { "aria-hidden": "true" });
  const status = h("span", {}, "Done"), zone = h("span", { class: "fit" }, "Internet");
  const hist = [], fwd = [];
  let cur = null, timers = [], stopPull = () => {};
  const btn = (ic, label, fn, key) => h("button", { type: "button", class: "tbtn", "aria-label": label + (key ? ` (${key})` : ""), "data-tip": label + (key ? ` (${key})` : ""), onclick: fn }, icon(ic, { size: 16, scale: 1, still: true }), h("span", {}, label));
  const back = btn("info", "Back", () => go(-1), "Alt+←"), fore = btn("info", "Forward", () => go(1), "Alt+→");
  [back, fore].forEach((b, i) => { b.firstChild.replaceWith(h("span", { "aria-hidden": "true", html: `<svg width="16" height="16" viewBox="0 0 16 16" shape-rendering="crispEdges" fill="currentColor"><path d="${i ? "M2 7h8V5h2v1h1v1h1v2h-1v1h-1v1h-2V9H2z" : "M14 7H6V5H4v1H3v1H2v2h1v1h1v1h2V9h8z"}"/></svg>` })); });
  const reloadB = btn("info", "Reload", () => nav(cur, true), "F5");
  reloadB.firstChild.replaceWith(h("span", { "aria-hidden": "true", html: '<svg width="16" height="16" viewBox="0 0 16 16" shape-rendering="crispEdges" fill="currentColor"><path d="M5 2h6v2h2v2h-2V5H9V4H5v1H4v1H3v4h1v1h1v1h4v-1h2V9h2v3h-2v1H9v1H5v-1H3v-1H2v-2H1V5h1V4h1V3h2zM11 2h3v4h-1V3h-2z"/></svg>' }));
  const homeB = btn("computer", "Home", () => nav(HOME), "Alt+Home");
  homeB.firstChild.replaceWith(h("span", { "aria-hidden": "true", html: '<svg width="16" height="16" viewBox="0 0 16 16" shape-rendering="crispEdges" fill="currentColor"><path d="M7 1h2v1h1v1h1v1h1v1h1v1h1v1h1v2h-2v6H9v-4H7v4H3V9H1V7h1V6h1V5h1V4h1V3h1V2h1z"/></svg>' }));
  const aboutB = proj ? h("button", { type: "button", class: "btn", style: { minWidth: "0", padding: "2px 10px" }, onclick: () => launch("project", proj.id) }, `About ${proj.name}`) : null;
  const tabB = h("button", { type: "button", class: "btn", style: { minWidth: "0", padding: "2px 10px" }, onclick: () => cur && /^https?:/.test(cur) && window.open(cur, "_blank", "noopener") }, "Open in new tab");

  function setChrome() {
    back.disabled = !hist.length; fore.disabled = !fwd.length;
    field.value = cur;
    tabB.hidden = !/^https?:/.test(cur);
    zone.textContent = /^pixel:/.test(cur) ? "My Computer" : "Internet";
    fav.replaceChildren(icon(/^pixel:\/\/search/.test(cur) ? "find" : /^pixel:/.test(cur) ? "logo" : "web", { size: 16, scale: 1, still: true }));
  }
  function load(p = 1) { bar.style.transition = "none"; bar.style.width = "0"; bar.style.opacity = "1"; void bar.offsetWidth; bar.style.transition = "width .9s steps(8), opacity .3s"; bar.style.width = p * 100 + "%"; }
  const done = () => { bar.style.width = "100%"; timers.push(setTimeout(() => (bar.style.opacity = "0"), 250)); status.textContent = "Done"; };
  function go(d) {
    const from = d < 0 ? hist : fwd, to = d < 0 ? fwd : hist;
    if (!from.length) return;
    to.push(cur); nav(from.pop(), false, true);
  }
  function nav(url, reload, fromHist) {
    url = normal(url);
    if (cur && !reload && !fromHist && url !== cur) { hist.push(cur); fwd.length = 0; }
    cur = url; setChrome();
    timers.forEach(clearTimeout); timers = []; stopPull();
    view.replaceChildren(); view.scrollTop = 0; view.classList.remove("app");
    if (/^pixel:\/\/search/.test(url)) render(search(new URL(url.replace("pixel://", "http://x/")).searchParams.get("q") || ""), "Search");
    else if (url === HOME) render(homePage(), "Rohan's Home Page");
    else if (/^pixel:/.test(url)) render(notFound(url), "Page not found");
    else if (framable(url)) {
      const pr = projectFor(url);
      load(0.8); status.textContent = `Opening ${pr.name}…`;
      const fr = h("iframe", { src: url, title: pr.name, allow: "fullscreen; clipboard-read; clipboard-write; autoplay; web-share", referrerpolicy: "strict-origin-when-cross-origin" });
      const slow = h("p", { class: "slow", hidden: true }, "Taking longer than usual. ", h("button", { type: "button", class: "btn sm", onclick: () => window.open(url, "_blank", "noopener") }, "Open in a new tab"));
      const loader = h("div", { class: "apploader", role: "status" }, h("div", {}, icon(pr.icon, { size: 32, scale: 3 }), h("b", {}, pr.name), h("span", {}, `Starting ${pr.name}…`),
        h("div", { class: "bar", "aria-hidden": "true" }, ...Array.from({ length: 14 }, (_, i) => h("i", { style: { animationDelay: i * 0.07 + "s" } }))), slow));
      fr.addEventListener("load", () => { done(); loader.classList.add("gone"); setTimeout(() => loader.remove(), 400); });
      timers.push(setTimeout(() => (slow.hidden = false), 10000));
      // clicks inside the app never reach the desktop, so notice focus moving into it and bring this window forward
      const pull = () => setTimeout(() => { if (document.activeElement === fr && fr.isConnected) w.focus(false); }, 0);
      addEventListener("blur", pull); stopPull(); stopPull = () => removeEventListener("blur", pull);
      view.classList.add("app");
      view.append(fr, loader, bar); title(pr.name);
    } else {
      load(0.6); status.textContent = `Connecting to ${hostOf(url)}…`;
      timers.push(setTimeout(() => { render(blocked(url), projectFor(url)?.name || hostOf(url)); }, 450));
    }
  }
  function render(page, t) { view.replaceChildren(page, bar); done(); title(t); }
  const title = (t) => w.setTitle(proj && t === proj.name ? t : `${t} - Pixel Navigator`);
  const link = (label, url, extra = {}) => h("a", { href: /^https?:|^mailto:/.test(url) ? url : "#", "data-go": url, ...extra }, label);

  function homePage() {
    const counter = h("span", { style: { fontFamily: "var(--display)", background: "#000", color: "#ff3b3b", padding: "1px 6px", letterSpacing: ".15em" } }, String(visits).padStart(6, "0"));
    return h("div", { class: "home" },
      h("h1", {}, "Rohan's Home Page"),
      h("p", { style: { margin: 0 } }, "Builder of trading systems, games and AI tools. Welcome, traveller!"),
      h("div", { class: "marq", "aria-hidden": "true" }, h("span", {}, NOW.map((n) => `★ ${n}`).join("     ") + "     ★ Thanks for stopping by!")),
      h("h2", {}, "My projects"),
      h("ul", {}, ...PROJECTS.map((p) => h("li", {}, icon(p.icon, { size: 16, scale: 1, still: true }),
        h("span", {}, link(p.name, "pixel://open/" + p.id), ` — ${p.sum} `, p.live ? h("small", {}, "(runs here)") : null)))),
      h("h2", {}, "Cool links"),
      h("ul", {},
        h("li", {}, icon("folder", { size: 16, scale: 1, still: true }), link("GitHub", LINKS.github), " — the code"),
        h("li", {}, icon("info", { size: 16, scale: 1, still: true }), link("LinkedIn", LINKS.linkedin), " — the career bits"),
        h("li", {}, icon("mail", { size: 16, scale: 1, still: true }), link("Email me", "pixel://mail"), ` — ${EMAIL}`)),
      h("h2", {}, "Search this computer"),
      (() => { const q = h("input", { class: "field", type: "search", "aria-label": "Search this computer", placeholder: "Try: chess, python, trading" }); const f = h("form", { style: { display: "flex", gap: "6px", maxWidth: "420px" }, onsubmit: (e) => { e.preventDefault(); nav("pixel://search?q=" + encodeURIComponent(q.value)); } }, q, h("button", { type: "submit", class: "btn" }, "Search")); return f; })(),
      h("h2", {}, "PixelRing"),
      h("p", { style: { margin: 0 } }, link("« Prev", "pixel://ring/prev"), " | ", link("Random project", "pixel://ring/random"), " | ", link("Next »", "pixel://ring/next")),
      h("p", { style: { marginTop: "22px" } }, "Visitor counter: ", counter, h("span", { style: { fontSize: "12px", color: "var(--chrome-dd)" } }, "  (your visits, on this computer)")),
      h("div", { class: "badge" }, ...["Made with plain JS", "No cookies", "Best viewed at 1366×768", "Built solo"].map((s) => h("span", {}, s))),
      h("p", { style: { fontSize: "12px", color: "var(--chrome-dd)", marginTop: "18px" } }, `Today is ${fmtDate(new Date())}.`));
  }
  function search(q) {
    const res = fs.search(q);
    const box = h("input", { class: "field", type: "search", value: q, "aria-label": "Search this computer" });
    return h("div", { class: "home" },
      h("h1", {}, h("span", { style: { color: "#0b2fa8" } }, "Pixel"), h("span", { style: { color: "#d9534f" } }, "Search")),
      h("form", { style: { display: "flex", gap: "6px", margin: "10px 0 18px" }, onsubmit: (e) => { e.preventDefault(); nav("pixel://search?q=" + encodeURIComponent(box.value)); } }, box, h("button", { type: "submit", class: "btn" }, "Search")),
      q ? h("p", { style: { color: "var(--chrome-dd)" } }, `${res.length} result${res.length === 1 ? "" : "s"} for “${q}” on this computer`) : null,
      res.length ? h("ul", { style: { gap: "14px" } }, ...res.slice(0, 30).map((n) => h("li", { style: { alignItems: "flex-start" } }, icon(n.icon, { size: 16, scale: 1, still: true }),
        h("div", {}, link(n.name, "pixel://open/" + n.id), h("div", { style: { fontSize: "12.5px", color: "#1f6f4c" } }, fs.pathOf(n.id)), h("div", { style: { fontSize: "13px" } }, n.snip || n.desc || "")))))
        : q ? h("p", {}, "No matches. Try a project name, a language, or a tool.") : null,
      q && !res.length ? h("p", {}, "Looking for the wider web? ", link(`Search “${q}” on DuckDuckGo`, "https://duckduckgo.com/?q=" + encodeURIComponent(q))) : null);
  }
  function blocked(url) {
    const pr = projectFor(url);
    bus.emit("me:react", "blocked");
    if (pr) return h("div", { class: "blocked" }, h("div", {}, icon(pr.icon, { size: 32, scale: 3 }),
      h("h2", {}, `${pr.name} runs right here on rohanahire.com`),
      h("p", {}, `On rohanahire.com, ${pr.name} opens inside this window and works like normal. This copy of the desktop lives somewhere else, so it opens in a new tab instead.`),
      h("div", { class: "btnrow", style: { justifyContent: "center" } },
        h("button", { type: "button", class: "btn def", onclick: () => window.open(url, "_blank", "noopener") }, `Open ${pr.name}`),
        h("button", { type: "button", class: "btn", onclick: () => launch("project", pr.id) }, `About ${pr.name}`))));
    const pic = icon("web", { size: 32, scale: 2, still: true });
    return h("div", { class: "blocked" }, h("div", {}, pic,
      h("h2", {}, `${hostOf(url)} won't open in here`),
      h("p", {}, "This site doesn't allow being shown inside another page. That's a sensible security setting, not a broken link. Open it in a real tab instead."),
      h("div", { class: "btnrow", style: { justifyContent: "center" } },
        h("button", { type: "button", class: "btn def", onclick: () => window.open(url, "_blank", "noopener") }, "Open in a new tab"),
        h("button", { type: "button", class: "btn", onclick: () => (hist.length ? go(-1) : nav(HOME)) }, hist.length ? "Go back" : "Home page"))));
  }
  function notFound(url) {
    return h("div", { class: "blocked" }, h("div", {}, icon("question", { size: 32, scale: 2, still: true }), h("h2", {}, "404: nothing here"), h("p", {}, `${url} doesn't exist on this computer.`), h("button", { type: "button", class: "btn", onclick: () => nav(HOME) }, "Home page")));
  }

  // links: internal ones drive the OS, external ones navigate this window
  view.addEventListener("click", (e) => {
    const a = e.target.closest("a[data-go]"); if (!a) return;
    const u = a.dataset.go;
    if (/^mailto:/.test(u)) return;
    e.preventDefault();
    if (e.ctrlKey || e.metaKey || e.button === 1) { if (/^https?:/.test(u)) window.open(u, "_blank", "noopener"); return; }
    sfx("click");
    const m = /^pixel:\/\/(\w+)\/?(.*)$/.exec(u);
    if (m && m[1] === "project") return launch("project", m[2], a);
    if (m && m[1] === "open") return openNode(decodeURIComponent(m[2]), a);
    if (m && m[1] === "mail") return launch("mail", null, a);
    if (m && m[1] === "ring") {
      const i = PROJECTS.findIndex((p) => p.id === store.get("ring", PROJECTS[0].id)), n = PROJECTS.length;
      const j = m[2] === "next" ? (i + 1) % n : m[2] === "prev" ? (i - 1 + n) % n : Math.floor(Math.random() * n);
      store.set("ring", PROJECTS[j].id); return openNode(PROJECTS[j].id, a);
    }
    nav(u);
  });
  view.addEventListener("mouseover", (e) => { const a = e.target.closest("a[data-go]"); status.textContent = a ? a.dataset.go : "Done"; });

  const w = openWindow({
    id: proj ? "browser:" + proj.id : "browser", posKey: proj ? "browser-app" : "browser", title: proj ? proj.name : "Pixel Navigator", icon: proj ? proj.icon : "web", app: "browser",
    w: proj ? 1180 : 820, h: proj ? 780 : 580, minW: 340, minH: 300, from, bodyClass: "",
    onReopen: (ew) => { if (!proj && typeof arg === "string" && arg && ew.nav) ew.nav(arg); },
    onClose: () => { timers.forEach(clearTimeout); stopPull(); },
    menubar: [
      { label: "File", items: () => [
        { label: "Open Location…", kbd: "Ctrl+L", action: () => { field.focus(); field.select(); } },
        { label: "Open in New Tab", disabled: !/^https?:/.test(cur), action: () => window.open(cur, "_blank", "noopener") },
        { sep: true },
        { label: "Close", kbd: "Alt+F4", action: () => w.close() },
      ] },
      { label: "Go", items: () => [
        { label: "Back", kbd: "Alt+←", disabled: !hist.length, action: () => go(-1) },
        { label: "Forward", kbd: "Alt+→", disabled: !fwd.length, action: () => go(1) },
        { label: "Home", kbd: "Alt+Home", action: () => nav(HOME) },
        { label: "Search", action: () => nav("pixel://search") },
      ] },
      { label: "Bookmarks", items: () => [
        { label: "Rohan's Home Page", icon: "logo", action: () => nav(HOME) },
        ...PROJECTS.filter((p) => p.live).map((p) => ({ label: p.name, icon: p.icon, action: () => launch("browser", "app:" + p.id) })),
        { label: "GitHub", icon: "web", action: () => nav(LINKS.github) },
        { label: "LinkedIn", icon: "web", action: () => nav(LINKS.linkedin) },
      ] },
      { label: "Help", items: () => [
        { label: "About Pixel Navigator", action: () => msgbox({ title: "Pixel Navigator", icon: "web", parent: w, text: "Version 1.0 (pixel)\nType a word to search this computer, or a web address to visit it.\nRohan's projects run right inside it. Most other sites block being shown inside other pages, so they open in a new tab." }) },
        { label: "Help Topics", icon: "help", kbd: "F1", action: () => launch("help", "programs") },
      ] },
    ],
    build(w) {
      field.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); nav(field.value); view.focus({ preventScroll: true }); } else if (e.key === "Escape") { field.value = cur; field.select(); e.stopPropagation(); } });
      field.addEventListener("focus", () => field.select());
      const goB = h("button", { type: "button", class: "btn", style: { minWidth: "0", padding: "2px 10px" }, onclick: () => nav(field.value) }, "Go");
      w.body.append(
        h("div", { class: "toolbar", style: { borderTop: "0", boxShadow: "none", marginTop: "0" } }, back, fore, reloadB, homeB,
          h("div", { class: "addr" }, h("label", { style: { fontSize: "13.5px" }, for: "nav-addr" }, "Address"), h("span", { class: "ai" }, fav, field), goB), aboutB, tabB),
        view);
      field.id = "nav-addr";
      w.el.append(w.statusbar(status, zone));
    },
  });
  if (w._built) return w;
  w._built = true;
  w.nav = nav;
  w.el.addEventListener("keydown", (e) => {
    const mod = e.ctrlKey || e.metaKey;
    if (e.altKey && e.key === "ArrowLeft") { e.preventDefault(); go(-1); }
    else if (e.altKey && e.key === "ArrowRight") { e.preventDefault(); go(1); }
    else if (e.altKey && e.key === "Home") { e.preventDefault(); nav(HOME); }
    else if (e.key === "F5" || (mod && e.key.toLowerCase() === "r")) { e.preventDefault(); nav(cur, true); }
    else if (mod && e.key.toLowerCase() === "l") { e.preventDefault(); field.focus(); field.select(); }
  });
  nav(startUrl);
  return w;
}
