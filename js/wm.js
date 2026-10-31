// Window manager: open, focus, drag, snap, resize, minimize, maximize, modal dialogs and message boxes.
import { h, $, bus, store, small, phone, reduce, clamp, uid } from "./core.js";
import { icon } from "./px.js";
import { sfx } from "./sound.js";
import { openMenu, menubar } from "./menu.js";

export const wins = new Map();
let zTop = 10, activeId = null, cascade = 0;
const saved = store.get("wpos", {});
const desk = () => $("#desk");
const dims = () => { const d = desk(); return { w: d.clientWidth, h: d.clientHeight }; };

const SVG = {
  min: '<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><rect x="2" y="9" width="7" height="2" fill="currentColor"/></svg>',
  max: '<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><rect x="1" y="1" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2"/><rect x="1" y="1" width="10" height="3" fill="currentColor"/></svg>',
  restore: '<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" fill="currentColor"><path d="M3 0h9v8h-2V3H3z"/><rect x="0" y="4" width="9" height="3"/><rect x="0" y="4" width="2" height="8"/><rect x="7" y="4" width="2" height="8"/><rect x="0" y="10" width="9" height="2"/></svg>',
  close: '<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M1 1h2v2h2v2h2V3h2V1h2v2H9v2H7v2h2v2h2v2H9V9H7V7H5v2H3v2H1V9h2V7h2V5H3V3H1z" fill="currentColor"/></svg>',
};

// Win95 "zoom" outline between two rects
function zoom(from, to, done) {
  if (reduce || !from || !to) { done && done(); return; }
  const z = h("div", { class: "zoom" });
  document.body.append(z);
  const f = (r) => ({ left: r.left + "px", top: r.top + "px", width: r.width + "px", height: r.height + "px" });
  const a = z.animate([f(from), f(to)], { duration: 190, easing: "steps(5, end)", fill: "forwards" });
  a.onfinish = () => { z.remove(); done && done(); };
}
const rectOf = (x) => (!x ? null : x.getBoundingClientRect ? (x.isConnected ? x.getBoundingClientRect() : null) : x);

export const list = () => [...wins.values()];
export const active = () => (activeId && wins.get(activeId)) || null;
export function topWin(exclude) {
  let best = null;
  for (const w of wins.values()) if (w !== exclude && !w.min && (!best || +w.el.style.zIndex > +best.el.style.zIndex)) best = w;
  return best;
}
function normalizeZ() {
  if (zTop < 5000) return;
  const sorted = list().sort((a, b) => a.el.style.zIndex - b.el.style.zIndex);
  zTop = 10;
  sorted.forEach((w) => (w.el.style.zIndex = ++zTop));
}
export function blurAll() {
  activeId = null;
  for (const w of wins.values()) w.el.classList.remove("active");
  bus.emit("wins");
}

export function openWindow(o) {
  if (o.id && wins.has(o.id)) {
    const w = wins.get(o.id);
    if (w.min) w.restore(); else w.focus();
    o.onReopen && o.onReopen(w);
    return w;
  }
  const id = o.id || "w-" + uid();
  const dialog = !!o.dialog;
  const resizable = o.resizable ?? !dialog;
  const maximizable = o.maximizable ?? resizable;
  const minimizable = o.minimizable ?? !o.modal;
  const titleId = "wt-" + id.replace(/[^\w-]/g, "_");

  const el = h("section", { class: "win" + (dialog ? " dialog" : "") + (resizable ? "" : " fixed"), role: "dialog", "aria-labelledby": titleId, tabindex: "-1" });
  const tIcon = icon(o.icon || "logo", { size: 16, scale: 1 });
  const ticon = h("button", { type: "button", class: "ticon", "aria-label": "Window menu", tabindex: "-1" }, tIcon);
  const ttl = h("span", { class: "ttl", id: titleId }, o.title);
  const btns = h("div", { class: "tbtns" });
  const mk = (cls, label, svg, fn) => { const b = h("button", { type: "button", class: cls, "aria-label": label, html: svg, onclick: (e) => { e.stopPropagation(); fn(); } }); btns.append(b); return b; };
  const tbar = h("div", { class: "tbar" }, ticon, ttl, btns);
  const body = h("div", { class: "wbody " + (o.bodyClass || "") });
  el.append(tbar);

  const w = {
    id, el, body, tbar, o, app: o.app, arg: o.arg, title: o.title, icon: o.icon || "logo", min: false, max: false, snap: null, prev: null,
    modal: o.modal || null, child: null, cleanups: [], created: Date.now(),
    on(fn) { this.cleanups.push(fn); },
  };
  if (minimizable) mk("mn", "Minimize", SVG.min, () => w.minimize());
  const maxBtn = maximizable ? mk("mx", "Maximize", SVG.max, () => w.toggleMax()) : null;
  mk("x", "Close", SVG.close, () => w.close());
  if (o.menubar) { w.menubar = menubar(o.menubar); el.append(w.menubar); }
  el.append(body);
  if (resizable) for (const d of ["n", "s", "e", "w", "ne", "nw", "se", "sw"]) el.append(h("div", { class: "rz " + d, "data-d": d, "aria-hidden": "true" }));

  w.setTitle = (t) => { w.title = t; ttl.textContent = t; bus.emit("wins"); };
  w.setIcon = (n) => { w.icon = n; tIcon.replaceWith(icon(n, { size: 16, scale: 1 })); bus.emit("wins"); };
  w.rect = () => ({ x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight });
  const apply = (r) => { el.style.left = r.x + "px"; el.style.top = r.y + "px"; if (r.w != null) el.style.width = r.w + "px"; if (r.h != null) el.style.height = r.h + "px"; };
  const deskRect = (r) => { const d = desk().getBoundingClientRect(); return { left: d.left + r.x, top: d.top + r.y, width: r.w, height: r.h }; };
  const remember = () => { if (dialog || o.remember === false || w.max || w.snap) return; saved[o.posKey || id.split(":")[0]] = w.rect(); store.set("wpos", saved); };
  w.statusbar = (...parts) => {
    const sb = h("div", { class: "statusbar" }, ...parts.map((p) => (p instanceof Node ? p : h("span", {}, p))));
    if (resizable) { const g = h("span", { class: "grip", "aria-hidden": "true", "data-d": "se" }); sb.append(g); g.addEventListener("pointerdown", startResize); }
    return sb;
  };

  w.focus = (moveFocus = true) => {
    if (w.child && !w.child.min) { w.child.focus(moveFocus); return; }
    if (w.min) { w.restore(); return; }
    normalizeZ();
    if (activeId !== id || +el.style.zIndex !== zTop) el.style.zIndex = ++zTop;
    activeId = id;
    for (const x of wins.values()) x.el.classList.toggle("active", x === w);
    if (moveFocus && !el.contains(document.activeElement)) {
      // phones: never pop the keyboard up unasked, the person taps a field when they want it
      const t = el.querySelector("[autofocus]") || (!phone() && body.querySelector("input:not([type=hidden]):not([disabled]), textarea, [data-focus]")) || el;
      t.focus({ preventScroll: true });
    }
    bus.emit("win:focus", w);
    bus.emit("wins");
  };
  w.minimize = () => {
    if (w.min || !minimizable) return;
    const from = el.getBoundingClientRect();
    w.min = true; el.hidden = true;
    sfx("min");
    zoom(from, rectOf(document.querySelector(`.task[data-id="${CSS.escape(id)}"]`)));
    if (activeId === id) { activeId = null; el.classList.remove("active"); const n = topWin(); n ? n.focus() : bus.emit("wins"); }
    else bus.emit("wins");
  };
  w.restore = () => {
    if (w.min) {
      w.min = false;
      const btn = rectOf(document.querySelector(`.task[data-id="${CSS.escape(id)}"]`));
      el.hidden = false;
      const to = el.getBoundingClientRect();
      el.style.visibility = "hidden";
      zoom(btn, to, () => (el.style.visibility = ""));
      sfx("max");
      w.focus();
      return;
    }
    if (w.max) w.toggleMax();
  };
  w.toggleMax = (anim = true) => {
    if (!maximizable || small()) return;
    const from = el.getBoundingClientRect();
    if (!w.max) {
      w.prev = w.snap ? w.snap : w.rect(); w.snap = null;
      w.max = true; el.classList.add("max");
      apply({ x: 0, y: 0 }); el.style.width = "100%"; el.style.height = "100%";
      if (maxBtn) { maxBtn.innerHTML = SVG.restore; maxBtn.setAttribute("aria-label", "Restore"); }
      if (anim) sfx("max");
    } else {
      w.max = false; el.classList.remove("max");
      apply(w.prev || { x: 40, y: 40, w: 520, h: 380 });
      if (maxBtn) { maxBtn.innerHTML = SVG.max; maxBtn.setAttribute("aria-label", "Maximize"); }
      if (anim) sfx("min");
    }
    if (anim) { const to = el.getBoundingClientRect(); el.style.visibility = "hidden"; zoom(from, to, () => (el.style.visibility = "")); }
    w.focus();
    bus.emit("win:resize", w);
  };
  w.close = async (force = false) => {
    if (!wins.has(id)) return;
    if (w.child) { w.child.focus(); flash(w.child); return; }
    if (!force && o.onClose) { const ok = await o.onClose(w); if (ok === false) return; }
    const from = el.hidden ? null : el.getBoundingClientRect();
    w.cleanups.forEach((fn) => { try { fn(); } catch (e) { console.error(e); } });
    el.remove();
    wins.delete(id);
    if (w.modal) { w.modal.child = null; w.modal.el.querySelector(":scope > .blocker")?.remove(); }
    if (from && !dialog) zoom(from, { left: from.left + from.width / 2 - 20, top: from.top + from.height / 2 - 12, width: 40, height: 24 });
    if (!dialog) sfx("close");
    bus.emit("win:close", w);
    if (activeId === id) {
      activeId = null;
      const back = w.modal && wins.has(w.modal.id) ? w.modal : null;
      const opener = o.opener && o.opener.isConnected ? o.opener : null;
      if (back) back.focus();
      else if (opener && !opener.closest(".win")) { bus.emit("wins"); opener.focus({ preventScroll: true }); }
      else { const n = topWin(); if (n) n.focus(); else { bus.emit("wins"); $("#icons")?.focus({ preventScroll: true }); } }
    } else bus.emit("wins");
  };
  w.sysmenu = (anchor, pos) => {
    const items = [
      { label: "Restore", icon: null, disabled: !w.max && !w.min, action: () => w.restore() },
      { label: "Minimize", disabled: !minimizable || w.min, action: () => w.minimize() },
      { label: "Maximize", disabled: !maximizable || w.max || small(), action: () => (w.min ? (w.restore(), w.max || w.toggleMax()) : w.toggleMax()) },
      { sep: true },
      { label: "Close", kbd: "Alt+F4", bold: true, action: () => w.close() },
    ];
    openMenu(items, pos ? { x: pos.x, y: pos.y } : { anchor: anchor || ticon });
  };

  // title bar interactions
  ticon.addEventListener("click", (e) => { e.stopPropagation(); w.focus(false); w.sysmenu(ticon); });
  ticon.addEventListener("dblclick", (e) => { e.stopPropagation(); w.close(); });
  tbar.addEventListener("dblclick", (e) => { if (!e.target.closest("button")) w.toggleMax(); });
  tbar.addEventListener("contextmenu", (e) => { e.preventDefault(); w.focus(false); w.sysmenu(null, { x: e.clientX, y: e.clientY }); });
  el.addEventListener("pointerdown", () => { if (activeId !== id || w.child) w.focus(false); }, true);
  el.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && (o.escClose ?? dialog) && !e.defaultPrevented) { e.preventDefault(); o.onEscape ? o.onEscape() : w.close(); }
  });

  // drag
  let ghost = null, snapTo = null;
  const showGhost = (r) => {
    if (!r) { ghost?.remove(); ghost = null; return; }
    if (!ghost) { ghost = h("div", { class: "ghost" }); desk().append(ghost); }
    Object.assign(ghost.style, { left: r.x + "px", top: r.y + "px", width: r.w + "px", height: r.h + "px" });
  };
  tbar.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || e.target.closest("button") || small()) return;
    const sx = e.clientX, sy = e.clientY;
    let ox = el.offsetLeft, oy = el.offsetTop, moved = false;
    tbar.setPointerCapture(e.pointerId);
    const mv = (ev) => {
      const dx = ev.clientX - sx, dy = ev.clientY - sy;
      if (!moved) {
        if (Math.hypot(dx, dy) < 4) return;
        moved = true;
        document.body.classList.add("dragging");
        if (w.max || w.snap) {
          const r = el.getBoundingClientRect(), rel = (sx - r.left) / r.width;
          const back = w.max ? w.prev : w.snap;
          if (w.max) { w.max = false; el.classList.remove("max"); if (maxBtn) { maxBtn.innerHTML = SVG.max; maxBtn.setAttribute("aria-label", "Maximize"); } }
          w.snap = null;
          const nw = back ? back.w : 520;
          apply({ x: 0, y: 0, w: nw, h: back ? back.h : 380 });
          ox = Math.round(sx - nw * rel); oy = 0;
        }
      }
      const { w: dw, h: dh } = dims();
      const x = clamp(ox + dx, 60 - el.offsetWidth, dw - 60), y = clamp(oy + dy, 0, dh - 30);
      el.style.left = x + "px"; el.style.top = y + "px";
      snapTo = null;
      if (resizable && maximizable) {
        if (ev.clientX <= 3) snapTo = { x: 0, y: 0, w: Math.round(dw / 2), h: dh };
        else if (ev.clientX >= innerWidth - 4) snapTo = { x: Math.round(dw / 2), y: 0, w: dw - Math.round(dw / 2), h: dh };
        else if (ev.clientY <= 2) snapTo = "max";
      }
      showGhost(snapTo === "max" ? { x: 0, y: 0, w: dw, h: dh } : snapTo);
    };
    const up = () => {
      tbar.removeEventListener("pointermove", mv); tbar.removeEventListener("pointerup", up); tbar.removeEventListener("pointercancel", up);
      document.body.classList.remove("dragging");
      showGhost(null);
      if (!moved) return;
      if (snapTo === "max") { w.prev = w.rect(); w.toggleMax(false); }
      else if (snapTo) { w.snap = w.rect(); apply(snapTo); bus.emit("win:resize", w); }
      else remember();
      snapTo = null;
    };
    tbar.addEventListener("pointermove", mv); tbar.addEventListener("pointerup", up); tbar.addEventListener("pointercancel", up);
  });

  // resize
  function startResize(e) {
    if (e.button !== 0 || w.max || small()) return;
    e.preventDefault(); e.stopPropagation();
    const d = e.currentTarget.dataset.d, t = e.currentTarget;
    const s = w.rect(), sx = e.clientX, sy = e.clientY, minW = o.minW || 260, minH = o.minH || 160;
    const { w: dw, h: dh } = dims();
    t.setPointerCapture(e.pointerId);
    document.body.classList.add("dragging");
    w.snap = null;
    const mv = (ev) => {
      const dx = ev.clientX - sx, dy = ev.clientY - sy, r = { ...s };
      if (d.includes("e")) r.w = clamp(s.w + dx, minW, dw - s.x);
      if (d.includes("s")) r.h = clamp(s.h + dy, minH, dh - s.y);
      if (d.includes("w")) { r.w = clamp(s.w - dx, minW, s.x + s.w); r.x = s.x + s.w - r.w; }
      if (d.includes("n")) { r.h = clamp(s.h - dy, minH, s.y + s.h); r.y = s.y + s.h - r.h; }
      apply(r);
      bus.emit("win:resize", w);
    };
    const up = () => { document.body.classList.remove("dragging"); t.removeEventListener("pointermove", mv); t.removeEventListener("pointerup", up); t.removeEventListener("pointercancel", up); remember(); };
    t.addEventListener("pointermove", mv); t.addEventListener("pointerup", up); t.addEventListener("pointercancel", up);
  }
  el.querySelectorAll(".rz").forEach((r) => r.addEventListener("pointerdown", startResize));

  // mount, build, size, place
  wins.set(id, w);
  el.style.zIndex = ++zTop;
  el.style.visibility = "hidden";
  desk().append(el);
  if (o.build) o.build(w);
  const { w: dw, h: dh } = dims();
  const key = o.posKey || id.split(":")[0];
  let r = !dialog && o.remember !== false && saved[key] ? { ...saved[key] } : null;
  if (!r) {
    let ww = o.w === "auto" || o.w == null ? null : o.w, hh = o.h === "auto" || o.h == null ? null : o.h;
    if (ww) el.style.width = Math.min(ww, dw - 16) + "px";
    if (hh) el.style.height = Math.min(hh, dh - 16) + "px";
    ww = el.offsetWidth; hh = el.offsetHeight;
    if (hh > dh - 16) { hh = dh - 16; el.style.height = hh + "px"; }
    if (ww > dw - 8) { ww = dw - 8; el.style.width = ww + "px"; }
    let x, y;
    if (o.modal && wins.has(o.modal.id)) { const p = o.modal.rect(); x = p.x + (p.w - ww) / 2; y = p.y + Math.min(80, (p.h - hh) / 2); }
    else if (o.x != null) { x = o.x; y = o.y; }
    else if (dialog) { x = (dw - ww) / 2; y = Math.max(16, (dh - hh) / 2.4); }
    else { const n = cascade++ % 7; x = (dw - ww) / 2 - 90 + n * 28; y = Math.max(12, (dh - hh) / 3) - 30 + n * 26; }
    // no size given: let the content decide, so panels added after opening still fit
    r = { x: Math.round(clamp(x, 4, Math.max(4, dw - ww - 4))), y: Math.round(clamp(y, 4, Math.max(4, dh - hh - 4))), w: o.w === "auto" || o.w == null ? null : ww, h: o.h === "auto" || o.h == null ? null : hh };
  } else {
    r.w = Math.min(r.w, dw - 8); r.h = Math.min(r.h, dh - 8);
    r.x = clamp(r.x, 0, Math.max(0, dw - r.w)); r.y = clamp(r.y, 0, Math.max(0, dh - r.h));
  }
  apply(r);
  if (r.h == null && !o.max) {
    // content-sized: never taller than the desk, and nudge up if late content pushes the bottom off screen
    el.style.maxHeight = "calc(100% - 8px)";
    const fit = () => { if (w.max || w.snap || w.min) return; const dh = dims().h, hh = el.offsetHeight, y = el.offsetTop; if (y + hh > dh - 4) el.style.top = Math.max(4, dh - hh - 4) + "px"; };
    const ro = new ResizeObserver(fit); ro.observe(el); w.on(() => ro.disconnect());
  }
  if (o.modal && wins.has(o.modal.id)) {
    o.modal.child = w;
    const bl = h("div", { class: "blocker" });
    bl.addEventListener("pointerdown", (e) => { e.preventDefault(); e.stopPropagation(); w.focus(); flash(w); });
    o.modal.el.append(bl);
  }
  const from = rectOf(o.from);
  // a window can't take focus while hidden for the zoom, so a window opened from an icon takes it here
  const show = () => { el.style.visibility = ""; if (from && activeId === id) w.focus(); if (!from && !reduce) { el.classList.add("opening"); setTimeout(() => el.classList.remove("opening"), 200); } };
  if (from) zoom(from, el.getBoundingClientRect(), show); else show();
  if (o.maximized && !small()) w.toggleMax(false);
  if (!dialog) sfx("open");
  w.focus();
  o.onOpen && o.onOpen(w);
  bus.emit("win:open", w);
  return w;
}

export function flash(w) {
  w.el.classList.remove("flash");
  void w.el.offsetWidth;
  w.el.classList.add("flash");
  setTimeout(() => w.el.classList.remove("flash"), 800);
  sfx("ding");
}

// msgbox({ title, text, icon, buttons, parent, def, input }) -> Promise<index> (or { index, value } with input)
export function msgbox({ title = "PixelOS", text = "", icon: ic = "info", buttons = ["OK"], parent = null, def = 0, input = null, cancel }) {
  bus.emit("msgbox", { icon: ic, title, text });
  return new Promise((resolve) => {
    let field = null, done = false;
    const finish = (i, w) => {
      if (done) return;
      done = true;
      w.close(true);
      resolve(input != null ? { index: i, value: field ? field.value : "" } : i);
    };
    const cancelIdx = cancel ?? buttons.length - 1;
    const w = openWindow({
      id: "msg-" + uid(), title, icon: ic === "question" ? "info" : ic, dialog: true, modal: parent && wins.has(parent.id) ? parent : null, minimizable: false,
      escClose: true, onEscape: () => finish(cancelIdx, w),
      onClose: () => { if (!done) { done = true; resolve(input != null ? { index: cancelIdx, value: "" } : cancelIdx); } },
      bodyClass: "dlg",
      build(w) {
        const p = h("p", {}, text);
        const box = h("div", {}, p);
        if (input != null) { field = h("input", { class: "field", value: input, "aria-label": text, autofocus: true }); box.append(field); field.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); finish(def, w); } }); }
        w.body.append(h("div", { class: "msg" }, icon(ic, { size: 32, scale: 1, still: true }), box));
        const row = h("div", { class: "btnrow", style: { justifyContent: "center" } });
        buttons.forEach((b, i) => row.append(h("button", { type: "button", class: "btn" + (i === def ? " def" : ""), autofocus: input == null && i === def ? true : null, onclick: () => finish(i, w) }, b)));
        w.body.append(row);
        w.el.style.maxWidth = "min(520px, calc(100vw - 16px))";
      },
    });
    if (field) setTimeout(() => { field.focus(); field.select(); }, 0);
    sfx(ic === "error" ? "error" : "ding");
  });
}

/* arrangement */
let undoMin = null;
export function minimizeAll() {
  const open = list().filter((w) => !w.min && w.o.minimizable !== false && !w.modal);
  if (!open.length && undoMin) { undoMin.forEach((w) => wins.has(w.id) && w.restore()); undoMin = null; return; }
  undoMin = open;
  open.forEach((w) => { w.min = true; w.el.hidden = true; w.el.classList.remove("active"); });
  activeId = null;
  bus.emit("wins");
}
export const canUndoMin = () => !!undoMin && list().every((w) => w.min || w.modal);
const arrangeable = () => list().filter((w) => !w.min && !w.o.dialog && w.o.resizable !== false);
function unmax(w) { if (w.max) { w.max = false; w.el.classList.remove("max"); } w.snap = null; }
export function cascadeWins() {
  const { w: dw, h: dh } = dims();
  arrangeable().forEach((w, i) => { unmax(w); Object.assign(w.el.style, { left: 12 + i * 28 + "px", top: 12 + i * 28 + "px", width: Math.min(620, dw - 60) + "px", height: Math.min(440, dh - 60) + "px" }); w.focus(false); });
}
export function tileWins(vertical) {
  const ws = arrangeable(), { w: dw, h: dh } = dims();
  if (!ws.length) return;
  const n = ws.length, cols = vertical ? n : Math.ceil(Math.sqrt(n)), rows = vertical ? 1 : Math.ceil(n / cols);
  ws.forEach((w, i) => {
    unmax(w);
    const c = i % cols, r = Math.floor(i / cols), cw = Math.floor(dw / cols), rh = Math.floor(dh / rows);
    Object.assign(w.el.style, { left: c * cw + "px", top: r * rh + "px", width: cw + "px", height: rh + "px" });
    bus.emit("win:resize", w);
  });
}
addEventListener("resize", () => {
  const { w: dw, h: dh } = dims();
  for (const w of wins.values()) {
    if (w.max || w.min) continue;
    const r = w.rect();
    if (r.x > dw - 60 || r.y > dh - 30) { w.el.style.left = clamp(r.x, 0, Math.max(0, dw - r.w)) + "px"; w.el.style.top = clamp(r.y, 0, Math.max(0, dh - r.h)) + "px"; }
  }
});
