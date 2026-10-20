// Pop-up menus (context, start, menubar) with submenus, keyboard control and edge flipping.
import { h, $$ } from "./core.js";
import { icon } from "./px.js";
import { sfx } from "./sound.js";

let stack = []; // open menus, outermost first: { el, items, idx, parentItem, opts, timer }
let rootOpts = null;

export const menuOpen = () => stack.length > 0;

export function closeMenus(focusBack = true) {
  if (!stack.length) return;
  const opts = rootOpts;
  stack.forEach((m) => { clearTimeout(m.timer); m.el.remove(); });
  stack = [];
  rootOpts = null;
  document.removeEventListener("pointerdown", outside, true);
  document.removeEventListener("keydown", keys, true);
  removeEventListener("blur", blur);
  opts?.onClose?.();
  if (focusBack && opts?.restoreFocus && opts.restoreFocus.isConnected) opts.restoreFocus.focus({ preventScroll: true });
}
function closeFrom(level) {
  while (stack.length > level) { const m = stack.pop(); clearTimeout(m.timer); m.el.remove(); }
}
const outside = (e) => {
  if (stack.some((m) => m.el.contains(e.target))) return;
  if (rootOpts?.owner && rootOpts.owner.contains(e.target)) return;
  closeMenus(false);
};
const blur = () => closeMenus(false);

function itemsEls(m) { return $$(".mi", m.el); }
function setIdx(m, i, focus = true) {
  const els = itemsEls(m);
  els.forEach((el, k) => el.classList.toggle("on", k === i));
  m.idx = i;
  if (focus && els[i]) els[i].focus({ preventScroll: true });
}
function enabledList(m) { return m.items.map((it, i) => (!it.sep && !it.disabled ? i : -1)).filter((i) => i >= 0); }

function move(m, dir) {
  const list = enabledList(m);
  if (!list.length) return;
  const pos = list.indexOf(m.idx);
  const next = pos < 0 ? (dir > 0 ? list[0] : list[list.length - 1]) : list[(pos + dir + list.length) % list.length];
  setIdx(m, next);
}

function activate(m, i, viaKey) {
  const it = m.items[i];
  if (!it || it.disabled || it.sep) return;
  if (it.sub) { openSub(m, i, viaKey); return; }
  const opts = rootOpts;
  closeMenus(false);
  sfx("menu");
  if (it.action) it.action();
  else if (opts?.restoreFocus && opts.restoreFocus.isConnected) opts.restoreFocus.focus({ preventScroll: true });
}

function openSub(m, i, focusFirst) {
  const level = stack.indexOf(m);
  closeFrom(level + 1);
  const it = m.items[i];
  const anchor = itemsEls(m)[i];
  const items = typeof it.sub === "function" ? it.sub() : it.sub;
  build(items, { anchor, side: true, focusFirst, cls: m.opts.subCls || m.opts.cls?.replace("start", "") || "" }, m);
}

function keys(e) {
  const m = stack[stack.length - 1];
  if (!m) return;
  const k = e.key;
  if (["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight", "Enter", " ", "Escape", "Tab", "Home", "End"].includes(k)) { e.preventDefault(); e.stopPropagation(); }
  if (k === "ArrowDown") move(m, 1);
  else if (k === "ArrowUp") move(m, -1);
  else if (k === "Home") { const l = enabledList(m); setIdx(m, l[0]); }
  else if (k === "End") { const l = enabledList(m); setIdx(m, l[l.length - 1]); }
  else if (k === "ArrowRight") {
    const it = m.items[m.idx];
    if (it && it.sub && !it.disabled) openSub(m, m.idx, true);
    else if (rootOpts?.onNav) rootOpts.onNav(1);
  } else if (k === "ArrowLeft") {
    if (stack.length > 1) { closeFrom(stack.length - 1); const p = stack[stack.length - 1]; setIdx(p, p.idx); }
    else if (rootOpts?.onNav) rootOpts.onNav(-1);
  } else if (k === "Enter" || k === " ") { if (m.idx >= 0) activate(m, m.idx, true); }
  else if (k === "Escape") {
    if (stack.length > 1) { closeFrom(stack.length - 1); const p = stack[stack.length - 1]; setIdx(p, p.idx); }
    else closeMenus(true);
  } else if (k === "Tab") closeMenus(true);
  else if (k.length === 1 && /\w/.test(k)) {
    // jump to the next item starting with this letter
    const start = m.idx;
    for (let s = 1; s <= m.items.length; s++) {
      const j = (start + s + m.items.length) % m.items.length, it = m.items[j];
      if (!it.sep && !it.disabled && it.label && it.label.toLowerCase().startsWith(k.toLowerCase())) { setIdx(m, j); break; }
    }
  }
}

function build(items, opts, parent) {
  const el = h("div", { class: "menu " + (opts.cls || ""), role: "menu", tabindex: "-1", "aria-label": opts.label || null });
  const m = { el, items, idx: -1, opts, timer: 0 };
  const list = opts.band ? h("div", { class: "items" }) : el;
  if (opts.band) el.append(h("div", { class: "band", "aria-hidden": "true", html: opts.band }), list);
  const big = opts.cls && opts.cls.includes("start");
  items.forEach((it, i) => {
    if (it.sep) { list.append(h("div", { class: "msep", role: "separator" })); return; }
    const role = it.radio != null ? "menuitemradio" : it.checked != null ? "menuitemcheckbox" : "menuitem";
    const mark = it.radio ? h("span", { class: "rad" }) : it.checked ? h("span", { class: "chk" }) : it.icon ? icon(it.icon, { size: big ? 32 : 16, scale: 1, still: !big }) : null;
    const row = h("div", {
      class: "mi" + (it.disabled ? " dis" : "") + (it.bold ? " bold" : ""), role, tabindex: "-1",
      "aria-disabled": it.disabled ? "true" : null, "aria-haspopup": it.sub ? "menu" : null,
      "aria-checked": role !== "menuitem" ? String(!!(it.radio || it.checked)) : null,
    }, h("span", { class: "mic" }, mark), h("span", { class: "mil" }, it.label), h("span", { class: "mik" }, it.kbd || ""), h("span", { class: it.sub ? "mis" : "" }));
    row.addEventListener("pointerenter", (e) => {
      if (e.pointerType === "touch") return;
      setIdx(m, i, true);
      closeFrom(stack.indexOf(m) + 1);
      clearTimeout(m.timer);
      if (it.sub && !it.disabled) m.timer = setTimeout(() => openSub(m, i, false), 220);
    });
    row.addEventListener("click", (e) => { e.stopPropagation(); clearTimeout(m.timer); if (it.sub && stack[stack.indexOf(m) + 1]) return; activate(m, i, false); });
    list.append(row);
  });
  document.body.append(el);
  stack.push(m);
  place(el, opts);
  if (opts.focusFirst !== false && opts.focusFirst !== undefined) { const l = enabledList(m); if (l.length) setIdx(m, l[0]); else el.focus(); }
  else el.focus({ preventScroll: true });
  return m;
}

function place(el, { x, y, anchor, side, below }) {
  const r = el.getBoundingClientRect(), vw = innerWidth, vh = innerHeight;
  let left = x, top = y;
  if (anchor) {
    const a = anchor.getBoundingClientRect();
    if (side) { left = a.right - 3; top = a.top - 5; if (left + r.width > vw - 2) left = a.left - r.width + 3; }
    else if (below === "up") { left = a.left; top = a.top - r.height; }
    else { left = a.left; top = a.bottom; if (top + r.height > vh - 2) top = a.top - r.height; }
  }
  if (!side && !anchor) { if (left + r.width > vw - 2) left = Math.max(2, left - r.width); if (top + r.height > vh - 2) top = Math.max(2, top - r.height); }
  left = Math.max(2, Math.min(left, vw - r.width - 2));
  top = Math.max(2, Math.min(top, vh - r.height - 2));
  el.style.left = Math.round(left) + "px";
  el.style.top = Math.round(top) + "px";
}

// openMenu(items, { x, y } | { anchor, below: "up" }, { cls, band, onNav, owner, onClose, focusFirst, label })
export function openMenu(items, opts = {}) {
  closeMenus(false);
  rootOpts = { restoreFocus: opts.restoreFocus || document.activeElement, ...opts };
  build(items, opts);
  document.addEventListener("pointerdown", outside, true);
  document.addEventListener("keydown", keys, true);
  addEventListener("blur", blur);
  sfx("menu");
}

// A window menubar: spec = [{ label: "File", items: () => [...] }]
export function menubar(spec) {
  const bar = h("div", { class: "menubar", role: "menubar" });
  let openIdx = -1;
  const btns = spec.map((s, i) => {
    const b = h("button", { type: "button", class: "mb", role: "menuitem", "aria-haspopup": "menu", "aria-expanded": "false" }, s.label);
    const open = (focusFirst) => {
      btns.forEach((x) => x.setAttribute("aria-expanded", "false"));
      b.setAttribute("aria-expanded", "true");
      openIdx = i;
      openMenu(typeof s.items === "function" ? s.items() : s.items, {
        anchor: b, owner: bar, focusFirst, restoreFocus: b, label: s.label,
        onNav: (d) => { const j = (i + d + btns.length) % btns.length; btns[j].__open(true); },
        onClose: () => { b.setAttribute("aria-expanded", "false"); if (openIdx === i) openIdx = -1; },
      });
    };
    b.__open = open;
    b.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      if (openIdx === i) closeMenus(false); else open(false);
    });
    b.addEventListener("click", (e) => { if (e.detail === 0) open(true); });
    b.addEventListener("pointerenter", () => { if (openIdx >= 0 && openIdx !== i && menuOpen()) open(false); });
    b.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown") { e.preventDefault(); open(true); }
      if (e.key === "ArrowRight") { e.preventDefault(); btns[(i + 1) % btns.length].focus(); }
      if (e.key === "ArrowLeft") { e.preventDefault(); btns[(i - 1 + btns.length) % btns.length].focus(); }
    });
    return b;
  });
  bar.append(...btns);
  bar._open = (label) => { const b = btns.find((x) => x.textContent.toLowerCase().startsWith(label.toLowerCase())); if (b) b.__open(true); };
  return bar;
}
