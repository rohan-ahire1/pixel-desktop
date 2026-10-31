// Minesweeper: three levels, safe first click, chording, long-press to flag, best times.
import { h, bus, store, announce, phone } from "../core.js";
import { K, px, disc, drawMap } from "../px.js";
import { openWindow, msgbox } from "../wm.js";
import { sfx } from "../sound.js";
import { launch } from "./index.js";

const LEVELS = { beginner: { name: "Beginner", c: 9, r: 9, m: 10 }, intermediate: { name: "Intermediate", c: 16, r: 16, m: 40 }, expert: { name: "Expert", c: 30, r: 16, m: 99 } };
const CS = 16;
const LIGHT = "#ffffff", BASE = "#d9dbe6", DARK = "#7b80a0", OPEN = "#c9ccd9";
const NUMC = [null, "#0b2fa8", "#1f6f4c", "#d9534f", "#10135e", "#8b1f2a", "#127a7a", "#10132e", "#6b7194"];
const DIG = {
  1: ["..K..", ".KK..", "..K..", "..K..", "..K..", "..K..", ".KKK."],
  2: [".KKK.", "K...K", "....K", "...K.", "..K..", ".K...", "KKKKK"],
  3: ["KKKK.", "....K", "....K", ".KKK.", "....K", "....K", "KKKK."],
  4: ["...K.", "..KK.", ".K.K.", "K..K.", "KKKKK", "...K.", "...K."],
  5: ["KKKKK", "K....", "KKKK.", "....K", "....K", "K...K", ".KKK."],
  6: [".KKK.", "K....", "K....", "KKKK.", "K...K", "K...K", ".KKK."],
  7: ["KKKKK", "....K", "...K.", "..K..", ".K...", ".K...", ".K..."],
  8: [".KKK.", "K...K", "K...K", ".KKK.", "K...K", "K...K", ".KKK."],
};
const MINE = ["......K......", "..K..KKK..K..", "...KKKKKKK...", "..KKWWKKKKK..", "..KWWKKKKKKK.", ".KKKKKKKKKKKK", "KKKKKKKKKKKKK", ".KKKKKKKKKKK.", "..KKKKKKKKK..", "..KKKKKKKKK..", "...KKKKKKK...", "..K..KKK..K..", "......K......"];
const FLAG = ["......RR....", "....RRRR....", "..RRRRRR....", "....RRRR....", "......RR....", ".......K....", ".......K....", ".....KKKK...", "...KKKKKKKK."];
// 7-seg LED
const SEG = { a: [2, 0, 7, 2], b: [9, 2, 2, 8], c: [9, 12, 2, 8], d: [2, 20, 7, 2], e: [0, 12, 2, 8], f: [0, 2, 2, 8], g: [2, 10, 7, 2] };
const NUM7 = ["abcdef", "bc", "abged", "abgcd", "fgbc", "afgcd", "afgedc", "abc", "abcdefg", "abcdfg"];

function drawLED(c, n) {
  c.fillStyle = "#000"; c.fillRect(0, 0, 41, 23);
  const s = n < 0 ? "-" + String(Math.min(99, -n)).padStart(2, "0") : String(Math.min(999, n)).padStart(3, "0");
  [...s].forEach((ch, i) => {
    const on = ch === "-" ? "g" : NUM7[+ch];
    Object.entries(SEG).forEach(([k, [x, y, w, hh]]) => { c.fillStyle = on.includes(k) ? "#ff2b2b" : "#3a0808"; c.fillRect(1 + i * 14 + x, y, w, hh); });
  });
}
function drawFace(c, mood) {
  c.clearRect(0, 0, 24, 24);
  disc(c, 12, 12, 10, ["#f7c437", "#ffe58a", "#de9418"]);
  c.fillStyle = K;
  for (let a = 0; a < 6.3; a += 0.05) px(c, Math.round(12 + Math.cos(a) * 10.4 - 0.5), Math.round(12 + Math.sin(a) * 10.4 - 0.5), K);
  if (mood === "dead") { [[7, 8], [9, 10], [8, 9], [7, 10], [9, 8], [14, 8], [16, 10], [15, 9], [14, 10], [16, 8]].forEach(([x, y]) => px(c, x, y, K)); }
  else if (mood === "cool") { c.fillRect(5, 8, 14, 2); c.fillRect(6, 9, 5, 3); c.fillRect(13, 9, 5, 3); px(c, 4, 7, K); px(c, 19, 7, K); }
  else { c.fillRect(8, 8, 2, 2); c.fillRect(14, 8, 2, 2); }
  if (mood === "o") { c.fillRect(11, 14, 2, 1); c.fillRect(10, 15, 1, 2); c.fillRect(13, 15, 1, 2); c.fillRect(11, 17, 2, 1); }
  else if (mood === "dead") { c.fillRect(8, 16, 8, 1); px(c, 7, 17, K); px(c, 16, 17, K); }
  else { px(c, 7, 14, K); px(c, 16, 14, K); c.fillRect(8, 15, 1, 1); c.fillRect(15, 15, 1, 1); c.fillRect(9, 16, 6, 1); }
}

export function open(arg, from) {
  let lv = store.get("minesLevel", "beginner"), L, cells, state, flags, opened, t0, secs, timer, cur = 0, scale = 2, pressed = null;
  const best = store.get("minesBest", {});
  const cv = h("canvas", { class: "px", tabindex: "0", role: "grid", "aria-label": "Minefield. Arrow keys move, Space opens, F flags." });
  const c = cv.getContext("2d");
  const ledL = h("canvas", { class: "px", width: "41", height: "23", role: "img" }), ledR = h("canvas", { class: "px", width: "41", height: "23", role: "img" });
  const faceCv = h("canvas", { class: "px", width: "24", height: "24", "aria-hidden": "true" });
  const face = h("button", { type: "button", class: "face", "aria-label": "New game (F2)", "data-tip": "New game (F2)", onclick: () => reset() }, faceCv);
  const fc = faceCv.getContext("2d");
  const grid = h("div", { class: "mgrid" }, cv);

  const idx = (x, y) => y * L.c + x;
  const around = (i) => { const x = i % L.c, y = (i / L.c) | 0, out = []; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { if (!dx && !dy) continue; const nx = x + dx, ny = y + dy; if (nx >= 0 && ny >= 0 && nx < L.c && ny < L.r) out.push(idx(nx, ny)); } return out; };

  function drawCell(i) {
    const x = (i % L.c) * CS, y = ((i / L.c) | 0) * CS, k = cells[i];
    const isPressed = pressed && pressed.includes(i) && !k.open && !k.flag;
    if (k.open || isPressed || (state === "lost" && k.mine && !k.flag)) {
      c.fillStyle = k.boom ? "#ff3b3b" : OPEN; c.fillRect(x, y, CS, CS);
      c.fillStyle = DARK; c.fillRect(x, y, CS, 1); c.fillRect(x, y, 1, CS);
      if (k.mine && !isPressed) drawMap(c, MINE, x + 2, y + 2, { K, W: "#fff" });
      else if (k.n && !isPressed) drawMap(c, DIG[k.n], x + 6, y + 5, { K: NUMC[k.n] });
    } else {
      c.fillStyle = BASE; c.fillRect(x, y, CS, CS);
      c.fillStyle = LIGHT; c.fillRect(x, y, CS - 1, 2); c.fillRect(x, y, 2, CS - 1);
      c.fillStyle = DARK; c.fillRect(x + 1, y + CS - 2, CS - 1, 2); c.fillRect(x + CS - 2, y + 1, 2, CS - 1);
      if (k.flag) {
        drawMap(c, FLAG, x + 2, y + 3, { R: "#e5352b", K });
        if (state === "lost" && !k.mine) { c.fillStyle = "#e5352b"; for (let j = 2; j < 14; j++) { c.fillRect(x + j, y + j, 1, 1); c.fillRect(x + 15 - j, y + j, 1, 1); } }
      }
    }
    if (i === cur && document.activeElement === cv && kbdUsed) { c.strokeStyle = "#0b2fa8"; c.lineWidth = 1; c.setLineDash([2, 2]); c.strokeRect(x + 2.5, y + 2.5, CS - 5, CS - 5); c.setLineDash([]); }
  }
  let kbdUsed = false;
  const drawAll = () => cells.forEach((_, i) => drawCell(i));
  const leds = () => { drawLED(ledL.getContext("2d"), L.m - flags); drawLED(ledR.getContext("2d"), secs); ledL.setAttribute("aria-label", `${L.m - flags} mines left`); ledR.setAttribute("aria-label", `${secs} seconds`); };
  const mood = (m) => drawFace(fc, m || (state === "won" ? "cool" : state === "lost" ? "dead" : "smile"));

  function fit() {
    const avail = Math.min(innerWidth - 40, (w ? w.el.parentElement.clientWidth : innerWidth) - 40);
    const availH = (w ? w.el.parentElement.clientHeight : innerHeight) - 150;
    scale = Math.max(1, Math.min(2, Math.floor(avail / (L.c * CS)), Math.floor(availH / (L.r * CS))));
    if (phone()) {
      // as big as the screen allows, on whole device pixels so the art stays sharp; a board too big to fit pans
      const dpr = devicePixelRatio || 1, wide = w.el.parentElement.clientWidth - 30, tall = w.el.parentElement.clientHeight - (innerWidth > innerHeight ? 100 : 190);
      scale = Math.max(1.5, Math.floor(Math.min(3, wide / (L.c * CS), tall / (L.r * CS)) * dpr) / dpr);
    }
    cv.style.width = L.c * CS * scale + "px"; cv.style.height = L.r * CS * scale + "px";
  }
  function reset(level) {
    if (level) { lv = level; store.set("minesLevel", lv); }
    L = LEVELS[lv];
    clearInterval(timer); timer = 0;
    cells = Array.from({ length: L.c * L.r }, () => ({ mine: false, open: false, flag: false, n: 0, boom: false }));
    state = "ready"; flags = 0; opened = 0; secs = 0; cur = Math.min(cur, cells.length - 1);
    cv.width = L.c * CS; cv.height = L.r * CS;
    fit(); drawAll(); leds(); mood();
    if (w && level) { w.el.style.width = ""; w.el.style.height = ""; requestAnimationFrame(() => { const r = w.rect(), dw = w.el.parentElement.clientWidth; if (r.x + w.el.offsetWidth > dw) w.el.style.left = Math.max(4, dw - w.el.offsetWidth - 4) + "px"; }); }
  }
  function lay(safe) {
    const ban = new Set([safe, ...around(safe)]);
    const pool = cells.map((_, i) => i).filter((i) => !ban.has(i) || cells.length - ban.size < L.m);
    for (let k = 0; k < L.m; k++) { const j = k + Math.floor(Math.random() * (pool.length - k)); [pool[k], pool[j]] = [pool[j], pool[k]]; cells[pool[k]].mine = true; }
    cells.forEach((k, i) => (k.n = around(i).filter((j) => cells[j].mine).length));
    state = "play"; t0 = Date.now(); secs = 1; leds();
    timer = setInterval(() => { secs = Math.min(999, Math.floor((Date.now() - t0) / 1000) + 1); leds(); }, 250);
  }
  function reveal(i) {
    if (state === "ready") lay(i);
    if (state !== "play") return;
    const k = cells[i];
    if (k.open || k.flag) return;
    if (k.mine) return lose(i);
    const stack = [i];
    while (stack.length) {
      const j = stack.pop(), q = cells[j];
      if (q.open || q.flag) continue;
      q.open = true; opened++; drawCell(j);
      if (!q.n) around(j).forEach((n) => { if (!cells[n].open) stack.push(n); });
    }
    sfx("click");
    if (opened === cells.length - L.m) win();
  }
  function chord(i) {
    const k = cells[i];
    if (!k.open || !k.n || state !== "play") return;
    const nb = around(i);
    if (nb.filter((j) => cells[j].flag).length !== k.n) return;
    nb.forEach((j) => { if (state === "play") reveal(j); });
  }
  function flag(i) {
    if (state !== "play" && state !== "ready") return;
    const k = cells[i];
    if (k.open) return;
    k.flag = !k.flag; flags += k.flag ? 1 : -1;
    drawCell(i); leds(); sfx("pop");
    if (navigator.vibrate) try { navigator.vibrate(12); } catch {}
  }
  function lose(i) {
    state = "lost"; clearInterval(timer);
    cells[i].boom = true;
    drawAll(); mood(); sfx("boom"); bus.emit("mines:lose");
    w.el.animate?.([{ translate: "0 0" }, { translate: "-4px 2px" }, { translate: "4px -2px" }, { translate: "-2px 0" }, { translate: "0 0" }], { duration: 260 });
    announce("Boom. You hit a mine. Press F2 for a new game.");
  }
  async function win() {
    state = "won"; clearInterval(timer);
    cells.forEach((k) => { if (k.mine && !k.flag) { k.flag = true; flags++; } });
    drawAll(); leds(); mood(); sfx("win"); bus.emit("mines:win");
    announce(`You won in ${secs} seconds.`);
    if (!best[lv] || secs < best[lv].t) {
      const r = await msgbox({ title: "Minesweeper", icon: "info", parent: w, text: `New best time for ${L.name}: ${secs} seconds!\nType your name.`, input: store.get("minesName", "Anonymous"), buttons: ["OK"] });
      const name = (r && r.value ? r.value : "Anonymous").slice(0, 24);
      store.set("minesName", name);
      best[lv] = { t: secs, name }; store.set("minesBest", best);
      showBest();
    } else bus.emit("notify", { title: "You won!", text: `${L.name} in ${secs} seconds. Best: ${best[lv].t}s.`, icon: "mines" });
  }
  function showBest() {
    const rows = Object.entries(LEVELS).map(([k, l]) => `${l.name.padEnd(13)} ${best[k] ? `${String(best[k].t).padStart(3)} s   ${best[k].name}` : "999 s   Anonymous"}`).join("\n");
    msgbox({ title: "Fastest Mine Sweepers", icon: "mines", parent: w, text: rows, buttons: ["OK", "Reset Scores"], cancel: 0 }).then((b) => { if (b === 1) { Object.keys(best).forEach((k) => delete best[k]); store.set("minesBest", best); } });
  }

  // pointer: left reveals, right flags, both/middle/double on numbers chords, long-press flags
  let down = null, lp = 0, both = false;
  const cellAt = (e) => { const r = cv.getBoundingClientRect(), x = Math.floor(((e.clientX - r.left) / r.width) * L.c), y = Math.floor(((e.clientY - r.top) / r.height) * L.r); return x >= 0 && y >= 0 && x < L.c && y < L.r ? idx(x, y) : -1; };
  const press = (i, ch) => { const old = pressed; pressed = i < 0 ? null : ch ? [i, ...around(i)] : [i]; old && old.forEach(drawCell); pressed && pressed.forEach(drawCell); };
  cv.addEventListener("contextmenu", (e) => e.preventDefault());
  cv.addEventListener("pointerdown", (e) => {
    if (state === "won" || state === "lost") return;
    kbdUsed = false;
    const i = cellAt(e); if (i < 0) return;
    cv.setPointerCapture(e.pointerId);
    if (e.button === 2 && down) { both = true; press(i, true); return; }
    if (e.button === 2) { if (e.pointerType === "mouse") flag(i); return; }
    both = e.button === 1 || (e.buttons & 3) === 3;
    down = { i, type: e.pointerType, t: Date.now() };
    mood("o"); press(i, both);
    if (e.pointerType !== "mouse") { clearTimeout(lp); lp = setTimeout(() => { if (down) { flag(down.i); down = null; press(-1); mood(); } }, 380); }
  });
  cv.addEventListener("pointermove", (e) => { if (!down) return; const i = cellAt(e); if (i !== down.i) { if (down.type !== "mouse") { clearTimeout(lp); } down.i = i; press(i, both); } });
  cv.addEventListener("pointerup", (e) => {
    clearTimeout(lp);
    if (!down) { if (both) { both = false; press(-1); mood(); } return; }
    const i = down.i; down = null; press(-1);
    if (i >= 0) { if (both || cells[i].open) chord(i); else reveal(i); }
    both = false;
    if (state === "play" || state === "ready") mood();
  });
  cv.addEventListener("pointercancel", () => { clearTimeout(lp); down = null; both = false; press(-1); mood(); });
  cv.addEventListener("dblclick", (e) => { const i = cellAt(e); if (i >= 0) chord(i); });
  cv.addEventListener("keydown", (e) => {
    const x = cur % L.c, y = (cur / L.c) | 0;
    const mv = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (mv) { kbdUsed = true; const o = cur; cur = idx((x + mv[0] + L.c) % L.c, (y + mv[1] + L.r) % L.r); drawCell(o); drawCell(cur); e.preventDefault(); return; }
    if (e.key === " " || e.key === "Enter") { kbdUsed = true; e.preventDefault(); cells[cur].open ? chord(cur) : reveal(cur); drawCell(cur); }
    else if (e.key.toLowerCase() === "f" && !e.ctrlKey && !e.metaKey) { kbdUsed = true; flag(cur); }
  });
  cv.addEventListener("focus", () => drawCell(cur)); cv.addEventListener("blur", () => kbdUsed && drawCell(cur));

  const w = openWindow({
    id: "mines", title: "Minesweeper", icon: "mines", app: "mines", w: "auto", h: "auto", resizable: false, maximizable: false, remember: false, from, bodyClass: phone() ? "mwrap" : "",
    onClose: () => { clearInterval(timer); removeEventListener("resize", fit); },
    menubar: [
      { label: "Game", items: () => [
        { label: "New", kbd: "F2", action: () => reset() },
        { sep: true },
        ...Object.entries(LEVELS).map(([k, l]) => ({ label: `${l.name}  (${l.c}×${l.r}, ${l.m} mines)`, radio: lv === k, action: () => reset(k) })),
        { sep: true },
        { label: "Best Times…", action: showBest },
        { sep: true },
        { label: "Exit", action: () => w.close() },
      ] },
      { label: "Help", items: () => [
        { label: "How to Play", action: () => msgbox({ title: "Minesweeper", icon: "mines", parent: w, text: phone() ? "Open every square that isn't a mine.\nA number shows how many mines touch that square.\nTouch and hold to plant a flag.\nTap a number with the right flags around it to open its neighbours.\nYour first tap is always safe." : "Open every square that isn't a mine.\nA number shows how many mines touch that square.\nRight-click (or long-press) to plant a flag.\nClick a number with the right flags around it to open its neighbours.\nYour first click is always safe." }) },
        { label: "Help Topics", icon: "help", kbd: "F1", action: () => launch("help", "programs") },
      ] },
    ],
    build(w) {
      if (!phone()) w.body.style.alignItems = "flex-start";
      w.body.append(h("div", { class: "mines" }, h("div", { class: "mhead" }, h("div", { class: "led" }, ledL), face, h("div", { class: "led" }, ledR)), grid, phone() ? h("p", { class: "mhint" }, "Tap to open. Hold to flag.") : null));
    },
  });
  if (w._built) return w;
  w._built = true;
  w.el.addEventListener("keydown", (e) => { if (e.key === "F2") { e.preventDefault(); reset(); } });
  const LEVEL_ARG = typeof arg === "string" && LEVELS[arg] ? arg : null;
  reset(LEVEL_ARG);
  if (phone()) addEventListener("resize", fit);
  setTimeout(() => cv.focus({ preventScroll: true }), 0);
  return w;
}
