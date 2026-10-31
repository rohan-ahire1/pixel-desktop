// The taskbar: Start menu, quick launch, window buttons, tray (music, mail, Rohan, network, battery, volume, clock),
// plus the shared tooltip and notification balloons.
import { h, $, bus, settings, setSettings, fmtTime, fmtDate, clamp, announce, reduce } from "./core.js";
import { icon, iconName, iconRedraw, iconState } from "./px.js";
import { openMenu, closeMenus } from "./menu.js";
import { sfx } from "./sound.js";
import { list, active, minimizeAll, canUndoMin, cascadeWins, tileWins } from "./wm.js";
import { launch, openNode } from "./apps/index.js";
import * as fs from "./fs.js";
import { PROJECTS } from "./data.js";
import { unread } from "./inbox.js";

let bar, startBtn, tasks, tray, clockBtn;
const X_SVG = '<svg width="8" height="8" viewBox="0 0 8 8" shape-rendering="crispEdges" aria-hidden="true"><path fill="#10132e" d="M0 0h2v1h1v1h2V1h1V0h2v2H7v1H6v2h1v1h1v2H6V7H5V6H3v1H2v1H0V6h1V5h1V3H1V2H0z"/></svg>';

/* ---------- Start menu ---------- */
const nodeItem = (id) => { const n = fs.node(id); return n && { label: n.name, icon: n.icon, action: () => openNode(id, startBtn) }; };
function startItems() {
  const docs = fs.children("documents");
  return [
    { label: "Programs", icon: "folderApp", sub: () => [
      ...["welcome", "reel", "notepad", "paint", "terminal", "tunes", "calc", "browser", "mail"].map(nodeItem),
      { label: "Games", icon: "folder", sub: [nodeItem("doom"), nodeItem("mines")] },
      { label: "Pixel Rohan", icon: "me", action: () => bus.emit("me:call") },
      { label: "System Tools", icon: "folder", sub: [nodeItem("taskman"), nodeItem("system"), nodeItem("find")] },
      { sep: true },
      nodeItem("computer"),
    ] },
    { label: "Projects", icon: "folderStar", sub: () => [...PROJECTS.map((p) => nodeItem(p.id)), { sep: true }, { label: "Open the Projects folder", icon: "folder", action: () => openNode("projects", startBtn) }] },
    { label: "Documents", icon: "folder", sub: () => [
      ...docs.slice(0, 10).map((n) => nodeItem(n.id)),
      { sep: true },
      { label: "My Documents", icon: "folder", action: () => openNode("documents", startBtn) },
    ] },
    { label: "Settings", icon: "control", sub: () => [
      nodeItem("control"),
      { sep: true },
      nodeItem("display"), nodeItem("soundcp"), nodeItem("mecp"),
      { label: "Taskbar & Start Menu", icon: "system", action: () => launch("settings", "appearance", startBtn) },
    ] },
    { label: "Find", icon: "find", action: () => launch("find", null, startBtn) },
    { label: "Help", icon: "help", action: () => launch("help", null, startBtn) },
    { label: "Run…", icon: "run", action: () => launch("run", null, startBtn) },
    { sep: true },
    { label: "Mail Rohan", icon: "mail", action: () => launch("mail", null, startBtn) },
    { label: "Shut Down…", icon: "power", action: () => bus.emit("shell:shutdown") },
  ];
}
export function toggleStart(viaKey = false) {
  if (startBtn.getAttribute("aria-expanded") === "true") { closeMenus(true); return; }
  startBtn.setAttribute("aria-expanded", "true");
  hideTip();
  openMenu(startItems(), {
    anchor: startBtn, below: "up", cls: "start", label: "Start", owner: startBtn, focusFirst: viaKey, restoreFocus: startBtn,
    band: "<span>ROHAN <b>AHIRE</b></span>",
    onClose: () => startBtn.setAttribute("aria-expanded", "false"),
  });
}

/* ---------- window buttons ---------- */
const btnFor = new Map();
function renderTasks() {
  const ws = list().filter((w) => !w.modal).sort((a, b) => a.created - b.created);
  const act = active();
  const seen = new Set();
  for (const w of ws) {
    seen.add(w.id);
    let b = btnFor.get(w.id);
    if (!b) {
      b = h("button", { type: "button", class: "task new", "data-id": w.id });
      b._icon = icon(w.icon, { size: 16, scale: 1 });
      b._lbl = h("span");
      b.append(b._icon, b._lbl);
      b.addEventListener("click", () => {
        if (w.min) w.restore();
        else if (active() === w && !w.child) w.minimize();
        else w.focus();
      });
      b.addEventListener("auxclick", (e) => { if (e.button === 1) { e.preventDefault(); w.close(); } });
      b.addEventListener("contextmenu", (e) => { e.preventDefault(); e.stopPropagation(); w.sysmenu(b, { x: e.clientX, y: e.clientY }); });
      // dragging a file over a button brings its window up, like the real thing
      let dt = 0;
      b.addEventListener("dragenter", () => { clearTimeout(dt); dt = setTimeout(() => w.focus(), 600); });
      b.addEventListener("dragleave", () => clearTimeout(dt));
      setTimeout(() => b.classList.remove("new"), 260);
      btnFor.set(w.id, b);
    }
    b._lbl.textContent = w.title;
    iconName(b._icon, w.icon);
    b.title = "";
    b.setAttribute("data-tip", w.title);
    b.setAttribute("aria-label", w.title + (w.min ? " (minimized)" : ""));
    b.setAttribute("aria-pressed", String(act === w && !w.min));
    b.classList.toggle("active", (act === w || act?.modal === w) && !w.min);
    b.classList.toggle("min", w.min);
    tasks.append(b); // keeps order
  }
  for (const [id, b] of btnFor) if (!seen.has(id)) { b.remove(); btnFor.delete(id); }
}

function barMenu(x, y) {
  const any = list().some((w) => !w.modal);
  openMenu([
    { label: "Cascade Windows", disabled: !any, action: cascadeWins },
    { label: "Tile Windows Horizontally", disabled: !any, action: () => tileWins(false) },
    { label: "Tile Windows Vertically", disabled: !any, action: () => tileWins(true) },
    { sep: true },
    canUndoMin() ? { label: "Undo Minimize All", action: minimizeAll } : { label: "Minimize All Windows", disabled: !any, action: minimizeAll },
    { sep: true },
    { label: "Task Manager", icon: "system", action: () => launch("taskman", null) },
    { label: "Properties", action: () => launch("settings", "appearance") },
  ], { x, y });
}

/* ---------- tray ---------- */
let flyout = null;
function closeFly(focus = true) {
  if (!flyout) return;
  const { el, btn, cleanup } = flyout;
  flyout = null;
  cleanup();
  el.remove();
  btn.setAttribute("aria-expanded", "false");
  document.removeEventListener("pointerdown", flyOutside, true);
  if (focus) btn.focus({ preventScroll: true });
}
const flyOutside = (e) => { if (flyout && !flyout.el.contains(e.target) && !flyout.btn.contains(e.target)) closeFly(false); };
function openFly(btn, build) {
  if (flyout && flyout.btn === btn) { closeFly(); return; }
  closeFly(false);
  closeMenus(false);
  hideTip();
  const el = h("div", { class: "flyout", role: "dialog", "aria-label": btn.getAttribute("aria-label") });
  const cleanup = build(el) || (() => {});
  document.body.append(el);
  const r = btn.getBoundingClientRect(), fw = el.offsetWidth;
  el.style.right = "auto";
  el.style.left = clamp(r.right - fw + 6, 4, innerWidth - fw - 4) + "px";
  btn.setAttribute("aria-expanded", "true");
  flyout = { el, btn, cleanup };
  el.addEventListener("keydown", (e) => { if (e.key === "Escape") { e.stopPropagation(); closeFly(); } });
  (el.querySelector("input,button") || el).focus({ preventScroll: true });
  document.addEventListener("pointerdown", flyOutside, true);
  sfx("menu");
}

function trayBtn(cls, name, label, onclick) {
  const cv = icon(name, { size: 16, scale: 1 });
  const b = h("button", { type: "button", class: "trb " + cls, "aria-label": label, "data-tip": label, onclick }, cv);
  b._cv = cv;
  return b;
}
const setTip = (b, s) => { b.setAttribute("data-tip", s); b.setAttribute("aria-label", s); };

function volFly(el) {
  const range = h("input", { type: "range", min: "0", max: "100", step: "1", "aria-label": "Volume", value: String(Math.round(settings.volume * 100)) });
  const mute = h("input", { type: "checkbox", id: "fly-mute" });
  mute.checked = !settings.sound;
  let last = 0;
  range.addEventListener("input", () => {
    setSettings({ volume: range.value / 100, sound: range.value > 0 ? true : settings.sound });
    mute.checked = !settings.sound;
    const now = performance.now();
    if (now - last > 140) { last = now; sfx("click"); }
  });
  range.addEventListener("change", () => sfx("ding"));
  mute.addEventListener("change", () => setSettings({ sound: !mute.checked }));
  el.append(h("div", { class: "vol" }, h("span", {}, "Volume"), range, h("label", { class: "check", for: "fly-mute" }, mute, " Mute")));
}

function calFly(el) {
  const now = new Date();
  let y = now.getFullYear(), m = now.getMonth();
  const big = h("div", { class: "big", "aria-hidden": "true" }), day = h("div", { class: "day" }, fmtDate(now));
  const title = h("span", { "aria-live": "polite" });
  const tbl = h("table", { role: "grid" });
  const prev = h("button", { type: "button", class: "btn", "aria-label": "Previous month", onclick: () => { if (--m < 0) { m = 11; y--; } draw(); } });
  const next = h("button", { type: "button", class: "btn nx", "aria-label": "Next month", onclick: () => { if (++m > 11) { m = 0; y++; } draw(); } });
  const tick = () => { big.textContent = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" }); };
  function draw() {
    title.textContent = new Date(y, m, 1).toLocaleDateString([], { month: "long", year: "numeric" });
    const first = new Date(y, m, 1), start = (first.getDay() + 6) % 7, days = new Date(y, m + 1, 0).getDate(), pdays = new Date(y, m, 0).getDate();
    const t = new Date();
    tbl.replaceChildren(h("tr", {}, ...["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((d) => h("th", { scope: "col" }, d))));
    let d = 1 - start;
    for (let r = 0; r < 6; r++) {
      const tr = h("tr");
      for (let c = 0; c < 7; c++, d++) {
        const inM = d >= 1 && d <= days, n = inM ? d : d < 1 ? pdays + d : d - days;
        const today = inM && t.getFullYear() === y && t.getMonth() === m && t.getDate() === d;
        tr.append(h("td", { class: inM ? (today ? "today" : null) : "out", "aria-current": today ? "date" : null }, String(n)));
      }
      tbl.append(tr);
    }
  }
  tick(); draw();
  const iv = setInterval(tick, 1000);
  el.append(h("div", { class: "cal" }, big, day, h("div", { class: "mhead" }, prev, title, next), tbl,
    h("div", { class: "btnrow", style: { marginTop: "10px" } }, h("button", { type: "button", class: "btn sm", onclick: () => { y = now.getFullYear(); m = now.getMonth(); draw(); } }, "Today"))));
  return () => clearInterval(iv);
}

function buildTray() {
  const tunesB = trayBtn("tunes", "tunes", "Tunes", () => launch("tunes", null));
  tunesB.hidden = true;
  bus.on("music", (m) => { tunesB.hidden = !m.playing; setTip(tunesB, m.playing ? `Now playing: ${m.title}` : "Tunes"); });

  const mailB = trayBtn("mail", "mail", "Mail", () => launch("mail", "inbox"));
  const badge = h("span", { class: "badge", "aria-hidden": "true" });
  mailB.append(badge);
  const mailN = () => { const n = unread(); badge.textContent = n > 9 ? "9+" : String(n); badge.hidden = !n; const t = n ? `Mail: ${n} unread message${n === 1 ? "" : "s"}` : "Mail: no new messages"; setTip(mailB, t); };
  mailN();
  bus.on("mail:changed", mailN);
  bus.on("mail:new", () => { if (reduce) return; mailB.classList.remove("bounce"); void mailB.offsetWidth; mailB.classList.add("bounce"); });

  const meB = trayBtn("me", "me", "Pixel Rohan", () => bus.emit("me:call"));
  meB.addEventListener("contextmenu", (e) => { e.preventDefault(); bus.emit("me:menu", { x: e.clientX, y: e.clientY }); });
  const meShow = () => (meB.hidden = !settings.me);
  meShow();
  bus.on("me:status", (s) => setTip(meB, `Rohan is ${s}. Click to call me over, right-click for more.`));

  const netB = trayBtn("net", navigator.onLine ? "net" : "netOff", "", () => {
    const c = navigator.connection;
    bus.emit("notify", navigator.onLine
      ? { title: "Connected", text: `You're online${c?.effectiveType ? ` (${c.effectiveType.toUpperCase()}${c.downlink ? `, about ${c.downlink} Mbps` : ""})` : ""}. Live projects will load.`, icon: "net" }
      : { title: "Offline", text: "No connection. The desktop still works. Live projects need the internet.", icon: "netOff" });
  });
  const net = () => { iconName(netB._cv, navigator.onLine ? "net" : "netOff"); setTip(netB, navigator.onLine ? "Connected to the internet" : "Offline"); };
  net();
  addEventListener("online", () => { net(); bus.emit("notify", { title: "Back online", text: "Your connection is back.", icon: "net" }); });
  addEventListener("offline", () => { net(); bus.emit("notify", { title: "Connection lost", text: "You're offline. Everything here still works.", icon: "netOff" }); });

  const batB = trayBtn("bat", "battery", "Battery", () => {
    const b = iconState.battery;
    if (b) bus.emit("notify", { title: "Battery", text: `${Math.round(b.level * 100)}% ${b.charging ? "and charging" : "remaining"}.`, icon: "battery" });
  });
  batB.hidden = true;
  navigator.getBattery?.().then((bat) => {
    let warned = false;
    const upd = () => {
      iconState.battery = { level: bat.level, charging: bat.charging };
      batB.hidden = false;
      setTip(batB, `${Math.round(bat.level * 100)}% ${bat.charging ? "(charging)" : "remaining"}`);
      iconRedraw(batB._cv);
      if (!bat.charging && bat.level <= 0.15 && !warned) { warned = true; bus.emit("notify", { title: "Battery is low", text: `${Math.round(bat.level * 100)}% left. You might want to plug in.`, icon: "warn" }); }
      if (bat.charging) warned = false;
    };
    upd();
    bat.addEventListener("levelchange", upd);
    bat.addEventListener("chargingchange", upd);
  }).catch(() => {});

  const volB = trayBtn("vol", settings.sound ? "sound" : "soundOff", "Volume", () => openFly(volB, volFly));
  volB.setAttribute("aria-haspopup", "dialog");
  volB.addEventListener("dblclick", () => { closeFly(false); launch("settings", "sound"); });
  const vol = () => { const on = settings.sound && settings.volume > 0; iconName(volB._cv, on ? "sound" : "soundOff"); setTip(volB, on ? `Volume: ${Math.round(settings.volume * 100)}%` : "Muted"); };
  vol();

  clockBtn = h("button", { type: "button", class: "clock", "aria-haspopup": "dialog", onclick: () => openFly(clockBtn, calFly) });
  const clock = () => { clockBtn.textContent = fmtTime(); setTip(clockBtn, fmtDate()); };
  clock();
  let lastMin = new Date().getMinutes();
  setInterval(() => { const mm = new Date().getMinutes(); if (mm !== lastMin) { lastMin = mm; clock(); } }, 1000);

  bus.on("settings", (p) => { if ("sound" in p || "volume" in p) vol(); if ("me" in p) meShow(); });
  tray.append(tunesB, mailB, meB, netB, batB, volB, clockBtn);
}

/* ---------- tooltip ---------- */
let tipEl = null, tipT = 0, tipFor = null;
function hideTip() { clearTimeout(tipT); tipFor = null; tipEl?.remove(); tipEl = null; }
function showTip(el, x, y) {
  const txt = el.getAttribute("data-tip");
  if (!txt || !el.isConnected) return;
  tipEl?.remove();
  tipEl = h("div", { class: "tip", role: "tooltip" }, txt);
  document.body.append(tipEl);
  const w = tipEl.offsetWidth, hh = tipEl.offsetHeight;
  let L = x + 2, T = y + 20;
  if (T + hh > innerHeight - 4) T = y - hh - 8;
  tipEl.style.left = clamp(L, 4, innerWidth - w - 4) + "px";
  tipEl.style.top = clamp(T, 4, innerHeight - hh - 4) + "px";
}
function initTips() {
  let px = 0, py = 0;
  document.addEventListener("pointermove", (e) => { px = e.clientX; py = e.clientY; }, { passive: true });
  document.addEventListener("pointerover", (e) => {
    if (e.pointerType === "touch") return;
    const el = e.target.closest?.("[data-tip]");
    if (el === tipFor) return;
    hideTip();
    if (!el || el.classList.contains("dragging") || document.querySelector(".menu")) return;
    tipFor = el;
    tipT = setTimeout(() => { if (tipFor === el) showTip(el, px, py); }, el.closest(".taskbar") ? 500 : 900);
  });
  document.addEventListener("pointerout", (e) => { if (tipFor && !tipFor.contains(e.relatedTarget)) hideTip(); });
  for (const ev of ["pointerdown", "keydown", "wheel"]) document.addEventListener(ev, hideTip, { capture: true, passive: true });
}

/* ---------- balloons ---------- */
let balloons;
export function notify({ title, text, icon: ic = "info", action, timeout = 8000, silent = false }) {
  balloons ||= document.body.appendChild(h("div", { class: "balloons" }));
  while (balloons.children.length >= 3) balloons.firstChild.remove();
  const close = h("button", { type: "button", class: "bx", "aria-label": "Dismiss", html: X_SVG });
  const b = h("div", { class: "balloon", role: "status" }, h("b", {}, icon(ic, { size: 16, scale: 1, still: true }), title), h("div", {}, text), close);
  if (action) { b.style.cursor = "var(--cur-hand, pointer)"; b.addEventListener("click", (e) => { if (!close.contains(e.target)) { action(); go(); } }); }
  let t = 0, gone = false;
  const go = () => {
    if (gone) return;
    gone = true; clearTimeout(t);
    if (reduce) { b.remove(); return; }
    b.classList.add("out");
    setTimeout(() => b.remove(), 170);
  };
  const arm = () => { clearTimeout(t); t = setTimeout(go, timeout); };
  close.addEventListener("click", (e) => { e.stopPropagation(); go(); });
  b.addEventListener("pointerenter", () => clearTimeout(t));
  b.addEventListener("pointerleave", arm);
  balloons.append(b);
  arm();
  if (!silent) sfx("notify");
  announce(`${title}. ${text}`);
  return go;
}

/* ---------- build ---------- */
export function initTaskbar() {
  startBtn = h("button", { type: "button", class: "startbtn", "aria-haspopup": "menu", "aria-expanded": "false", "aria-label": "Start", "data-tip": "Click here to begin." },
    icon("logo", { size: 16, scale: 1 }), h("span", {}, "Start"));
  startBtn.addEventListener("pointerdown", (e) => { if (e.button === 0) { e.preventDefault(); toggleStart(false); } });
  startBtn.addEventListener("click", (e) => { if (e.detail === 0) toggleStart(true); });

  const ql = h("div", { class: "ql", role: "group", "aria-label": "Quick launch" },
    ...[["showdesk", "computer", "Show Desktop", () => minimizeAll()],
      ["terminal", "terminal", "Terminal", (b) => launch("terminal", null, b)],
      ["browser", "web", "Web Browser", (b) => launch("browser", null, b)],
      ["mail", "mail", "Mail Rohan", (b) => launch("mail", null, b)]].map(([, ic, label, fn]) => {
      const b = h("button", { type: "button", class: "qlb", "aria-label": label, "data-tip": label });
      b.append(icon(ic, { size: 16, scale: 1, still: true }));
      b.addEventListener("click", () => fn(b));
      return b;
    }));

  tasks = h("div", { class: "tasks", role: "group", "aria-label": "Open windows" });
  tray = h("div", { class: "tray", role: "group", "aria-label": "Notification area" });
  const showdesk = h("button", { type: "button", class: "showdesk", "aria-label": "Show desktop", "data-tip": "Show desktop", onclick: () => minimizeAll() });

  bar = h("nav", { class: "taskbar", "aria-label": "Taskbar" }, startBtn, h("span", { class: "grip-v", "aria-hidden": "true" }), ql, h("span", { class: "grip-v", "aria-hidden": "true" }), tasks, tray, showdesk);
  bar.addEventListener("contextmenu", (e) => { if (e.target.closest(".task, .trb, .clock")) return; e.preventDefault(); barMenu(e.clientX, e.clientY); });
  document.body.append(bar);

  buildTray();
  renderTasks();
  initTips();
  bus.on("wins", renderTasks);
  bus.on("notify", notify);
}
