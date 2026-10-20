// Shared helpers, settings and the event bus every module talks through.
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
export const small = () => matchMedia("(max-width: 760px)").matches;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const rand = (a, b) => a + Math.random() * (b - a);
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const EMAIL = "rohanahire1607@gmail.com";
export const TB = 48; // taskbar height, mirrors --tb in os.css (52 on phones; read tbH() for the live value)
export const tbH = () => document.querySelector(".taskbar")?.offsetHeight || TB;
export const bootTime = Date.now();

export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// Tiny element builder: h("div", { class: "x", onclick: fn }, child, "text")
export function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
    else if (k === "html") el.innerHTML = v;
    else if (k === "style" && typeof v === "object") Object.assign(el.style, v);
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid instanceof Node ? kid : document.createTextNode(kid));
  return el;
}

export const store = {
  get(k, d) { try { const v = localStorage.getItem("pxos-" + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem("pxos-" + k, JSON.stringify(v)); } catch (e) {} },
  del(k) { try { localStorage.removeItem("pxos-" + k); } catch (e) {} },
};
export const session = {
  get(k) { try { return sessionStorage.getItem("pxos-" + k); } catch (e) { return null; } },
  set(k, v) { try { sessionStorage.setItem("pxos-" + k, v); } catch (e) {} },
};

const handlers = {};
export const bus = {
  on(ev, fn) { (handlers[ev] ||= []).push(fn); return () => (handlers[ev] = handlers[ev].filter((f) => f !== fn)); },
  emit(ev, data) { (handlers[ev] || []).slice().forEach((fn) => fn(data)); },
};

const DEFAULTS = { wallpaper: "auto", scheme: "classic", saver: "cats", saverWait: 3, sound: true, volume: 0.6, me: true, meVoice: true, meMail: true, meQuiet: false, iconSize: "large", welcome: true };
export const settings = { ...DEFAULTS, ...store.get("settings", {}) };
export function setSettings(patch) {
  Object.assign(settings, patch);
  store.set("settings", settings);
  bus.emit("settings", patch);
}

let liveEl;
export function announce(msg) {
  liveEl ||= $("#live");
  liveEl.textContent = "";
  setTimeout(() => (liveEl.textContent = msg), 30);
}

export const fmtTime = (d = new Date()) => d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
export const fmtDate = (d = new Date()) => d.toLocaleDateString([], { weekday: "long", year: "numeric", month: "long", day: "numeric" });
export function fmtUptime() {
  const s = Math.floor((Date.now() - bootTime) / 1000);
  if (s < 60) return `${s} sec`;
  const m = Math.floor(s / 60);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`;
}
export const uid = () => Math.random().toString(36).slice(2, 9);

// One shared ~12.5fps ticker for pixel animation (wallpaper, icons, small canvases).
const ticks = new Set();
export function onTick(fn) { ticks.add(fn); return () => ticks.delete(fn); }
export function runTicks(t) { for (const fn of ticks) { try { fn(t); } catch (e) { console.error(e); } } }
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
