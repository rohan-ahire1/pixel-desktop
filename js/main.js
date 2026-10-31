// PixelOS start-up: wire the shell together, run the shared ticker, and handle system-wide keys.
import { h, $, bus, settings, runTicks, announce } from "./core.js";
import { installCursors, tickIcons, icon } from "./px.js";
import { applyScheme } from "./theme.js";
import { initWallpaper } from "./wallpaper.js";
import { initDesktop } from "./desktop.js";
import { initTaskbar, toggleStart } from "./taskbar.js";
import { initMe } from "./me.js";
import { initInbox } from "./inbox.js";
import { boot, initPower } from "./boot.js";
import { list as winList, active, minimizeAll } from "./wm.js";
import { menuOpen } from "./menu.js";
import { launch } from "./apps/index.js";

installCursors();
applyScheme(settings.scheme);
bus.on("settings", (p) => { if ("scheme" in p) applyScheme(p.scheme); });
initWallpaper($("#bg"));

// one shared clock for every animated canvas (~12.5 fps, the pixel-art frame rate); paused when the tab is hidden
const t0 = performance.now();
setInterval(() => { if (document.hidden) return; const t = (performance.now() - t0) / 1000; runTicks(t); tickIcons(t); }, 80);

initDesktop();
initTaskbar();
initMe();
initInbox();
const welcome = () => (settings.welcome !== false ? launch("welcome") : null);
initPower({ onReady: () => { bus.emit("shell:ready"); welcome(); } });
boot(welcome).then(() => bus.emit("shell:ready"));

/* ---------- window switcher (Alt+Tab, or Alt+` where the browser keeps Alt+Tab) ---------- */
let sw = null;
function order() { return winList().filter((w) => !w.modal).sort((a, b) => (+b.el.style.zIndex - +a.el.style.zIndex) - (a.min - b.min) * 1e6); }
function showSwitcher(step) {
  if (!sw) {
    const ws = order();
    if (ws.length < 2 && !(ws.length === 1 && ws[0].min)) { if (ws[0]) ws[0].focus(); return; }
    sw = { ws, i: 0, el: h("div", { class: "switcher", role: "listbox", "aria-label": "Switch windows" }) };
    const row = h("div", { class: "sw-row" }), lbl = h("div", { class: "sw-lbl" });
    sw.items = ws.map((w) => { const b = h("div", { class: "sw-i", role: "option", "aria-label": w.title }, icon(w.icon, { size: 32, scale: 1, still: true })); row.append(b); return b; });
    sw.lbl = lbl;
    sw.el.append(row, lbl);
    document.body.append(sw.el);
  }
  sw.i = (sw.i + step + sw.ws.length) % sw.ws.length;
  sw.items.forEach((b, j) => b.setAttribute("aria-selected", String(j === sw.i)));
  sw.lbl.textContent = sw.ws[sw.i].title;
  announce(sw.ws[sw.i].title);
}
function endSwitcher(go) {
  if (!sw) return;
  const w = sw.ws[sw.i];
  sw.el.remove(); sw = null;
  if (go && w && winList().includes(w)) (w.min ? w.restore() : w.focus());
}

/* ---------- system keys ---------- */
const mac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
let metaAlone = false;
addEventListener("keydown", (e) => {
  if ($(".overlay")) return;
  const k = e.key;
  if (k === "Meta" || k === "OS") { metaAlone = !e.repeat; return; }
  metaAlone = false;
  if (sw) {
    if (k === "Tab" || k === "`") { e.preventDefault(); showSwitcher(e.shiftKey ? -1 : 1); return; }
    if (k === "Escape") { e.preventDefault(); endSwitcher(false); return; }
  }
  if (e.altKey && (k === "Tab" || k === "`" || e.code === "Backquote") && !e.ctrlKey && !e.metaKey) { e.preventDefault(); showSwitcher(e.shiftKey ? -1 : 1); return; }
  if (e.ctrlKey && !e.shiftKey && k === "Escape") { e.preventDefault(); e.stopPropagation(); toggleStart(true); return; }
  if (k === "F1") { e.preventDefault(); launch("help"); return; }
  if (e.altKey && k === "F4") { e.preventDefault(); const w = active(); if (w) w.close(); else bus.emit("shell:shutdown"); return; }
  if ((e.metaKey && !mac || e.ctrlKey && e.altKey) && (k === "d" || k === "D")) { e.preventDefault(); minimizeAll(); return; }
  if ((e.ctrlKey && e.shiftKey && k === "Escape") || (e.ctrlKey && e.altKey && (k === "Delete" || k === "Backspace"))) { e.preventDefault(); launch("taskman"); return; }
  if ((e.metaKey && !mac || e.ctrlKey && e.altKey) && (k === "r" || k === "R") && !e.shiftKey) { e.preventDefault(); launch("run"); return; }
  if ((e.metaKey && !mac || e.ctrlKey && e.altKey) && (k === "e" || k === "E")) { e.preventDefault(); launch("explorer", "computer"); return; }
  if (k === "F3" && !e.target.closest?.(".win")) { e.preventDefault(); launch("find"); }
}, true);
addEventListener("keyup", (e) => {
  if (sw && (e.key === "Alt" || !e.altKey)) endSwitcher(true);
  if ((e.key === "Meta" || e.key === "OS") && metaAlone && !mac && !menuOpen() && !$(".overlay")) toggleStart(true);
  metaAlone = false;
}, true);
addEventListener("blur", () => endSwitcher(false));
document.addEventListener("pointerdown", () => { metaAlone = false; }, true);

