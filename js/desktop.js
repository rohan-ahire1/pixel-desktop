// The desktop: icon grid, selection, marquee, drag and drop, rename, context menus, the recycle bin and file drops.
import { h, $, bus, store, settings, setSettings, small, clamp, uid, announce } from "./core.js";
import { icon, iconSel, PAL16 } from "./px.js";
import * as fs from "./fs.js";
import { openMenu } from "./menu.js";
import { sfx } from "./sound.js";
import { blurAll, msgbox } from "./wm.js";
import { launch, openNode, properties } from "./apps/index.js";
import { WALLPAPERS } from "./wallpaper.js";

let root, grid, sel = new Set(), focusId = null, renaming = null, lastKeyMenu = 0;
const els = new Map();
const posKey = () => (small() ? "pos-m" : "pos");
let pos = {};

function metrics() {
  const W = root.clientWidth, H = root.clientHeight;
  if (small()) {
    const cols = Math.max(3, Math.floor((W - 8) / 92)), cw = Math.floor((W - 8) / cols);
    return { cw, ch: 110, cols, rows: Math.max(1, Math.floor((H - 8) / 110)), scale: 2, mobile: true };
  }
  const large = settings.iconSize !== "small", cw = large ? 104 : 84, ch = large ? 118 : 86;
  return { cw, ch, cols: Math.max(1, Math.floor((W - 8) / cw)), rows: Math.max(1, Math.floor((H - 8) / ch)), scale: large ? 2 : 1 };
}
const k = (c, r) => c + "," + r;

function layout(items, m) {
  const taken = new Set(), out = new Map();
  for (const n of items) {
    const p = pos[n.id];
    if (p && p[0] < m.cols && p[1] < m.rows && !taken.has(k(...p))) { taken.add(k(...p)); out.set(n.id, p); }
  }
  const ids = new Set(items.map((n) => n.id));
  const groups = fs.DESKTOP_DEFAULT.map((g) => g.filter((id) => ids.has(id)));
  const grouped = new Set(groups.flat());
  groups.push(items.map((n) => n.id).filter((id) => !grouped.has(id)));
  let c = 0, r = 0;
  const step = () => { if (m.mobile) { if (++c >= m.cols) { c = 0; r++; } } else if (++r >= m.rows) { r = 0; c++; } };
  for (const g of groups) {
    let placed = false;
    for (const id of g) {
      if (out.has(id)) continue;
      let guard = 0;
      while (taken.has(k(c, r)) && guard++ < 4000) step();
      if (m.mobile ? r >= m.rows : c >= m.cols) { // full: find any hole, else stack on the last cell
        let hole = null;
        for (let cc = 0; cc < m.cols && !hole; cc++) for (let rr = 0; rr < m.rows && !hole; rr++) if (!taken.has(k(cc, rr))) hole = [cc, rr];
        const p = hole || [m.cols - 1, m.rows - 1];
        taken.add(k(...p)); out.set(id, p); continue;
      }
      taken.add(k(c, r)); out.set(id, [c, r]); placed = true;
      step();
    }
    if (placed) { if (m.mobile) { if (c) { c = 0; r++; } } else if (r) { r = 0; c++; } }
  }
  return out;
}

export function render() {
  if (!root) return;
  pos = store.get(posKey(), {});
  const m = (grid = metrics());
  root.style.setProperty("--cell-w", m.cw + "px");
  const items = fs.desktopItems().map(fs.node).filter(Boolean);
  const place = layout(items, m);
  const keep = renaming;
  root.querySelectorAll(".dicon").forEach((e) => e.remove());
  els.clear();
  for (const n of items) {
    const [c, r] = place.get(n.id);
    const cv = icon(n.icon, { size: 32, scale: m.scale, shortcut: fs.isShortcut(n.id, "desktop") });
    const el = h("div", {
      class: "dicon", role: "option", id: "di-" + n.id, "data-id": n.id, "aria-selected": String(sel.has(n.id)),
      "data-tip": n.desc || null, style: { left: 4 + c * m.cw + "px", top: 6 + r * m.ch + "px" },
    }, cv, h("span", { class: "lbl" }, n.name));
    if (sel.has(n.id)) iconSel(cv, true);
    el._cv = cv; el._n = n; el._cell = [c, r];
    els.set(n.id, el);
    root.append(el);
  }
  sel = new Set([...sel].filter((id) => els.has(id)));
  if (focusId && !els.has(focusId)) focusId = null;
  syncFocus();
  if (keep && els.has(keep)) renaming = null;
}

function setSel(ids, focus) {
  sel = new Set(ids);
  for (const [id, el] of els) { const on = sel.has(id); el.setAttribute("aria-selected", String(on)); iconSel(el._cv, on); }
  if (focus !== undefined) focusId = focus;
  syncFocus();
}
function syncFocus() {
  for (const [id, el] of els) el.classList.toggle("focus", id === focusId);
  if (focusId) root.setAttribute("aria-activedescendant", "di-" + focusId); else root.removeAttribute("aria-activedescendant");
}
export function selectIcon(id) {
  if (!els.has(id)) return;
  setSel([id], id);
  root.focus({ preventScroll: true });
  hop(els.get(id));
}
const hop = (el) => { if (!el) return; el.classList.remove("hop"); void el.offsetWidth; el.classList.add("hop"); setTimeout(() => el.classList.remove("hop"), 1100); };

function open(id) {
  const el = els.get(id);
  hop(el);
  openNode(id, el);
}

/* ---------- delete / bin ---------- */
async function del(ids, ask = true) {
  ids = ids.filter(Boolean);
  if (!ids.length) return;
  const ok = ids.filter((id) => fs.canDelete(id, "desktop")), no = ids.filter((id) => !ok.includes(id));
  if (no.length && !ok.length) {
    const n = fs.node(no[0]);
    await msgbox({ title: "Can't delete", icon: "warn", text: n.id === "bin" ? "The Recycle Bin stays. It's where deleted things go." : `${n.name} can't be deleted. Everything else lives inside it.` });
    return;
  }
  if (ask) {
    const one = ok.length === 1 ? fs.node(ok[0]) : null;
    const text = one ? `Send "${one.name}" to the Recycle Bin?` : `Send these ${ok.length} items to the Recycle Bin?`;
    const r = await msgbox({ title: "Confirm Delete", icon: "question", text, buttons: ["Yes", "No"] });
    if (r !== 0) return;
  }
  ok.forEach((id) => fs.trash(id));
  sfx("crumple");
  announce(ok.length === 1 ? `${fs.node(ok[0]).name} moved to the Recycle Bin.` : `${ok.length} items moved to the Recycle Bin.`);
}
export async function emptyBin() {
  const n = fs.binItems().length;
  if (!n) return;
  const r = await msgbox({ title: "Empty Recycle Bin", icon: "question", text: `Delete ${n === 1 ? "this item" : `these ${n} items`} for good?`, buttons: ["Yes", "No"] });
  if (r !== 0) return;
  fs.emptyBin();
  sfx("crumple");
}

/* ---------- rename ---------- */
function rename(id) {
  const el = els.get(id);
  if (!el || renaming) return;
  setSel([id], id);
  const n = el._n, lbl = el.querySelector(".lbl");
  const ta = h("textarea", { class: "ren", rows: "1", "aria-label": "New name", spellcheck: "false" });
  ta.value = n.name;
  lbl.hidden = true;
  el.append(ta);
  const fit = () => { ta.style.height = "auto"; ta.style.height = ta.scrollHeight + "px"; };
  fit();
  ta.focus();
  const dot = n.doc ? n.name.lastIndexOf(".") : -1;
  ta.setSelectionRange(0, dot > 0 ? dot : n.name.length);
  renaming = id;
  let done = false;
  const finish = (ok) => {
    if (done) return;
    done = true;
    renaming = null;
    const v = ta.value.replace(/\n/g, "").trim();
    ta.remove();
    lbl.hidden = false;
    root.focus({ preventScroll: true });
    if (!ok || !v || v === n.name) return;
    if (/[\\/:*?"<>|]/.test(v)) { msgbox({ title: "Rename", icon: "error", text: 'A name can\'t contain any of these characters:\n\\ / : * ? " < > |' }); return; }
    fs.rename(id, v);
  };
  ta.addEventListener("keydown", (e) => {
    e.stopPropagation();
    if (e.key === "Enter") { e.preventDefault(); finish(true); }
    else if (e.key === "Escape") { e.preventDefault(); finish(false); }
  });
  ta.addEventListener("input", fit);
  ta.addEventListener("blur", () => finish(true));
  ta.addEventListener("pointerdown", (e) => e.stopPropagation());
  ta.addEventListener("dblclick", (e) => e.stopPropagation());
}

/* ---------- context menus ---------- */
function iconMenu(el, x, y) {
  const ids = [...sel];
  if (ids.length > 1) {
    openMenu([
      { label: `Open ${ids.length} items`, bold: true, action: () => ids.forEach(open) },
      { sep: true },
      { label: "Delete", kbd: "Del", action: () => del(ids) },
      { sep: true },
      { label: "Properties", action: () => properties(ids[0], el) },
    ], { x, y, restoreFocus: root });
    return;
  }
  const n = el._n;
  const items = [
    { label: "Open", bold: true, action: () => open(n.id) },
    n.project?.live && { label: `About ${n.name}`, icon: "info", action: () => launch("project", n.id, el) },
    n.id === "computer" && { label: "Explore", action: () => launch("explorer", "computer", el) },
    n.type === "project" && { label: "Ask Rohan about it", icon: "mail", action: () => launch("mail", { subject: `About ${n.name}` }, el) },
    n.type === "pic" && { label: "Set as Wallpaper", action: () => setSettings({ wallpaper: "painting", wallPic: n.doc.data }) },
    n.id === "bin" && { label: "Empty Recycle Bin", disabled: !fs.binItems().length, action: emptyBin },
    { sep: true },
    { label: "Rename", kbd: "F2", action: () => rename(n.id) },
    { label: "Delete", kbd: "Del", disabled: !fs.canDelete(n.id, "desktop"), action: () => del([n.id]) },
    { sep: true },
    { label: "Properties", action: () => properties(n.id, el) },
  ].filter(Boolean);
  openMenu(items, { x, y, restoreFocus: root });
}

function arrange(by) {
  const items = fs.desktopItems().map(fs.node).filter(Boolean);
  const pinned = ["computer", "bin"];
  const rest = items.filter((n) => !pinned.includes(n.id));
  const cmp = by === "type" ? (a, b) => fs.typeName(a).localeCompare(fs.typeName(b)) || a.name.localeCompare(b.name) : (a, b) => a.name.localeCompare(b.name);
  const order = [...pinned.map((id) => items.find((n) => n.id === id)).filter(Boolean), ...rest.sort(cmp)];
  const m = grid, out = {};
  order.forEach((n, i) => { out[n.id] = m.mobile ? [i % m.cols, Math.floor(i / m.cols)] : [Math.floor(i / m.rows), i % m.rows]; });
  store.set(posKey(), out);
  render();
}
function deskMenu(x, y) {
  const hidden = fs.DESKTOP_DEFAULT.flat().some((id) => !fs.desktopItems().includes(id));
  openMenu([
    { label: "Arrange Icons", sub: [
      { label: "by Name", action: () => arrange("name") },
      { label: "by Type", action: () => arrange("type") },
      { sep: true },
      { label: "Default layout", action: () => { store.del(posKey()); render(); } },
    ] },
    { label: "Line up Icons", action: () => render() },
    { label: "View", sub: [
      { label: "Large Icons", radio: settings.iconSize !== "small", action: () => setSettings({ iconSize: "large" }) },
      { label: "Small Icons", radio: settings.iconSize === "small", action: () => setSettings({ iconSize: "small" }) },
    ] },
    { label: "Refresh", kbd: "F5", action: refresh },
    { sep: true },
    { label: "New", sub: [
      { label: "Text Document", icon: "note", action: newNote },
      { label: "Painting", icon: "paint", action: () => launch("paint", null) },
    ] },
    { label: "Wallpaper", sub: WALLPAPERS.map((w) => ({ label: w.name, radio: settings.wallpaper === w.id, disabled: w.id === "painting" && !settings.wallPic, action: () => setSettings({ wallpaper: w.id }) })) },
    hidden && { label: "Restore default icons", action: () => { fs.resetDesktop(); store.del(posKey()); } },
    { sep: true },
    { label: "Properties", action: () => launch("settings", "background") },
  ].filter(Boolean), { x, y, restoreFocus: root });
}
function refresh() {
  root.style.visibility = "hidden";
  setTimeout(() => { render(); root.style.visibility = ""; }, 90);
}
function newNote() {
  const d = fs.newNote("desktop");
  requestAnimationFrame(() => rename(d.id));
}

/* ---------- pointer: select, drag, marquee, long-press ---------- */
function cellOf(x, y) { return [clamp(Math.round((x - 4) / grid.cw), 0, grid.cols - 1), clamp(Math.round((y - 6) / grid.ch), 0, grid.rows - 1)]; }
function nearestFree(c, r, taken) {
  if (!taken.has(k(c, r))) return [c, r];
  for (let d = 1; d < 60; d++) {
    const ring = [];
    for (let dc = -d; dc <= d; dc++) for (let dr = -d; dr <= d; dr++) if (Math.max(Math.abs(dc), Math.abs(dr)) === d) ring.push([c + dc, r + dr]);
    ring.sort((a, b) => Math.hypot(a[0] - c, a[1] - r) - Math.hypot(b[0] - c, b[1] - r));
    for (const [cc, rr] of ring) if (cc >= 0 && rr >= 0 && cc < grid.cols && rr < grid.rows && !taken.has(k(cc, rr))) return [cc, rr];
  }
  return [c, r];
}
function dropTarget(x, y, group) {
  const under = document.elementsFromPoint(x, y);
  const di = under.find((e) => e.classList?.contains("dicon") && !group.includes(e));
  if (di && (di.dataset.id === "bin")) return di;
  return null;
}

function startDrag(e, el) {
  const sx = e.clientX, sy = e.clientY, touch = e.pointerType === "touch";
  let moving = false, hot = null, done = false, lp = 0;
  const group = [...sel].map((id) => els.get(id)).filter(Boolean);
  const starts = group.map((g) => [g, g.offsetLeft, g.offsetTop]);
  root.setPointerCapture(e.pointerId);
  if (touch) lp = setTimeout(() => { done = true; off(); iconMenu(el, sx, sy); }, 520);
  const mv = (ev) => {
    const dx = ev.clientX - sx, dy = ev.clientY - sy;
    if (!moving) {
      if (Math.hypot(dx, dy) < (touch ? 10 : 5)) return;
      moving = true; clearTimeout(lp);
      group.forEach((g) => { g.classList.add("dragging"); g.style.pointerEvents = "none"; });
    }
    starts.forEach(([g, x, y]) => { g.style.left = x + dx + "px"; g.style.top = y + dy + "px"; });
    const t = dropTarget(ev.clientX, ev.clientY, group);
    if (t !== hot) { hot?.classList.remove("drop-hot"); hot = t; hot?.classList.add("drop-hot"); if (hot) iconSel(hot._cv, true); }
  };
  const up = () => {
    off();
    if (done) return;
    if (!moving) { if (touch) open(el.dataset.id); return; }
    group.forEach((g) => { g.classList.remove("dragging"); g.style.pointerEvents = ""; });
    if (hot) { hot.classList.remove("drop-hot"); del(group.map((g) => g.dataset.id), false); render(); return; }
    // snap the group to the grid, keeping its shape
    const all = {};
    for (const [id, x] of els) all[id] = x._cell;
    const [pc, pr] = cellOf(el.offsetLeft, el.offsetTop), [oc, or] = el._cell, dc = pc - oc, dr = pr - or;
    const moving_ = new Set(group.map((g) => g.dataset.id));
    const taken = new Set(Object.entries(all).filter(([id]) => !moving_.has(id)).map(([, p]) => k(...p)));
    for (const g of group) {
      const [c0, r0] = g._cell;
      const p = nearestFree(clamp(c0 + dc, 0, grid.cols - 1), clamp(r0 + dr, 0, grid.rows - 1), taken);
      taken.add(k(...p)); all[g.dataset.id] = p;
    }
    store.set(posKey(), all);
    render();
  };
  const cancel = () => { off(); group.forEach((g) => { g.style.pointerEvents = ""; }); render(); };
  function off() { clearTimeout(lp); root.removeEventListener("pointermove", mv); root.removeEventListener("pointerup", up); root.removeEventListener("pointercancel", cancel); }
  root.addEventListener("pointermove", mv);
  root.addEventListener("pointerup", up);
  root.addEventListener("pointercancel", cancel);
}

function startMarquee(e) {
  const r0 = root.getBoundingClientRect(), sx = e.clientX - r0.left, sy = e.clientY - r0.top;
  const base = e.ctrlKey || e.metaKey ? new Set(sel) : new Set();
  let box = null, lp = 0, done = false;
  root.setPointerCapture(e.pointerId);
  if (e.pointerType === "touch") lp = setTimeout(() => { done = true; off(); deskMenu(e.clientX, e.clientY); }, 520);
  const mv = (ev) => {
    const x = ev.clientX - r0.left, y = ev.clientY - r0.top;
    if (!box) {
      if (Math.hypot(x - sx, y - sy) < 6) return;
      clearTimeout(lp);
      if (ev.pointerType === "touch") return off();
      box = h("div", { class: "marquee" }); root.append(box);
    }
    const L = Math.min(x, sx), T = Math.min(y, sy), W = Math.abs(x - sx), H = Math.abs(y - sy);
    Object.assign(box.style, { left: L + "px", top: T + "px", width: W + "px", height: H + "px" });
    const s = new Set(base);
    for (const [id, el] of els) {
      const cv = el._cv, ex = el.offsetLeft + cv.offsetLeft, ey = el.offsetTop + cv.offsetTop;
      const lb = el.querySelector(".lbl"), ex2 = el.offsetLeft + lb.offsetLeft + lb.offsetWidth, ey2 = el.offsetTop + lb.offsetTop + lb.offsetHeight;
      if (!(ex > L + W || Math.max(ex + cv.offsetWidth, ex2) < L || ey > T + H || ey2 < T)) s.add(id);
    }
    setSel(s, focusId);
  };
  const up = () => { off(); if (done) return; };
  function off() { clearTimeout(lp); box?.remove(); root.removeEventListener("pointermove", mv); root.removeEventListener("pointerup", up); root.removeEventListener("pointercancel", up); }
  root.addEventListener("pointermove", mv);
  root.addEventListener("pointerup", up);
  root.addEventListener("pointercancel", up);
}

/* ---------- keyboard ---------- */
function moveFocus(key, e) {
  const list = [...els.values()];
  if (!list.length) return;
  const cur = focusId && els.get(focusId);
  if (!cur) { const first = list[0]; setSel(e.ctrlKey ? sel : [first.dataset.id], first.dataset.id); return; }
  const [c, r] = cur._cell;
  const dir = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowUp: [0, -1] }[key];
  let best = null, bs = Infinity;
  for (const el of list) {
    if (el === cur) continue;
    const [cc, rr] = el._cell, dc = cc - c, dr = rr - r;
    const along = dc * dir[0] + dr * dir[1], across = Math.abs(dir[0] ? dr : dc);
    if (along <= 0) continue;
    const s = along + across * 3;
    if (s < bs) { bs = s; best = el; }
  }
  if (best) setSel(e.ctrlKey ? sel : [best.dataset.id], best.dataset.id);
}
function onKey(e) {
  if (renaming || e.target !== root) return;
  const key = e.key, mod = e.ctrlKey || e.metaKey;
  if (key === "Enter") { e.preventDefault(); (sel.size ? [...sel] : focusId ? [focusId] : []).forEach(open); }
  else if (key === "Delete" || (key === "Backspace" && e.metaKey)) { e.preventDefault(); del([...sel]); }
  else if (key === "F2") { e.preventDefault(); if (focusId) rename(focusId); }
  else if (key === "F5") { e.preventDefault(); refresh(); }
  else if (mod && key.toLowerCase() === "a") { e.preventDefault(); setSel(els.keys(), focusId || els.keys().next().value); }
  else if (key.startsWith("Arrow")) { e.preventDefault(); moveFocus(key, e); }
  else if (key === " ") { e.preventDefault(); if (!focusId) return; if (mod) { const s = new Set(sel); s.has(focusId) ? s.delete(focusId) : s.add(focusId); setSel(s); } else setSel([focusId]); }
  else if (key === "Escape") setSel([], focusId);
  else if (key === "ContextMenu" || (key === "F10" && e.shiftKey)) {
    e.preventDefault(); lastKeyMenu = performance.now();
    const el = focusId && els.get(focusId);
    if (el) { if (!sel.has(focusId)) setSel([focusId], focusId); const r = el.getBoundingClientRect(); iconMenu(el, r.left + r.width / 2, r.top + r.height / 2); }
    else deskMenu(40, 40);
  } else if (key.length === 1 && /\S/.test(key) && !mod && !e.altKey) {
    const list = [...els.values()], start = list.findIndex((x) => x.dataset.id === focusId);
    for (let i = 1; i <= list.length; i++) {
      const el = list[(start + i) % list.length];
      if (el._n.name.toLowerCase().startsWith(key.toLowerCase())) { setSel([el.dataset.id], el.dataset.id); break; }
    }
  }
}

/* ---------- files dropped from the real computer ---------- */
export async function pixelate(file) {
  const bmp = await createImageBitmap(file);
  const W = 96, H = 64, c = document.createElement("canvas");
  c.width = W; c.height = H;
  const x = c.getContext("2d", { willReadFrequently: true });
  const s = Math.max(W / bmp.width, H / bmp.height), w = bmp.width * s, hh = bmp.height * s;
  x.drawImage(bmp, (W - w) / 2, (H - hh) / 2, w, hh);
  const img = x.getImageData(0, 0, W, H), d = img.data;
  const pal = PAL16.map((hx) => [1, 3, 5].map((i) => parseInt(hx.slice(i, i + 2), 16)));
  const B = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
  for (let i = 0; i < W * H; i++) {
    const px = i % W, py = (i / W) | 0, off = (B[py & 3][px & 3] / 16 - 0.5) * 48;
    const r = d[i * 4] + off, g = d[i * 4 + 1] + off, b = d[i * 4 + 2] + off;
    let best = 0, bd = Infinity;
    pal.forEach(([pr, pg, pb], j) => { const dd = (r - pr) ** 2 * 0.3 + (g - pg) ** 2 * 0.59 + (b - pb) ** 2 * 0.11; if (dd < bd) { bd = dd; best = j; } });
    [d[i * 4], d[i * 4 + 1], d[i * 4 + 2]] = pal[best]; d[i * 4 + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  return c.toDataURL("image/png");
}
async function onDrop(e) {
  const files = [...(e.dataTransfer?.files || [])];
  if (!files.length) return;
  e.preventDefault();
  let made = 0;
  for (const f of files.slice(0, 6)) {
    const base = f.name.replace(/\.[^.]+$/, "").slice(0, 40) || "Dropped file";
    try {
      if (f.type.startsWith("image/")) {
        fs.saveDoc({ id: "pic-" + uid(), name: fs.uniqueName(base, "desktop", "png"), data: await pixelate(f), loc: "desktop" });
        made++;
      } else if (f.type.startsWith("text/") || /\.(txt|md|csv|json|js|ts|css|html|py|log|ini|yml|yaml)$/i.test(f.name)) {
        if (f.size > 200e3) { await msgbox({ title: f.name, icon: "warn", text: "That file is bigger than 200 KB. Notepad keeps things small." }); continue; }
        fs.saveDoc({ id: "note-" + uid(), name: fs.uniqueName(base, "desktop", "txt"), text: await f.text(), loc: "desktop" });
        made++;
      } else await msgbox({ title: f.name, icon: "warn", text: "PixelOS opens text files and pictures. This one is neither." });
    } catch (err) { console.error(err); }
  }
  if (made) { sfx("pop"); bus.emit("notify", { title: "Copied to the desktop", text: made === 1 ? "Your file is on the desktop. Pictures get turned into 16-colour pixel art." : `${made} files are on the desktop. Pictures get turned into 16-colour pixel art.`, icon: "info" }); }
}

export function initDesktop() {
  root = $("#icons");
  root.setAttribute("tabindex", "0");
  root.setAttribute("aria-label", "Desktop");
  root.setAttribute("aria-multiselectable", "true");
  render();

  let lastDown = null;
  root.addEventListener("pointerdown", (e) => {
    if (renaming) return;
    const el = e.target.closest(".dicon");
    if (e.button === 2) { if (el && !sel.has(el.dataset.id)) setSel([el.dataset.id], el.dataset.id); return; }
    if (e.button !== 0) return;
    blurAll();
    root.focus({ preventScroll: true });
    if (!el) { if (!(e.ctrlKey || e.metaKey || e.shiftKey)) setSel([], null); startMarquee(e); return; }
    const id = el.dataset.id;
    if (e.ctrlKey || e.metaKey) { const s = new Set(sel); s.has(id) ? s.delete(id) : s.add(id); setSel(s, id); return; }
    // Our own double-click: drag code captures the pointer, so the browser's dblclick lands on the desktop, not the icon.
    const now = performance.now();
    if (e.pointerType === "mouse" && lastDown && lastDown.id === id && now - lastDown.t < 500 && Math.hypot(e.clientX - lastDown.x, e.clientY - lastDown.y) < 6) {
      lastDown = null; setSel([id], id); open(id); return;
    }
    lastDown = { id, t: now, x: e.clientX, y: e.clientY };
    if (!sel.has(id)) setSel([id], id); else { focusId = id; syncFocus(); }
    startDrag(e, el);
  });
  root.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    if (performance.now() - lastKeyMenu < 400) return;
    const el = e.target.closest(".dicon");
    if (el) iconMenu(el, e.clientX, e.clientY); else deskMenu(e.clientX, e.clientY);
  });
  root.addEventListener("keydown", onKey);
  root.addEventListener("focus", () => { if (!focusId && els.size) { focusId = els.keys().next().value; syncFocus(); } });

  const desk = $("#desk");
  desk.addEventListener("dragover", (e) => { if ([...(e.dataTransfer?.types || [])].includes("Files")) { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; } });
  desk.addEventListener("drop", onDrop);

  bus.on("fs", render);
  bus.on("settings", (p) => { if ("iconSize" in p) render(); });
  bus.on("desk:select", selectIcon);
  bus.on("desk:rename", (id) => rename(id));
  bus.on("shell:restart", () => {
    root.hidden = true;
    setTimeout(() => { root.hidden = false; render(); }, 1600);
  });
  let rt;
  addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(render, 120); });
}
