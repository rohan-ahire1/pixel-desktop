// Power: the BIOS screen and splash, shut down / restart / stand by, and the screen savers.
import { h, $, bus, settings, session, reduce, sleep } from "./core.js";
import { px, drawMap, disc, LOGO, PAL16, K } from "./px.js";
import { list as winList } from "./wm.js";
import { sfx } from "./sound.js";

/* ---------- screen savers ---------- */
export const SAVERS = [
  { id: "cats", name: "Flying Cats" },
  { id: "starfield", name: "Starfield" },
  { id: "pipes", name: "Pipes" },
];
const CAT = [
  "..K.....K.......",
  ".KWK...KWK......",
  ".KWWKKKWWK....K.",
  ".KWWWWWWWK...KWK",
  "KWWKWWWKWWK..KWK",
  "KWPWWKWWWPK..KWK",
  ".KWWWWWWWK...KWK",
  "..KWWWWWWKKKKWK.",
  "..KWWWWWWWWWWWK.",
  "..KWWWWWWWWWWK..",
  "..KWK.KWK.KWK...",
  "..KK..KK..KK....",
];
const CAT_PAL = { K, W: "#eef0f8", P: "#ff8fb0" };
const WING_UP = ["......K.K", ".....KGK.", "....KGGK.", "...KGGK..", "..KGGK..."];
const WING_DN = ["..KGGK...", "...KGGK..", "....KGGGK", ".....KKK."];
const FISHY = ["..KK..K", ".KBBK.K", "KBKBBKK", ".KBBK.K", "..KK..K"];

export function saverScene(id, cv, small = false) {
  const W = small ? 190 : Math.max(160, Math.ceil(innerWidth / 3)), H = small ? 120 : Math.max(120, Math.ceil(innerHeight / 3));
  cv.width = W; cv.height = H;
  const c = cv.getContext("2d");
  c.fillStyle = "#000"; c.fillRect(0, 0, W, H);
  let last = null;
  const dt = (t) => { const d = last == null ? 0.08 : Math.min(0.25, t - last); last = t; return d; };

  if (id === "starfield") {
    const stars = Array.from({ length: small ? 70 : 220 }, () => ({ x: Math.random() * 2 - 1, y: Math.random() * 2 - 1, z: Math.random() }));
    return { draw(t) {
      const d = dt(t);
      c.fillStyle = "#000"; c.fillRect(0, 0, W, H);
      for (const s of stars) {
        s.z -= d * 0.32;
        if (s.z <= 0.02) { s.x = Math.random() * 2 - 1; s.y = Math.random() * 2 - 1; s.z = 1; }
        const sx = Math.round(W / 2 + (s.x / s.z) * W * 0.25), sy = Math.round(H / 2 + (s.y / s.z) * W * 0.25);
        if (sx < 0 || sy < 0 || sx >= W || sy >= H) { s.z = 0; continue; }
        const b = 1 - s.z;
        px(c, sx, sy, b > 0.75 ? "#ffffff" : b > 0.45 ? "#9aa3d8" : "#555a7a", b > 0.85 ? 2 : 1, b > 0.85 ? 2 : 1);
      }
    } };
  }
  if (id === "pipes") {
    const G = 6, cols = Math.floor(W / G), rows = Math.floor(H / G);
    const colors = [PAL16[4], PAL16[6], "#d9534f", "#f7c437", PAL16[5], "#b98ae0"];
    let pipes = [], segs = 0, acc = 0;
    const used = new Set();
    const spawn = () => {
      const p = { x: (Math.random() * cols) | 0, y: (Math.random() * rows) | 0, d: (Math.random() * 4) | 0, c: colors[pipes.length % colors.length] };
      pipes.push(p); joint(p);
    };
    const shade = (hex, k) => { const n = parseInt(hex.slice(1), 16); const f = (v) => Math.max(0, Math.min(255, Math.round(v * k))); return `rgb(${f(n >> 16 & 255)},${f(n >> 8 & 255)},${f(n & 255)})`; };
    const joint = (p) => { disc(c, p.x * G + G / 2, p.y * G + G / 2, 3, [p.c, shade(p.c, 1.5), shade(p.c, 0.55)]); };
    const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];
    const reset = () => { c.fillStyle = "#000"; c.fillRect(0, 0, W, H); pipes = []; segs = 0; used.clear(); spawn(); };
    reset();
    const step = () => {
      for (const p of pipes) {
        if (Math.random() < 0.22) { p.d = (p.d + (Math.random() < 0.5 ? 1 : 3)) % 4; joint(p); }
        let [dx, dy] = DIRS[p.d], nx = p.x + dx, ny = p.y + dy;
        if (nx < 0 || ny < 0 || nx >= cols || ny >= rows || used.has(nx + "," + ny)) {
          const ok = [0, 1, 2, 3].filter((d) => { const [a, b] = DIRS[d], x = p.x + a, y = p.y + b; return x >= 0 && y >= 0 && x < cols && y < rows && !used.has(x + "," + y); });
          if (!ok.length) { p.dead = true; continue; }
          p.d = ok[(Math.random() * ok.length) | 0]; joint(p); [dx, dy] = DIRS[p.d]; nx = p.x + dx; ny = p.y + dy;
        }
        const x0 = Math.min(p.x, nx) * G + G / 2, y0 = Math.min(p.y, ny) * G + G / 2;
        if (dx) { c.fillStyle = shade(p.c, 0.55); c.fillRect(x0, y0 - 2, G + 1, 5); c.fillStyle = p.c; c.fillRect(x0, y0 - 2, G + 1, 3); c.fillStyle = shade(p.c, 1.5); c.fillRect(x0, y0 - 1, G + 1, 1); }
        else { c.fillStyle = shade(p.c, 0.55); c.fillRect(x0 - 2, y0, 5, G + 1); c.fillStyle = p.c; c.fillRect(x0 - 2, y0, 3, G + 1); c.fillStyle = shade(p.c, 1.5); c.fillRect(x0 - 1, y0, 1, G + 1); }
        used.add(nx + "," + ny); p.x = nx; p.y = ny; segs++;
      }
      pipes = pipes.filter((p) => !p.dead);
      if (pipes.length < 3 && Math.random() < 0.08) spawn();
      if (!pipes.length) spawn();
      if (segs > cols * rows * 0.55) reset();
    };
    return { draw(t) { acc += dt(t); while (acc > 0.06) { acc -= 0.06; step(); } } };
  }
  // flying cats (and the odd fish), drifting down-left like a certain classic
  const stars = Array.from({ length: Math.round(W * H / 500) }, () => ({ x: Math.random() * W, y: Math.random() * H, p: Math.random() * 6 }));
  const n = small ? 5 : Math.max(7, Math.round(W * H / 4200));
  const flock = Array.from({ length: n }, () => ({ x: Math.random() * W * 1.4, y: Math.random() * H * 1.2 - H * 0.3, sp: 14 + Math.random() * 14, ph: Math.random() * 6, fish: Math.random() < 0.2 }));
  return { draw(t) {
    const d = dt(t);
    c.fillStyle = "#060a2a"; c.fillRect(0, 0, W, H);
    for (const s of stars) if (Math.sin(t * 2 + s.p) > -0.6) px(c, s.x | 0, s.y | 0, Math.sin(t * 3 + s.p) > 0.7 ? "#ffffff" : "#555a7a");
    flock.sort((a, b) => a.sp - b.sp);
    for (const f of flock) {
      f.x -= f.sp * d; f.y += f.sp * d * 0.5;
      if (f.x < -24 || f.y > H + 16) { if (Math.random() < 0.5) { f.x = W + Math.random() * 40; f.y = Math.random() * H - 20; } else { f.x = Math.random() * W + 30; f.y = -16 - Math.random() * 30; } f.fish = Math.random() < 0.2; }
      const x = Math.round(f.x), y = Math.round(f.y);
      if (f.fish) { drawMap(c, FISHY, x, y, { K, B: "#8fb3ff" }); continue; }
      drawMap(c, CAT, x, y, CAT_PAL);
      const up = Math.floor(t * 5 + f.ph) % 2;
      drawMap(c, up ? WING_UP : WING_DN, x + 6, up ? y - 3 : y + 4, { K, G: "#b9c6f5" });
    }
  } };
}

let saverEl = null;
function runSaver(id, preview) {
  if (saverEl || !SAVERS.some((s) => s.id === id)) return;
  const cv = h("canvas", { "aria-hidden": "true" });
  saverEl = h("div", { class: "overlay saver", role: "presentation", tabindex: "-1" }, cv, h("span", { class: "sr" }, "Screen saver. Press any key to return."));
  document.body.append(saverEl);
  const back = document.activeElement;
  const sc = saverScene(id, cv, false);
  let raf, t0 = performance.now(), lastDraw = 0;
  const loop = (now) => { if (now - lastDraw > (reduce ? 200 : 33)) { lastDraw = now; sc.draw((now - t0) / 1000); } raf = requestAnimationFrame(loop); };
  raf = requestAnimationFrame(loop);
  saverEl.focus({ preventScroll: true });
  const born = performance.now();
  let sx = null, sy = null;
  const stop = (e) => {
    if (performance.now() - born < (preview ? 600 : 300)) return;
    if (e.type === "pointermove") { if (sx == null) { sx = e.clientX; sy = e.clientY; return; } if (Math.hypot(e.clientX - sx, e.clientY - sy) < 8) return; }
    if (e.type === "keydown" || e.type === "pointerdown") { e.preventDefault(); e.stopPropagation(); }
    cancelAnimationFrame(raf);
    for (const ev of ["pointermove", "pointerdown", "keydown", "wheel"]) removeEventListener(ev, stop, true);
    saverEl.remove(); saverEl = null; idleAt = performance.now();
    back && back.isConnected && back.focus({ preventScroll: true });
  };
  for (const ev of ["pointermove", "pointerdown", "keydown", "wheel"]) addEventListener(ev, stop, { capture: true });
}
export const previewSaver = (id) => runSaver(id, true);

let idleAt = performance.now();
function initIdle() {
  for (const ev of ["pointermove", "pointerdown", "keydown", "wheel", "touchstart"]) addEventListener(ev, () => (idleAt = performance.now()), { capture: true, passive: true });
  setInterval(() => {
    if (settings.saver === "none" || reduce || document.hidden || saverEl || $(".overlay")) return;
    if (document.fullscreenElement && document.fullscreenElement.tagName === "VIDEO") return;
    if (performance.now() - idleAt > (settings.saverWait || 3) * 60000) runSaver(settings.saver, false);
  }, 4000);
}

/* ---------- boot ---------- */
function logoCanvas(scale) {
  const cv = h("canvas", { class: "px logo", width: "12", height: "14", "aria-hidden": "true", style: { width: 12 * scale + "px", height: 14 * scale + "px" } });
  drawMap(cv.getContext("2d"), LOGO, 1, 1, { K, W: "#ffffff" });
  return cv;
}
function skippable(el) {
  let done, skip = false;
  const p = new Promise((r) => (done = r));
  const go = (e) => { if (e.type === "keydown" && ["Shift", "Control", "Alt", "Meta"].includes(e.key)) return; skip = true; done(); };
  el.addEventListener("pointerdown", go);
  addEventListener("keydown", go, true);
  return { wait: (ms) => Promise.race([sleep(ms), p]), get skipped() { return skip; }, off: () => removeEventListener("keydown", go, true) };
}
async function bios(ov, sk) {
  const lines = h("div");
  const cores = navigator.hardwareConcurrency || 4, kb = (navigator.deviceMemory || 8) * 1048576;
  const mem = h("span", {}, "0");
  ov.className = "overlay bios";
  ov.replaceChildren(
    h("div", { class: "hd" }, h("div", {}, h("div", {}, "PixelBIOS (C) 2026 Rohan Ahire"), h("div", { class: "dim" }, "Release 1.07, built for the web")), logoCanvas(5)),
    h("br"), lines,
    h("div", { class: "foot" }, h("span", {}, "Press any key to skip"), h("span", {}, new Date().toLocaleDateString([], { year: "numeric", month: "2-digit", day: "2-digit" }))));
  const add = (...k) => { lines.append(h("div", {}, ...k)); };
  add(`CPU: ${cores}-core browser engine at a comfortable speed`);
  add("Memory Test: ", mem, " KB ");
  const t0 = performance.now();
  while (!sk.skipped) {
    const f = Math.min(1, (performance.now() - t0) / 700);
    mem.textContent = Math.round(kb * f).toLocaleString("en-US");
    if (f >= 1) break;
    await sk.wait(40);
  }
  mem.after(h("span", { class: "ok" }, "OK"));
  const steps = [["Detecting drive C: ", "PIXELOS"], ["Detecting drive D: ", "PROJECTS"], ["Display: ", `${screen.width}x${screen.height}, 16 colours`], ["Sound: ", "synth ready"], ["Rohan ", "found, coding"], ["Coffee ", "not detected"]];
  for (const [a, b] of steps) { if (sk.skipped) break; await sk.wait(170); add(a, h("span", { class: b === "not detected" ? "dim" : "ok" }, b)); }
  if (!sk.skipped) { await sk.wait(220); add(h("br")); add("Starting PixelOS…"); await sk.wait(450); }
}
async function splash(ov, sk, ms, text = "ROHAN AHIRE · 2026") {
  ov.className = "overlay splash";
  const bar = h("div", { class: "bar", "aria-hidden": "true" }, h("i"), h("i"), h("i"));
  ov.replaceChildren(h("div", {}, logoCanvas(8), h("h1", {}, "Pixel", h("b", {}, "OS")), h("p", {}, text), bar), h("div", { class: "skip" }, "Press any key to skip"));
  ov.setAttribute("aria-label", "PixelOS is starting");
  let x = -48;
  const iv = setInterval(() => { x = x > bar.clientWidth ? -48 : x + 15; bar.firstChild.style.marginLeft = x + "px"; }, 70);
  await sk.wait(ms);
  clearInterval(iv);
}
function overlay() {
  const ov = h("div", { class: "overlay", role: "status", "aria-live": "polite" });
  document.body.append(ov);
  return ov;
}
async function fadeOut(ov) {
  if (!reduce) { ov.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 260, easing: "steps(4, end)", fill: "forwards" }); await sleep(260); }
  ov.remove();
}

// Shows the BIOS and splash on the first visit of a session. Resolves when the desktop should appear.
export async function boot() {
  if (session.get("booted") || reduce || new URLSearchParams(location.search).has("nosplash")) { session.set("booted", "1"); return; }
  session.set("booted", "1");
  const ov = overlay(), sk = skippable(ov);
  await bios(ov, sk);
  if (!sk.skipped) await splash(ov, sk, 1900);
  sk.off();
  sfx("startup");
  await fadeOut(ov);
}

/* ---------- shut down ---------- */
let busy = false;
async function closeAll() {
  for (const w of winList().slice().reverse()) {
    if (w.modal) continue;
    await w.close();
    if (winList().includes(w)) return false; // the user cancelled (unsaved work)
  }
  return true;
}
function trapTab(root) {
  root.addEventListener("keydown", (e) => {
    if (e.key !== "Tab") return;
    const f = [...root.querySelectorAll("button:not([disabled]), input:not([disabled])")].filter((x) => x.offsetParent && !(x.type === "radio" && !x.checked));
    if (!f.length) return;
    const i = f.indexOf(document.activeElement), n = e.shiftKey ? (i <= 0 ? f.length - 1 : i - 1) : (i + 1) % f.length;
    e.preventDefault(); f[n].focus();
  });
}
function askShutdown() {
  return new Promise((resolve) => {
    const back = document.activeElement;
    const opt = (v, label, checked) => {
      const r = h("input", { type: "radio", name: "sd", value: v, id: "sd-" + v, checked });
      return h("label", { for: "sd-" + v }, r, label);
    };
    const opts = h("div", { class: "opts", role: "radiogroup", "aria-label": "What do you want the computer to do?" },
      opt("off", "Shut down the computer", true), opt("restart", "Restart the computer", false), opt("standby", "Stand by", false));
    const finish = (v) => { ov.remove(); document.removeEventListener("keydown", esc, true); if (!v && back?.isConnected) back.focus({ preventScroll: true }); resolve(v); };
    const esc = (e) => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); finish(null); } };
    const ok = h("button", { type: "button", class: "btn def", onclick: () => finish(opts.querySelector("input:checked").value) }, "Yes");
    const ttl = h("span", { class: "ttl", id: "sd-t" }, "Shut Down PixelOS");
    const win = h("section", { class: "win dialog active", role: "alertdialog", "aria-modal": "true", "aria-labelledby": "sd-t" },
      h("div", { class: "tbar" }, h("span", { class: "ticon" }, logoCanvas(1)), ttl),
      h("div", { class: "wbody dlg" },
        h("div", { class: "msg" }, logoCanvas(3), h("div", {}, h("p", { style: { marginTop: 0 } }, "What do you want the computer to do?"), opts)),
        h("div", { class: "btnrow", style: { justifyContent: "center" } }, ok, h("button", { type: "button", class: "btn", onclick: () => finish(null) }, "No"))));
    const ov = h("div", { class: "overlay shade" }, win);
    ov.addEventListener("pointerdown", (e) => { if (e.target === ov) { sfx("ding"); win.classList.remove("flash"); void win.offsetWidth; win.classList.add("flash"); } });
    opts.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); ok.click(); } });
    document.addEventListener("keydown", esc, true);
    trapTab(win);
    document.body.append(ov);
    sfx("ding");
    opts.querySelector("input").focus();
  });
}
async function standby() {
  const ov = h("div", { class: "overlay off", style: { background: "#000" }, tabindex: "-1" },
    h("div", {}, h("div", { class: "led", "aria-hidden": "true", style: { width: "10px", height: "10px", margin: "0 auto 18px", background: "#f5a623", animation: reduce ? "none" : "blink 2s steps(1) infinite" } }),
      h("p", { style: { fontSize: "16px", color: "#6b7194", fontFamily: "var(--mono)" } }, "Stand by. Move the mouse or press a key to wake.")));
  document.body.append(ov);
  ov.focus();
  await sleep(700);
  await new Promise((r) => { const go = (e) => { if (e.type === "keydown") e.preventDefault(); ["pointerdown", "keydown", "pointermove"].forEach((ev) => removeEventListener(ev, go, true)); r(); }; ["pointerdown", "keydown", "pointermove"].forEach((ev) => addEventListener(ev, go, true)); });
  ov.remove();
  sfx("max");
}
async function powerOff(mode, onReady) {
  if (!(await closeAll())) return;
  const ov = overlay();
  ov.className = "overlay off wait";
  ov.replaceChildren(h("div", {}, logoCanvas(6), h("p", { style: { marginTop: "22px" } }, mode === "restart" ? "PixelOS is restarting…" : "PixelOS is shutting down…")));
  sfx("shutdown");
  document.body.classList.add("busy");
  await sleep(reduce ? 400 : 1400);
  document.body.classList.remove("busy");
  if (mode === "off") {
    ov.className = "overlay off";
    const again = h("button", { type: "button", class: "btn", style: { fontFamily: "var(--ui)" } }, "Start PixelOS again");
    ov.replaceChildren(h("div", {}, h("p", {}, "It's now safe to close this tab."), again,
      h("p", { style: { fontSize: "14px", marginTop: "26px", fontFamily: "var(--mono)", color: "#8a6a2a" } }, "Thanks for visiting. rohanahire1607@gmail.com")));
    again.focus();
    await new Promise((r) => again.addEventListener("click", r, { once: true }));
  }
  const sk = skippable(ov);
  await splash(ov, sk, reduce ? 300 : 1500);
  sk.off();
  bus.emit("shell:restart");
  sfx("startup");
  await fadeOut(ov);
  onReady && onReady();
}

export function initPower({ onReady } = {}) {
  initIdle();
  bus.on("shell:shutdown", async (how) => {
    if (busy) return;
    busy = true;
    try {
      const mode = how === "now" ? "off" : how === "restart" ? "restart" : await askShutdown();
      if (mode === "standby") await standby();
      else if (mode) await powerOff(mode, onReady);
    } finally { busy = false; }
  });
}
