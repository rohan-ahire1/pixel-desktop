// File explorer: back/forward/up, typed paths, three views, a details pane, and the Recycle Bin.
import { h, bus, store, uid, announce, phone } from "../core.js";
import { icon, iconSel, iconName } from "../px.js";
import { openWindow, msgbox, list as winList } from "../wm.js";
import { openMenu } from "../menu.js";
import { sfx } from "../sound.js";
import * as fs from "../fs.js";
import { launch, openNode, properties } from "./index.js";

const ARR = {
  back: '<svg width="16" height="14" viewBox="0 0 16 14" aria-hidden="true" shape-rendering="crispEdges"><path fill="currentColor" d="M6 0h2v2H6v2H4v2h12v2H4v2h2v2h2v2H6v-2H4v-2H2V8H0V6h2V4h2V2h2z"/></svg>',
  fwd: '<svg width="16" height="14" viewBox="0 0 16 14" aria-hidden="true" shape-rendering="crispEdges"><path fill="currentColor" d="M8 0h2v2h2v2h2v2h2v2h-2v2h-2v2h-2v2H8v-2h2v-2h2V8H0V6h12V4h-2V2H8z"/></svg>',
  up: '<svg width="14" height="16" viewBox="0 0 14 16" aria-hidden="true" shape-rendering="crispEdges"><path fill="currentColor" d="M6 0h2v2h2v2h2v2h2v2h-2V6h-2V4H8v12H6V4H4v2H2v2H0V6h2V4h2V2h2z"/></svg>',
};
const fmtWhen = (t) => (t ? new Date(t).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "");

export function open(folder = "computer", from) {
  folder = folder || "computer";
  const existing = winList().find((w) => w.app === "explorer" && w._cur === folder);
  if (existing) { existing.min ? existing.restore() : existing.focus(); return existing; }

  let cur = folder, back = [], fwd = [], sel = new Set(), focusId = null, anchor = null;
  let view = store.get("xview", {})[folder] || (folder === "projects" || folder === "computer" || folder === "control" ? "icons" : "details");
  let items = [];
  const btn = (label, html, fn, extra = {}) => h("button", { type: "button", class: "tbtn row", "aria-label": label, "data-tip": label, html: html + `<span>${label}</span>`, onclick: fn, ...extra });
  const bBack = btn("Back", ARR.back, () => go(back.pop(), "back"));
  const bFwd = btn("Forward", ARR.fwd, () => go(fwd.pop(), "fwd"));
  const bUp = btn("Up", ARR.up, () => up());
  const binBtns = h("span", { style: { display: "contents" } });
  const viewSel = h("select", { class: "field", "aria-label": "View", style: { width: "auto" } },
    h("option", { value: "icons" }, "Large Icons"), h("option", { value: "list" }, "List"), h("option", { value: "details" }, "Details"));
  viewSel.addEventListener("change", () => setView(viewSel.value));
  let addrIcon = icon("folder", { size: 16, scale: 1, still: true });
  const addr = h("input", { class: "field", "aria-label": "Address", spellcheck: "false" });
  addr.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const id = fs.resolvePath(addr.value);
    if (!id) { msgbox({ title: "Address", icon: "error", text: `PixelOS can't find "${addr.value}". Check the spelling and try again.`, parent: w }); return; }
    const n = fs.node(id);
    if (fs.isFolder(n)) go(id); else { addr.value = fs.pathOf(cur); openNode(id); }
  });
  addr.addEventListener("focus", () => addr.select());

  const side = h("aside", { class: "xp-side" });
  const main = h("div", { class: "xp-main", tabindex: "0", role: "listbox", "aria-multiselectable": "true", "aria-label": "Folder contents" });
  const sCount = h("span"), sSize = h("span", { class: "fit" }), sWhere = h("span", { class: "fit" });

  const w = openWindow({
    id: "explorer-" + uid(), posKey: "explorer", title: fs.node(folder).name, icon: fs.node(folder).icon, app: "explorer", arg: folder,
    w: 760, h: 500, minW: 340, minH: 260, from,
    menubar: [
      { label: "File", items: () => {
        const one = sel.size === 1 ? fs.node([...sel][0]) : null;
        return [
          { label: "Open", bold: true, disabled: !sel.size, action: () => [...sel].forEach(openItem) },
          ...(cur === "bin" ? [{ label: "Restore", disabled: !sel.size, action: restoreSel }] : []),
          { sep: true },
          { label: "New", disabled: !["documents", "desktop"].includes(cur), sub: [{ label: "Text Document", icon: "note", action: newNote }] },
          { sep: true },
          { label: "Delete", kbd: "Del", disabled: !canDel(), action: delSel },
          { label: "Rename", kbd: "F2", disabled: !one || cur === "bin" || !(one.user || fs.isShortcut(one.id, "desktop") || cur === "desktop"), action: () => rename(one.id) },
          { label: "Properties", kbd: "Alt+Enter", action: () => properties(one ? one.id : cur, main) },
          { sep: true },
          ...(cur === "bin" ? [{ label: "Empty Recycle Bin", disabled: !items.length, action: emptyBin }, { sep: true }] : []),
          { label: "Close", kbd: "Alt+F4", action: () => w.close() },
        ];
      } },
      { label: "Edit", items: () => [
        { label: "Select All", kbd: "Ctrl+A", disabled: !items.length, action: () => setSel(items.map((n) => n.id)) },
        { label: "Invert Selection", disabled: !items.length, action: () => setSel(items.map((n) => n.id).filter((id) => !sel.has(id))) },
      ] },
      { label: "View", items: () => [
        { label: "Large Icons", radio: view === "icons", action: () => setView("icons") },
        { label: "List", radio: view === "list", action: () => setView("list") },
        { label: "Details", radio: view === "details", action: () => setView("details") },
        { sep: true },
        { label: "Refresh", kbd: "F5", action: render },
      ] },
      { label: "Go", items: () => [
        { label: "Back", kbd: "Alt+←", disabled: !back.length, action: () => go(back.pop(), "back") },
        { label: "Forward", kbd: "Alt+→", disabled: !fwd.length, action: () => go(fwd.pop(), "fwd") },
        { label: "Up One Level", kbd: "Backspace", disabled: cur === "computer", action: up },
        { sep: true },
        ...["computer", "projects", "documents", "desktop", "control", "bin"].map((id) => { const n = fs.node(id); return { label: n.name, icon: n.icon, action: () => go(id) }; }),
      ] },
      { label: "Help", items: () => [{ label: "Help Topics", icon: "help", kbd: "F1", action: () => launch("help", "files") }] },
    ],
  });
  w._cur = cur;
  w.body.append(
    h("div", { class: "toolbar" }, bBack, bFwd, bUp, h("span", { class: "tsep" }), binBtns, viewSel),
    h("div", { class: "toolbar" }, h("label", { class: "addr" }, h("span", {}, "Address"), h("span", { class: "ai" }, addrIcon, addr))),
    h("div", { class: "xp" }, side, main),
    w.statusbar(sCount, sSize, sWhere),
  );

  function setView(v) { view = v; const all = store.get("xview", {}); all[cur] = v; store.set("xview", all); render(); main.focus({ preventScroll: true }); }
  function go(id, how) {
    if (!id || !fs.node(id)) return;
    if (how === "back") fwd.push(cur); else if (how === "fwd") back.push(cur); else if (id !== cur) { back.push(cur); fwd = []; }
    cur = id; w._cur = id; sel = new Set(); focusId = null; anchor = null;
    view = store.get("xview", {})[id] || (["projects", "computer", "control"].includes(id) ? "icons" : "details");
    render();
    main.focus({ preventScroll: true });
    main.scrollTop = 0;
  }
  function up() { const n = fs.node(cur); if (n && n.parent) go(n.parent); }
  function openItem(id) {
    const n = items.find((x) => x.id === id) || fs.node(id);
    if (!n) return;
    if (cur === "bin") { properties(id, main); return; }
    if (fs.isFolder(n)) go(id); else openNode(id, rowFor(id));
  }
  const rowFor = (id) => main.querySelector(`[data-id="${CSS.escape(id)}"]`);
  const canDel = () => sel.size > 0 && [...sel].some((id) => (cur === "bin" ? true : fs.canDelete(id, cur)));
  async function delSel() {
    const ids = [...sel];
    if (!ids.length) return;
    if (cur === "bin") {
      const r = await msgbox({ title: "Delete for good", icon: "question", text: ids.length === 1 ? `Delete "${fs.node(ids[0])?.name}" for good? You can't undo this.` : `Delete these ${ids.length} items for good? You can't undo this.`, buttons: ["Yes", "No"], parent: w });
      if (r !== 0) return;
      ids.forEach(fs.purge); sfx("crumple"); return;
    }
    const ok = ids.filter((id) => fs.canDelete(id, cur));
    if (!ok.length) { msgbox({ title: "Can't delete", icon: "warn", text: "This item is part of PixelOS and can't be deleted from here.", parent: w }); return; }
    const r = await msgbox({ title: "Confirm Delete", icon: "question", text: ok.length === 1 ? `Send "${fs.node(ok[0]).name}" to the Recycle Bin?` : `Send these ${ok.length} items to the Recycle Bin?`, buttons: ["Yes", "No"], parent: w });
    if (r !== 0) return;
    ok.forEach(fs.trash); sfx("crumple");
  }
  function restoreSel() { [...sel].forEach(fs.restore); announce("Restored."); }
  async function emptyBin() {
    const r = await msgbox({ title: "Empty Recycle Bin", icon: "question", text: `Delete ${items.length === 1 ? "this item" : `these ${items.length} items`} for good?`, buttons: ["Yes", "No"], parent: w });
    if (r === 0) { fs.emptyBin(); sfx("crumple"); }
  }
  async function rename(id) {
    const n = fs.node(id);
    const r = await msgbox({ title: "Rename", icon: "question", text: `New name for "${n.name}":`, input: n.name, buttons: ["OK", "Cancel"], parent: w });
    if (r.index !== 0 || !r.value.trim()) return;
    if (/[\\/:*?"<>|]/.test(r.value)) { msgbox({ title: "Rename", icon: "error", text: 'A name can\'t contain any of these characters:\n\\ / : * ? " < > |', parent: w }); return; }
    fs.rename(id, r.value);
  }
  function newNote() { const d = fs.newNote(cur); setSel([d.id], d.id); rename(d.id); }

  /* ---------- selection ---------- */
  function setSel(ids, focus) {
    sel = new Set(ids);
    if (focus !== undefined) focusId = focus;
    main.querySelectorAll("[data-id]").forEach((el) => {
      const on = sel.has(el.dataset.id);
      el.setAttribute("aria-selected", String(on));
      el.classList.toggle("focus", el.dataset.id === focusId);
      if (el._cv) iconSel(el._cv, on);
    });
    if (focusId) main.setAttribute("aria-activedescendant", "xi-" + w.id + "-" + focusId); else main.removeAttribute("aria-activedescendant");
    rowFor(focusId)?.scrollIntoView({ block: "nearest" });
    drawSide(); status();
  }
  function clickSel(e, id) {
    const ids = items.map((n) => n.id);
    if (e.shiftKey && anchor) { const a = ids.indexOf(anchor), b = ids.indexOf(id); setSel(ids.slice(Math.min(a, b), Math.max(a, b) + 1), id); return; }
    if (e.ctrlKey || e.metaKey) { const s = new Set(sel); s.has(id) ? s.delete(id) : s.add(id); anchor = id; setSel(s, id); return; }
    anchor = id;
    setSel([id], id);
  }

  /* ---------- rendering ---------- */
  function drawSide() {
    const n = fs.node(cur);
    const one = sel.size === 1 ? items.find((x) => x.id === [...sel][0]) : null;
    side.replaceChildren(icon(one ? one.icon : n.icon, { size: 32, scale: 1, still: true }), h("h2", {}, one ? one.name : n.name), h("div", { class: "rule" }));
    if (one) {
      side.append(h("p", {}, one.project ? one.project.sum : one.desc || ""));
      const dl = h("dl");
      const add = (k, v) => v && dl.append(h("dt", {}, k), h("dd", {}, v));
      add("Type", one.project ? one.project.kind : fs.typeName(one));
      if (one.project) { add("Year", one.project.year); add("Status", one.project.status); }
      add("Size", fs.fmtSize(fs.sizeOf(one)));
      if (one.doc?.mtime) add("Modified", fmtWhen(one.doc.mtime));
      if (cur === "bin") { add("Deleted", fmtWhen(one.when)); add("From", one.from === "documents" ? "My Documents" : "Desktop"); }
      side.append(dl);
      const acts = h("div", { class: "btnrow", style: { justifyContent: "flex-start" } });
      if (cur === "bin") acts.append(h("button", { type: "button", class: "btn sm", onclick: restoreSel }, "Restore"));
      else acts.append(h("button", { type: "button", class: "btn sm def", onclick: () => openItem(one.id) }, "Open"));
      if (one.project?.live) acts.append(h("button", { type: "button", class: "btn sm", onclick: () => launch("project", one.id) }, "About"));
      side.append(acts);
    } else {
      side.append(h("p", {}, n.desc || ""));
      if (sel.size > 1) side.append(h("p", {}, `${sel.size} items selected.`));
      if (cur === "bin" && items.length) side.append(h("button", { type: "button", class: "btn sm", onclick: emptyBin }, "Empty Recycle Bin"));
    }
  }
  function status() {
    sCount.textContent = sel.size ? `${sel.size} object(s) selected` : `${items.length} object(s)`;
    const bytes = (sel.size ? items.filter((n) => sel.has(n.id)) : items).reduce((s, n) => s + (fs.sizeOf(n) || 0), 0);
    sSize.textContent = bytes ? fs.fmtSize(bytes) : "";
    sSize.hidden = !bytes;
    sWhere.textContent = cur === "bin" ? "Recycle Bin" : cur === "computer" ? "My Computer" : "PixelOS";
  }
  function render() {
    const n = fs.node(cur);
    if (!n) { go("computer"); return; }
    items = cur === "bin" ? fs.binItems() : fs.children(cur);
    if (cur !== "computer") items.sort((a, b) => (fs.isFolder(b) - fs.isFolder(a)) || 0);
    sel = new Set([...sel].filter((id) => items.some((x) => x.id === id)));
    w.setTitle(n.name); w.setIcon(n.icon);
    addr.value = fs.pathOf(cur);
    iconName(addrIcon, n.icon);
    bBack.disabled = !back.length; bFwd.disabled = !fwd.length; bUp.disabled = cur === "computer";
    viewSel.value = view;
    binBtns.replaceChildren(...(cur === "bin" ? [
      h("button", { type: "button", class: "tbtn row", disabled: !items.length, onclick: emptyBin }, icon("recycle", { size: 16, scale: 1, still: true }), "Empty Recycle Bin"),
      h("button", { type: "button", class: "tbtn row", onclick: () => (sel.size ? restoreSel() : items.forEach((x) => fs.restore(x.id))) }, sel.size ? "Restore" : "Restore all"),
      h("span", { class: "tsep" }),
    ] : []));
    main.replaceChildren();
    if (!items.length) main.append(h("div", { class: "xp-empty" }, cur === "bin" ? "The Recycle Bin is empty." : cur === "documents" ? "Nothing here yet. Save a note or a painting and it shows up here." : "This folder is empty."));
    else if (view === "details") {
      const cols = cur === "bin" ? ["Name", "Original Location", "Date Deleted", "Size"] : ["Name", "Type", "Size", cur === "projects" ? "Year" : "Modified"];
      const tb = h("tbody");
      for (const it of items) {
        const cv = icon(it.icon, { size: 16, scale: 1, still: true });
        const cells = cur === "bin"
          ? [it.from === "documents" ? "C:\\My Documents" : "C:\\Desktop", fmtWhen(it.when), fs.fmtSize(fs.sizeOf(it))]
          : [it.project ? it.project.kind : fs.typeName(it), fs.fmtSize(fs.sizeOf(it)), it.project ? it.project.year : fmtWhen(it.doc?.mtime)];
        const tr = h("tr", { "data-id": it.id, id: "xi-" + w.id + "-" + it.id, role: "option", "aria-selected": "false", "data-tip": it.desc || null }, h("td", {}, h("span", {}, cv, it.name)), ...cells.map((c) => h("td", {}, c)));
        tb.append(tr);
      }
      main.append(h("table", { class: "xp-table", role: "presentation" }, h("thead", {}, h("tr", {}, ...cols.map((c) => h("th", { scope: "col" }, c)))), tb));
    } else {
      const wrap = h("div", { class: "xp-icons" + (view === "list" ? " list" : "") });
      for (const it of items) {
        const cv = icon(it.icon, { size: view === "list" ? 16 : 32, scale: view === "list" ? 1 : 2 });
        const el = h("div", { class: "xi", "data-id": it.id, id: "xi-" + w.id + "-" + it.id, role: "option", "aria-selected": "false", "data-tip": it.desc || null }, cv, h("span", { class: "lbl" }, it.name));
        el._cv = cv;
        wrap.append(el);
      }
      main.append(wrap);
    }
    setSel(sel, focusId);
  }

  /* ---------- events ---------- */
  main.addEventListener("pointerdown", (e) => {
    const el = e.target.closest("[data-id]");
    if (e.button === 2) { if (el && !sel.has(el.dataset.id)) setSel([el.dataset.id], el.dataset.id); return; }
    if (!el) { if (!e.ctrlKey && !e.metaKey) setSel([], null); return; }
    clickSel(e, el.dataset.id);
  });
  main.addEventListener("dblclick", (e) => { const el = e.target.closest("[data-id]"); if (el) openItem(el.dataset.id); });
  // single tap opens on touch, like the desktop
  main.addEventListener("click", (e) => { if (e.pointerType === "touch" || phone()) { const el = e.target.closest("[data-id]"); if (el) openItem(el.dataset.id); } });
  main.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    const el = e.target.closest("[data-id]");
    if (el) {
      const it = items.find((x) => x.id === el.dataset.id);
      openMenu(cur === "bin" ? [
        { label: "Restore", bold: true, action: restoreSel },
        { label: "Delete for good", action: delSel },
        { sep: true },
        { label: "Properties", action: () => properties(it.id, el) },
      ] : [
        { label: "Open", bold: true, action: () => [...sel].forEach(openItem) },
        it.project?.live && { label: `About ${it.name}`, icon: "info", action: () => launch("project", it.id) },
        { sep: true },
        { label: "Delete", kbd: "Del", disabled: !canDel(), action: delSel },
        { label: "Rename", disabled: !(it.user || cur === "desktop"), action: () => rename(it.id) },
        { sep: true },
        { label: "Properties", action: () => properties(it.id, el) },
      ].filter(Boolean), { x: e.clientX, y: e.clientY, restoreFocus: main });
    } else {
      openMenu([
        { label: "View", sub: [
          { label: "Large Icons", radio: view === "icons", action: () => setView("icons") },
          { label: "List", radio: view === "list", action: () => setView("list") },
          { label: "Details", radio: view === "details", action: () => setView("details") },
        ] },
        { label: "Refresh", action: render },
        { sep: true },
        { label: "New", disabled: !["documents", "desktop"].includes(cur), sub: [{ label: "Text Document", icon: "note", action: newNote }] },
        ...(cur === "bin" ? [{ label: "Empty Recycle Bin", disabled: !items.length, action: emptyBin }] : []),
        { sep: true },
        { label: "Properties", action: () => properties(cur, main) },
      ], { x: e.clientX, y: e.clientY, restoreFocus: main });
    }
  });
  function moveFocus(key) {
    const els = [...main.querySelectorAll("[data-id]")];
    if (!els.length) return null;
    const i = els.findIndex((el) => el.dataset.id === focusId);
    if (i < 0) return els[0];
    if (key === "Home") return els[0];
    if (key === "End") return els[els.length - 1];
    const c = els[i], cx = c.offsetLeft, cy = c.offsetTop;
    if (view === "details") return els[i + (key === "ArrowDown" ? 1 : key === "ArrowUp" ? -1 : 0)] || c;
    const dir = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowUp: [0, -1] }[key];
    let best = null, bs = Infinity;
    for (const el of els) {
      if (el === c) continue;
      const dx = el.offsetLeft - cx, dy = el.offsetTop - cy, along = dx * dir[0] + dy * dir[1], across = Math.abs(dir[0] ? dy : dx);
      if (along <= 0) continue;
      const s = along + across * 3;
      if (s < bs) { bs = s; best = el; }
    }
    return best || c;
  }
  main.addEventListener("keydown", (e) => {
    const k = e.key, mod = e.ctrlKey || e.metaKey;
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End"].includes(k) && !e.altKey) {
      e.preventDefault();
      const el = moveFocus(k);
      if (!el) return;
      if (e.shiftKey && anchor) clickSel({ shiftKey: true }, el.dataset.id);
      else if (mod) { focusId = el.dataset.id; setSel(sel, focusId); }
      else { anchor = el.dataset.id; setSel([el.dataset.id], el.dataset.id); }
    } else if (k === "Enter" && e.altKey) { e.preventDefault(); properties(sel.size === 1 ? [...sel][0] : cur, main); }
    else if (k === "Enter") { e.preventDefault(); [...sel].forEach(openItem); }
    else if (k === "Backspace" || (e.altKey && k === "ArrowUp")) { e.preventDefault(); up(); }
    else if (e.altKey && k === "ArrowLeft") { e.preventDefault(); go(back.pop(), "back"); }
    else if (e.altKey && k === "ArrowRight") { e.preventDefault(); go(fwd.pop(), "fwd"); }
    else if (k === "Delete") { e.preventDefault(); delSel(); }
    else if (k === "F2") { e.preventDefault(); const id = [...sel][0]; const it = items.find((x) => x.id === id); if (it && cur !== "bin" && (it.user || cur === "desktop")) rename(id); }
    else if (k === "F5") { e.preventDefault(); render(); }
    else if (mod && k.toLowerCase() === "a") { e.preventDefault(); setSel(items.map((n) => n.id), focusId); }
    else if (k === " " && focusId) { e.preventDefault(); const s = new Set(sel); if (mod) { s.has(focusId) ? s.delete(focusId) : s.add(focusId); setSel(s); } else setSel([focusId]); }
    else if (k.length === 1 && /\S/.test(k) && !mod && !e.altKey) {
      const i = items.findIndex((x) => x.id === focusId);
      for (let j = 1; j <= items.length; j++) { const it = items[(i + j) % items.length]; if (it.name.toLowerCase().startsWith(k.toLowerCase())) { anchor = it.id; setSel([it.id], it.id); break; } }
    }
  });
  w.el.addEventListener("keydown", (e) => {
    if (e.target === addr) return;
    if (e.altKey && (e.key === "ArrowLeft" || e.key === "ArrowRight") && e.target !== main) { e.preventDefault(); e.key === "ArrowLeft" ? go(back.pop(), "back") : go(fwd.pop(), "fwd"); }
  });
  // mouse back/forward buttons
  main.addEventListener("mouseup", (e) => { if (e.button === 3) go(back.pop(), "back"); if (e.button === 4) go(fwd.pop(), "fwd"); });

  w.on(bus.on("fs", render));
  render();
  setTimeout(() => main.focus({ preventScroll: true }), 0);
  return w;
}
