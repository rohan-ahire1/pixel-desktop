// System tools: Run, Find, Task Manager, System Properties and the Properties sheet for any item.
import { h, bus, store, fmtUptime, bootTime, onTick, reduce } from "../core.js";
import { icon } from "../px.js";
import { openWindow, msgbox, list as winList } from "../wm.js";
import { sfx } from "../sound.js";
import * as fs from "../fs.js";
import { PROJECTS } from "../data.js";
import { hideMe, meRunning } from "../me.js";
import { launch, openNode, APPS } from "./index.js";

const ICON16 = (n) => icon(n, { size: 16, scale: 1, still: true });
const VERSION = "PixelOS 1.0";

/* ---------- Run ---------- */
const ALIAS = {
  cmd: "terminal", command: "terminal", sh: "terminal", bash: "terminal", zsh: "terminal", powershell: "terminal", term: "terminal",
  mspaint: "paint", pbrush: "paint", winmine: "mines", minesweeper: "mines", doom: "dos:doom", "doom.exe": "dos:doom", dos: "dos:doom", games: "explorer:games", calculator: "calc", winamp: "tunes", music: "tunes",
  outlook: "mail", email: "mail", iexplore: "browser", netscape: "browser", web: "browser", internet: "browser", taskmgr: "taskman",
  "task manager": "taskman", winhelp: "help", sysdm: "system", "sysdm.cpl": "system", "desk.cpl": "settings", control: "explorer:control",
  explorer: "explorer:computer", "my computer": "explorer:computer", write: "notepad", edit: "notepad",
};
export function run(arg, from) {
  const hist = store.get("runHist", []);
  const dl = h("datalist", { id: "run-dl" }, ...[...hist, ...APPS.filter((a) => !["project", "properties", "explorer"].includes(a))].map((v) => h("option", { value: v })));
  const field = h("input", { class: "field", list: "run-dl", value: hist[0] || "", "aria-label": "Open", style: { width: "100%" } });
  const go = async (w) => {
    const raw = field.value.trim(), q = raw.toLowerCase().replace(/\.exe$/, "");
    if (!q) return;
    store.set("runHist", [raw, ...hist.filter((x) => x !== raw)].slice(0, 8));
    const a = ALIAS[q] || (APPS.includes(q) ? q : null);
    const proj = PROJECTS.find((p) => p.id === q || p.name.toLowerCase() === q);
    w.close(true);
    if (["rohan", "me", "pixel"].includes(q)) return bus.emit("me:call");
    if (a) { const [app, x] = a.split(":"); return launch(app, x ?? null); }
    if (proj) return openNode(proj.id);
    if (/^(https?:\/\/|www\.)|\.(com|org|net|io|dev|app)(\/|$)/i.test(raw)) return launch("browser", /^https?:/.test(raw) ? raw : "https://" + raw);
    const id = fs.resolvePath(raw);
    if (id) return openNode(id);
    await msgbox({ title: raw, icon: "error", text: `PixelOS can't find '${raw}'. Make sure you typed the name correctly, and then try again. Type help in Terminal to see what's here.` });
    run();
  };
  const w = openWindow({
    id: "run", title: "Run", icon: "run", app: "run", dialog: true, w: 440, from, escClose: true, bodyClass: "dlg",
    build(w) {
      field.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); go(w); } });
      w.body.append(
        h("div", { class: "runrow" }, icon("run", { size: 32, scale: 1 }), h("p", {}, "Type the name of a program, folder, document or website, and PixelOS will open it for you.")),
        h("div", { class: "lbl-row" }, h("label", {}, "Open:"), field, dl),
        h("div", { class: "btnrow" },
          h("button", { type: "button", class: "btn def", onclick: () => go(w) }, "OK"),
          h("button", { type: "button", class: "btn", onclick: () => w.close() }, "Cancel"),
          h("button", { type: "button", class: "btn", onclick: () => { w.close(); openNode("programs"); } }, "Browse…")));
    },
  });
  if (w._built) return w;
  w._built = true;
  setTimeout(() => { field.focus(); field.select(); }, 0);
  return w;
}

/* ---------- Find ---------- */
export function find(q, from) {
  const field = h("input", { class: "field", id: "find-q", value: typeof q === "string" ? q : "", placeholder: "a name, a word, a language…", style: { width: "100%" } });
  const body = h("tbody");
  const res = h("div", { class: "xp-main well plist2", style: { marginTop: "8px", minHeight: "160px" }, tabindex: "0", role: "listbox", "aria-label": "Results" });
  const sCount = h("span");
  let rows = [], cur = -1;
  const pick = (i) => { cur = i; rows.forEach((r, j) => r.setAttribute("aria-selected", String(i === j))); rows[i]?.scrollIntoView({ block: "nearest" }); };
  const openRow = (i) => { const r = rows[i]; if (r) openNode(r.dataset.id, r); };
  const search = () => {
    const items = fs.search(field.value);
    rows = items.map((n, i) => {
      const where = n.parent ? fs.node(n.parent)?.name || "" : "";
      const tr = h("tr", { "data-id": n.id, role: "option", "aria-selected": "false" }, h("td", {}, h("span", {}, ICON16(n.icon), n.name)), h("td", {}, where), h("td", { style: { whiteSpace: "normal", maxWidth: "none" } }, n.snip || ""));
      tr.addEventListener("pointerdown", () => pick(i));
      tr.addEventListener("dblclick", () => openRow(i));
      return tr;
    });
    body.replaceChildren(...rows);
    sCount.textContent = field.value.trim() ? `${items.length} item(s) found` : "Type something to search.";
    if (!field.value.trim()) body.replaceChildren(h("tr", {}, h("td", { colspan: "3", class: "xp-empty", style: { fontFamily: "var(--ui)" } }, "Search the projects, the programs and your own notes. Try “python”, “chess” or “offline”.")));
    cur = -1;
  };
  res.append(h("table", { class: "xp-table" }, h("thead", {}, h("tr", {}, h("th", {}, "Name"), h("th", {}, "In Folder"), h("th", {}, "Match"))), body));
  res.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); pick(Math.min(rows.length - 1, cur + 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); pick(Math.max(0, cur - 1)); }
    if (e.key === "Enter") { e.preventDefault(); openRow(cur); }
  });
  let t;
  field.addEventListener("input", () => { clearTimeout(t); t = setTimeout(search, 120); });
  field.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); search(); if (rows.length) { res.focus(); pick(0); } } if (e.key === "ArrowDown" && rows.length) { e.preventDefault(); res.focus(); pick(0); } });
  const w = openWindow({
    id: "find", title: "Find: All Files", icon: "find", app: "find", w: 640, h: 440, minW: 340, minH: 260, from, bodyClass: "pad",
    onReopen: (w) => { if (typeof q === "string") { w.body.querySelector("#find-q").value = q; w.body.querySelector("#find-q").dispatchEvent(new Event("input")); } },
    build(w) {
      w.body.append(
        h("div", { class: "findbar" }, h("label", { for: "find-q" }, "Look for:"), h("div", { class: "lbl-row" }, field, h("button", { type: "button", class: "btn", onclick: search }, "Find Now"))),
        res);
      w.el.append(w.statusbar(sCount));
    },
  });
  if (w._built) return w;
  w._built = true;
  search();
  setTimeout(() => field.focus(), 0);
  return w;
}

/* ---------- Task Manager ---------- */
export function taskman(arg, from) {
  let tab = "apps", sel = null;
  const tabsEl = h("div", { class: "tabs", role: "tablist" });
  const panel = h("div", { class: "tabpanel", style: { flex: 1, display: "flex", flexDirection: "column", gap: "10px", minHeight: 0 } });
  const sProc = h("span"), sCpu = h("span"), sMem = h("span");
  // real numbers: frame time for "CPU", JS heap or DOM size for "memory"
  const cpuHist = Array(60).fill(0), memHist = Array(60).fill(0);
  let lastF = performance.now(), worst = 0, raf;
  const loop = (t) => { worst = Math.max(worst, t - lastF); lastF = t; raf = requestAnimationFrame(loop); };
  raf = requestAnimationFrame(loop);
  const memNow = () => (performance.memory ? performance.memory.usedJSHeapSize / 1048576 : document.getElementsByTagName("*").length / 40);
  const procs = () => [
    { id: "pixelos", name: "pixelos.exe", desc: "PixelOS kernel", mem: 8.2 },
    { id: "shell", name: "explorer.exe", desc: "Desktop and taskbar", mem: 3.4 + document.querySelectorAll(".dicon").length * 0.1 },
    { id: "wall", name: "wallpaper.exe", desc: "The lake outside", mem: 2.1 },
    meRunning() && { id: "me", name: "rohan.exe", desc: "Pixel Rohan", mem: 2.4 },
    ...winList().filter((w) => !w.modal && w.app !== "taskman").map((w) => ({ id: "w:" + w.id, name: (w.app || "app") + ".exe", desc: w.title, mem: 1 + w.el.getElementsByTagName("*").length / 60 })),
    { id: "taskman", name: "taskman.exe", desc: "Task Manager", mem: 0.9 },
  ].filter(Boolean);

  const table = (cols, data, key) => {
    const tb = h("tbody");
    data.forEach((r) => {
      const tr = h("tr", { "data-id": r.id, role: "option", "aria-selected": String(sel === r.id) }, ...r.cells.map((c, i) => h("td", {}, i === 0 ? h("span", {}, r.icon ? ICON16(r.icon) : null, c) : c)));
      tr.addEventListener("pointerdown", () => { sel = r.id; tb.querySelectorAll("tr").forEach((x) => x.setAttribute("aria-selected", String(x === tr))); upd(); });
      tr.addEventListener("dblclick", () => key.dbl && key.dbl(r.id));
      tb.append(tr);
    });
    const box = h("div", { class: "well", style: { flex: 1, minHeight: "150px", overflow: "auto" }, tabindex: "0", role: "listbox", "aria-label": "List" }, h("table", { class: "xp-table" }, h("thead", {}, h("tr", {}, ...cols.map((c) => h("th", {}, c)))), tb));
    box.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp" && e.key !== "Delete") return;
      e.preventDefault();
      if (e.key === "Delete") return key.del && key.del();
      const ids = data.map((r) => r.id), i = ids.indexOf(sel), n = ids[Math.max(0, Math.min(ids.length - 1, i + (e.key === "ArrowDown" ? 1 : -1)))];
      sel = n; tb.querySelectorAll("tr").forEach((x) => x.setAttribute("aria-selected", String(x.dataset.id === n))); upd();
    });
    return box;
  };
  const btnEnd = h("button", { type: "button", class: "btn" }, "End Task");
  const btnSw = h("button", { type: "button", class: "btn" }, "Switch To");
  const btnNew = h("button", { type: "button", class: "btn", onclick: () => run() }, "New Task…");
  const upd = () => {
    const tw = sel && sel.startsWith("w:") ? winList().find((w) => "w:" + w.id === sel) : null;
    btnEnd.disabled = !sel || (tab === "apps" ? !tw : sel === "taskman");
    btnSw.disabled = !tw;
  };
  async function endSel() {
    if (!sel) return;
    if (sel.startsWith("w:")) { const x = winList().find((w) => "w:" + w.id === sel); x && x.close(true); sel = null; return draw(); }
    if (sel === "me") { hideMe(60); bus.emit("notify", { title: "rohan.exe ended", text: "I left the taskbar. I'll be back in a minute.", icon: "me" }); sel = null; return draw(); }
    if (sel === "shell") { bus.emit("shell:restart"); sel = null; return; }
    if (sel === "wall") { msgbox({ title: "Task Manager", icon: "warn", text: "The lake is load-bearing. PixelOS needs it.", parent: w }); return; }
    if (sel === "pixelos") { const r = await msgbox({ title: "Task Manager", icon: "warn", text: "Ending pixelos.exe will shut down PixelOS. Continue?", buttons: ["Yes", "No"], parent: w, def: 1 }); if (r === 0) bus.emit("shell:shutdown", "now"); }
  }
  btnEnd.addEventListener("click", endSel);
  btnSw.addEventListener("click", () => { const x = winList().find((w) => "w:" + w.id === sel); if (x) { x.min ? x.restore() : x.focus(); } });

  const graph = (hist, color, label, val) => {
    const cv = h("canvas", { width: "120", height: "60", style: { width: "100%", height: "110px", imageRendering: "pixelated", background: "#000", display: "block" }, "aria-hidden": "true" });
    const c = cv.getContext("2d");
    c.fillStyle = "#000"; c.fillRect(0, 0, 120, 60);
    c.fillStyle = "#0b3d1f";
    for (let x = 0; x < 120; x += 10) c.fillRect(x, 0, 1, 60);
    for (let y = 0; y < 60; y += 10) c.fillRect(0, y, 120, 1);
    c.fillStyle = color;
    hist.forEach((v, i) => { const hh = Math.max(1, Math.round(v * 58)); c.fillRect(i * 2, 60 - hh, 2, 1); c.globalAlpha = 0.35; c.fillRect(i * 2, 60 - hh + 1, 2, hh - 1); c.globalAlpha = 1; });
    return h("fieldset", { class: "group", style: { flex: 1, minWidth: "180px" } }, h("legend", {}, label), cv, h("div", { style: { fontFamily: "var(--ui)", fontSize: "var(--fs-sm)", marginTop: "6px" } }, val));
  };
  function draw() {
    Object.entries({ apps: "Applications", procs: "Processes", perf: "Performance" }).forEach(([k]) => tabsEl.querySelector(`[data-t="${k}"]`).setAttribute("aria-selected", String(k === tab)));
    if (tab === "apps") {
      const ws = winList().filter((w) => !w.modal && w.app !== "taskman");
      panel.replaceChildren(
        table(["Task", "Status"], ws.map((w) => ({ id: "w:" + w.id, icon: w.icon, cells: [w.title, w.min ? "Minimized" : "Running"] })), { dbl: () => btnSw.click(), del: endSel }),
        h("div", { class: "btnrow" }, btnEnd, btnSw, btnNew));
      if (!ws.length) panel.firstChild.querySelector("tbody").append(h("tr", {}, h("td", { colspan: "2", class: "xp-empty", style: { fontFamily: "var(--ui)" } }, "No programs are open.")));
    } else if (tab === "procs") {
      const ps = procs();
      panel.replaceChildren(
        table(["Image Name", "Description", "Mem"], ps.map((p) => ({ id: p.id === "taskman" ? "taskman" : p.id, cells: [p.name, p.desc, Math.round(p.mem * 1024).toLocaleString() + " K"] })), { del: endSel }),
        h("div", { class: "btnrow" }, Object.assign(btnEnd, { textContent: "End Process" })));
    } else {
      const cpu = cpuHist[cpuHist.length - 1], mem = memNow();
      panel.replaceChildren(h("div", { style: { display: "flex", gap: "10px", flexWrap: "wrap" } },
        graph(cpuHist, "#3fd16b", "CPU Usage", `${Math.round(cpu * 100)}%`),
        graph(memHist, "#ffd84a", "Memory", `${mem.toFixed(1)} MB in use`)),
        h("dl", { class: "facts", style: { margin: 0 } },
          h("dt", {}, "Windows"), h("dd", {}, String(winList().length)),
          h("dt", {}, "Uptime"), h("dd", {}, fmtUptime()),
          h("dt", {}, "Elements"), h("dd", {}, document.getElementsByTagName("*").length.toLocaleString())));
    }
    if (tab !== "procs") btnEnd.textContent = "End Task";
    upd();
  }
  ["apps", "procs", "perf"].forEach((k, i) => {
    const b = h("button", { type: "button", class: "tab", role: "tab", "data-t": k, onclick: () => { tab = k; sel = null; draw(); } }, ["Applications", "Processes", "Performance"][i]);
    tabsEl.append(b);
  });
  const w = openWindow({
    id: "taskman", title: "Task Manager", icon: "system", app: "taskman", w: 480, h: 470, minW: 340, minH: 340, from, bodyClass: "pad",
    build(w) { w.body.append(tabsEl, panel); w.el.append(w.statusbar(sProc, sCpu, sMem)); },
  });
  if (w._built) return w;
  w._built = true;
  const iv = setInterval(() => {
    const lag = Math.max(0, worst - 16.7); worst = 0;
    const cpu = Math.min(1, 0.03 + lag / 60 + winList().length * 0.015 + (reduce ? 0 : 0.04) + Math.random() * 0.03);
    cpuHist.push(cpu); cpuHist.shift();
    const m = memNow(); memHist.push(Math.min(1, m / 200)); memHist.shift();
    sProc.textContent = `Processes: ${procs().length}`;
    sCpu.textContent = `CPU Usage: ${Math.round(cpu * 100)}%`;
    sMem.textContent = `Mem: ${m.toFixed(1)} MB`;
    if (tab === "perf" && !w.min) draw();
  }, 1000);
  w.on(() => { clearInterval(iv); cancelAnimationFrame(raf); });
  w.on(bus.on("wins", () => { if (tab !== "perf" && !w.el.contains(document.activeElement?.closest?.(".well") || null)) draw(); }));
  draw();
  return w;
}

/* ---------- System Properties ---------- */
export function system(arg, from) {
  const ua = navigator.userAgent;
  const browser = /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "A web browser";
  const host = navigator.userAgentData?.platform || (/Mac/.test(ua) ? "macOS" : /Win/.test(ua) ? "Windows" : /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Linux/.test(ua) ? "Linux" : "Unknown");
  const up = h("dd", {}, fmtUptime());
  const logo = h("canvas", { width: "32", height: "32", class: "px", style: { width: "96px", height: "96px" }, "aria-hidden": "true" });
  const rows = [
    ["System", null], ["Version", VERSION], ["Registered to", "You, the visitor"], ["Made by", "Rohan Ahire"],
    ["Computer", null], ["Host", `${browser} on ${host}`], ["Processor", navigator.hardwareConcurrency ? `${navigator.hardwareConcurrency} cores` : "Unknown"],
    ["Memory", navigator.deviceMemory ? `${navigator.deviceMemory} GB or more` : "Plenty"], ["Display", `${screen.width} × ${screen.height} at ${devicePixelRatio}x`],
    ["Desktop", `${innerWidth} × ${innerHeight}`], ["Language", navigator.language], ["Time zone", Intl.DateTimeFormat().resolvedOptions().timeZone || "Unknown"],
    ["Up since", new Date(bootTime).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })],
  ];
  const w = openWindow({
    id: "system", title: "System Properties", icon: "system", app: "system", dialog: true, w: 520, from, escClose: true, bodyClass: "dlg",
    build(w) {
      const dl = h("dl");
      rows.forEach(([k, v]) => v == null ? dl.append(h("h3", {}, k)) : dl.append(h("dt", {}, k), h("dd", {}, v)));
      dl.append(h("dt", {}, "Uptime"), up);
      w.body.append(h("div", { class: "sysinfo" }, logo, dl),
        h("div", { class: "btnrow" }, h("button", { type: "button", class: "btn", onclick: () => launch("taskman") }, "Task Manager"), h("button", { type: "button", class: "btn def", onclick: () => w.close() }, "OK")));
    },
  });
  if (w._built) return w;
  w._built = true;
  import("../px.js").then(({ drawBigIcon }) => {
    const c = logo.getContext("2d");
    const paint = (t) => { c.clearRect(0, 0, 32, 32); drawBigIcon(c, "computer", t); };
    paint(0);
    if (!reduce) w.on(onTick(paint));
  });
  const iv = setInterval(() => (up.textContent = fmtUptime()), 1000);
  w.on(() => clearInterval(iv));
  return w;
}

/* ---------- Properties ---------- */
export function properties(id, from) {
  if (id === "desktop-bg") return launch("settings", "background", from);
  const n = fs.node(id);
  if (!n) return null;
  const when = (t) => (t ? new Date(t).toLocaleString([], { dateStyle: "long", timeStyle: "short" }) : null);
  const kids = fs.isFolder(n) ? (n.type === "bin" ? fs.binItems() : fs.children(id)) : null;
  const size = kids ? kids.reduce((s, k) => s + (fs.sizeOf(k) || 0), 0) : fs.sizeOf(n);
  const rows = [
    ["Type", n.project ? `Project (${n.project.kind})` : fs.typeName(n)],
    ["Location", n.parent ? fs.pathOf(n.parent) : "C:\\"],
    ["Size", size ? `${fs.fmtSize(size)} (${size.toLocaleString()} bytes)` : kids ? "0 bytes" : null],
    kids && ["Contains", `${kids.length} item${kids.length === 1 ? "" : "s"}`],
    null,
    n.project && ["Year", n.project.year], n.project && ["Status", n.project.status], n.project && ["Built with", n.project.stack],
    n.project?.live && ["Live at", n.project.live.replace(/^https?:\/\//, "")],
    n.doc && ["Modified", when(n.doc.mtime)],
    n.when && ["Deleted", when(n.when)],
    n.type === "app" && ["Opens", n.app + ".exe"],
    ["Description", n.desc],
  ];
  const w = openWindow({
    id: "props:" + id, title: `${n.name} Properties`, icon: n.icon, app: "properties", dialog: true, w: 400, from, escClose: true, bodyClass: "dlg",
    build(w) {
      const dl = h("dl", { class: "statgrid", style: { gridTemplateColumns: "96px 1fr", fontSize: "var(--fs-md)" } });
      rows.forEach((r) => {
        if (r === null) dl.append(h("hr", { class: "etch", style: { gridColumn: "1 / -1", width: "100%" } }));
        else if (r && r[1]) dl.append(h("dt", {}, r[0] + ":"), h("dd", { style: { margin: 0, fontFamily: "var(--ui)", fontSize: r[0] === "Description" ? "var(--fs-md)" : "var(--fs-sm)", overflowWrap: "anywhere" } }, r[1]));
      });
      const btns = h("div", { class: "btnrow" });
      if (n.type === "bin" && kids.length) btns.append(h("button", { type: "button", class: "btn", onclick: async () => { w.close(); const r = await msgbox({ title: "Empty Recycle Bin", icon: "question", text: `Delete ${kids.length === 1 ? "this item" : `these ${kids.length} items`} for good?`, buttons: ["Yes", "No"] }); if (r === 0) { fs.emptyBin(); sfx("crumple"); } } }, "Empty"));
      if (n.project?.live) btns.append(h("button", { type: "button", class: "btn", onclick: () => { w.close(); launch("browser", n.project.live); } }, "Open live"));
      btns.append(h("button", { type: "button", class: "btn def", onclick: () => w.close() }, "OK"));
      w.body.append(
        h("div", { class: "lbl-row" }, icon(n.icon, { size: 32, scale: 1 }), h("input", { class: "field", value: n.name, readonly: true, "aria-label": "Name", style: { flex: 1 } })),
        h("hr", { class: "etch", style: { margin: 0 } }), dl, btns);
    },
  });
  return w;
}
