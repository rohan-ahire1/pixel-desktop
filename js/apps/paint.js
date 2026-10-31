// Paint: 96x64 pixel art in the 16-colour palette. Save to My Documents, download a PNG, or make it the wallpaper.
import { h, bus, uid, settings, setSettings, store, phone } from "../core.js";
import { PAL16, K, drawMap } from "../px.js";
import { openWindow, msgbox, list as winList } from "../wm.js";
import { sfx } from "../sound.js";
import * as fs from "../fs.js";
import { launch, openNode } from "./index.js";
import { saveAs } from "./notepad.js";

const W = 96, H = 64, UNDO = 30;
const G = { K, W: "#ffffff", Y: "#f7c437", R: "#ff8fa3", B: "#0b2fa8", G: "#9a9fbb", P: "#ff8fa3", S: "#d9534f" };
const MAPS = {
  pencil: ["............KK..", "...........KRRK.", "..........KYKRK.", ".........KYYYK..", "........KYYYK...", ".......KYYYK....", "......KYYYK.....", ".....KYYYK......", "....KYYYK.......", "...KWYYK........", "..KWWWK.........", "..KWWK..........", "..KKK..........."],
  brush: ["...........KK...", "..........KBBK..", ".........KBBK...", "........KBBK....", ".......KBBK.....", "......KBBK......", ".....KKKK.......", "....KGGK........", "...KGGGK........", "..KGGGK.........", ".KGGGK..........", ".KGGK...........", "KKKK............"],
  fill: ["......K.........", ".....KWK........", "....KWWWK.......", "...KWWWWWK......", "..KWWWWWWWK.....", ".KWWWWWWWWWKS...", "..KWWWWWWWK.SS..", "...KWWWWWK..SS..", "....KWWWK...SS..", ".....KWK........", "......K........."],
  eraser: ["................", ".......KKKKKK...", "......KPPPPPK...", ".....KPPPPPKK...", "....KPPPPPKWK...", "...KKKKKKKWWK...", "...KWWWWWKWK....", "...KWWWWWKK.....", "...KKKKKKK......"],
  picker: ["...........KKK..", "..........KKKKK.", "........K.KKKK..", ".........KKKK...", "........KWKK.K..", ".......KWWK.....", "......KWWK......", ".....KWWK.......", "....KWWK........", "...KWWK.........", "..KBBK..........", "..KBK...........", "...K............"],
  spray: ["...K.K..........", ".K..K..K........", "...K.K..........", "....KKKK........", "....KWWK........", "...KKKKKK.......", "...KSSSSK.......", "...KSWSSK.......", "...KSWSSK.......", "...KSSSSK.......", "...KSSSSK.......", "...KKKKKK......."],
};
const TOOLS = [
  ["pencil", "Pencil", "P"], ["brush", "Brush", "B"], ["eraser", "Eraser", "E"], ["fill", "Fill with color", "F"],
  ["picker", "Pick color", "I"], ["spray", "Airbrush", "A"], ["line", "Line", "L"], ["rect", "Rectangle", "R"],
  ["frect", "Filled rectangle", "S"], ["ellipse", "Ellipse", "O"],
];
function toolIcon(id) {
  const cv = h("canvas", { width: "16", height: "16", class: "px", "aria-hidden": "true", style: { width: "16px", height: "16px" } });
  const c = cv.getContext("2d");
  if (MAPS[id]) drawMap(c, MAPS[id], 0, 1, G);
  else if (id === "line") { c.fillStyle = K; for (let i = 0; i < 12; i++) c.fillRect(2 + i, 13 - i, 1, 1); }
  else if (id === "rect") { c.fillStyle = K; c.fillRect(2, 4, 12, 1); c.fillRect(2, 11, 12, 1); c.fillRect(2, 4, 1, 8); c.fillRect(13, 4, 1, 8); }
  else if (id === "frect") { c.fillStyle = K; c.fillRect(2, 4, 12, 8); c.fillStyle = "#6f8cff"; c.fillRect(3, 5, 10, 6); }
  else if (id === "ellipse") { c.fillStyle = K; for (let a = 0; a < 6.3; a += 0.08) c.fillRect(Math.round(8 + Math.cos(a) * 6 - 0.5), Math.round(8 + Math.sin(a) * 4.5 - 0.5), 1, 1); }
  return cv;
}

export function open(arg, from) {
  const docId = typeof arg === "string" && arg.startsWith("pic-") ? arg : null;
  const existing = docId && winList().find((x) => x.app === "paint" && x._doc === docId);
  if (existing) { existing.min ? existing.restore() : existing.focus(); return existing; }

  const cv = h("canvas", { width: String(W), height: String(H), tabindex: "0", role: "img", "aria-label": "Drawing canvas, 96 by 64 pixels" });
  const c = cv.getContext("2d", { willReadFrequently: true });
  c.imageSmoothingEnabled = false;
  const grid = h("div", { "aria-hidden": "true", style: { position: "absolute", inset: "0", pointerEvents: "none" } });
  const wrap = h("div", { style: { position: "relative", lineHeight: 0 } }, cv, grid);
  const stage = h("div", { class: "pstage" }, wrap);
  const fgEl = h("i", { class: "fg" }), bgEl = h("i", { class: "bgc" });
  const sTool = h("span"), sPos = h("span", { class: "fit", style: { minWidth: "80px" } }), sSize = h("span", { class: "fit" }, `${W} × ${H}`);
  let tool = "pencil", size = 1, fg = PAL16[0], bg = PAL16[3], zoom = 5, showGrid = store.get("paintGrid", false);
  let name = docId ? fs.node(docId)?.name || "untitled.png" : "untitled.png", doc = docId, dirty = false;
  const undo = [], redo = [];

  const title = () => w && w.setTitle(`${dirty ? "*" : ""}${name.replace(/\.png$/i, "")} - Paint`);
  const mark = () => { if (!dirty) { dirty = true; title(); } };
  const snap = () => c.getImageData(0, 0, W, H);
  const push = () => { undo.push(snap()); if (undo.length > UNDO) undo.shift(); redo.length = 0; };
  const doUndo = () => { if (!undo.length) return; redo.push(snap()); c.putImageData(undo.pop(), 0, 0); mark(); };
  const doRedo = () => { if (!redo.length) return; undo.push(snap()); c.putImageData(redo.pop(), 0, 0); mark(); };
  const clear = () => { c.fillStyle = "#ffffff"; c.fillRect(0, 0, W, H); };

  const setZoom = (z) => {
    zoom = Math.max(1, Math.min(12, z));
    cv.style.width = W * zoom + "px"; cv.style.height = H * zoom + "px";
    grid.style.background = showGrid && zoom >= 4 ? `linear-gradient(to right, rgba(16,19,46,.18) 1px, transparent 1px) 0 0 / ${zoom}px ${zoom}px, linear-gradient(to bottom, rgba(16,19,46,.18) 1px, transparent 1px) 0 0 / ${zoom}px ${zoom}px` : "none";
  };
  const setColors = () => { fgEl.style.background = fg; bgEl.style.background = bg; };
  const toolBtns = {};
  const sizeRow = h("div", { class: "popts", role: "radiogroup", "aria-label": "Size" });
  const setTool = (t) => {
    tool = t;
    Object.entries(toolBtns).forEach(([k, b]) => { b.classList.toggle("on", k === t); b.setAttribute("aria-pressed", String(k === t)); });
    const T = TOOLS.find((x) => x[0] === t);
    sTool.textContent = { pencil: "Draws one pixel at a time.", brush: "Draws with the chosen size.", eraser: "Paints with the background color.", fill: "Fills an area with the chosen color.", picker: "Picks a color from the picture.", spray: "Sprays dots. Hold to build up.", line: "Draws a line. Hold Shift for straight angles.", rect: "Draws a box. Hold Shift for a square.", frect: "Draws a filled box. Hold Shift for a square.", ellipse: "Draws an ellipse. Hold Shift for a circle." }[t] || T[1];
    sizeRow.hidden = ["pencil", "fill", "picker"].includes(t);
    cv.style.cursor = t === "picker" ? "copy" : t === "fill" ? "cell" : "crosshair";
  };

  // pixel ops
  const dot = (x, y, col, s = 1) => { c.fillStyle = col; const o = Math.floor((s - 1) / 2); c.fillRect(x - o, y - o, s, s); };
  const lineTo = (x0, y0, x1, y1, col, s) => {
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) { dot(x0, y0, col, s); if (x0 === x1 && y0 === y1) break; const e2 = 2 * err; if (e2 >= dy) { err += dy; x0 += sx; } if (e2 <= dx) { err += dx; y0 += sy; } }
  };
  const rectOut = (x0, y0, x1, y1, col, s, fill) => {
    const [a, b] = [Math.min(x0, x1), Math.max(x0, x1)], [p, q] = [Math.min(y0, y1), Math.max(y0, y1)];
    if (fill) { c.fillStyle = col; c.fillRect(a, p, b - a + 1, q - p + 1); return; }
    lineTo(a, p, b, p, col, s); lineTo(b, p, b, q, col, s); lineTo(b, q, a, q, col, s); lineTo(a, q, a, p, col, s);
  };
  const ellipse = (x0, y0, x1, y1, col, s) => {
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, rx = Math.abs(x1 - x0) / 2, ry = Math.abs(y1 - y0) / 2;
    const n = Math.max(16, Math.ceil((rx + ry) * 4));
    let px0 = null, py0 = null;
    for (let i = 0; i <= n; i++) { const a = (i / n) * Math.PI * 2, x = Math.round(cx + Math.cos(a) * rx), y = Math.round(cy + Math.sin(a) * ry); if (px0 != null) lineTo(px0, py0, x, y, col, s); px0 = x; py0 = y; }
  };
  const hex = (r, g, b) => "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
  const flood = (x, y, col) => {
    const img = snap(), d = img.data, i0 = (y * W + x) * 4, tr = d[i0], tg = d[i0 + 1], tb = d[i0 + 2], ta = d[i0 + 3];
    const n = parseInt(col.slice(1), 16), nr = n >> 16 & 255, ng = n >> 8 & 255, nb = n & 255;
    if (tr === nr && tg === ng && tb === nb && ta === 255) return false;
    const st = [x, y], same = (i) => d[i] === tr && d[i + 1] === tg && d[i + 2] === tb && d[i + 3] === ta;
    while (st.length) {
      const yy = st.pop(), xx = st.pop();
      if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
      const i = (yy * W + xx) * 4;
      if (!same(i)) continue;
      d[i] = nr; d[i + 1] = ng; d[i + 2] = nb; d[i + 3] = 255;
      st.push(xx + 1, yy, xx - 1, yy, xx, yy + 1, xx, yy - 1);
    }
    c.putImageData(img, 0, 0);
    return true;
  };

  // pointer
  let drawing = null, sprayIv = 0;
  const at = (e) => { const r = cv.getBoundingClientRect(); return [Math.floor(((e.clientX - r.left) / r.width) * W), Math.floor(((e.clientY - r.top) / r.height) * H)]; };
  const constrain = (x0, y0, x, y, kind) => {
    const dx = x - x0, dy = y - y0;
    if (kind === "line") { const a = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4), l = Math.hypot(dx, dy); return [x0 + Math.round(Math.cos(a) * l), y0 + Math.round(Math.sin(a) * l)]; }
    const m = Math.max(Math.abs(dx), Math.abs(dy)); return [x0 + Math.sign(dx || 1) * m, y0 + Math.sign(dy || 1) * m];
  };
  cv.addEventListener("contextmenu", (e) => e.preventDefault());
  cv.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 && e.button !== 2) return;
    e.preventDefault(); cv.focus({ preventScroll: true });
    const [x, y] = at(e), col = e.button === 2 ? bg : fg, alt = e.button === 2 ? fg : bg;
    if (tool === "picker") {
      const p = c.getImageData(x, y, 1, 1).data, picked = hex(p[0], p[1], p[2]);
      if (e.button === 2) bg = picked; else fg = picked;
      setColors(); setTool(store.get("paintPrev", "pencil")); return;
    }
    push();
    if (tool === "fill") { if (flood(x, y, col)) { mark(); sfx("pop"); } else undo.pop(); return; }
    cv.setPointerCapture(e.pointerId);
    drawing = { x0: x, y0: y, lx: x, ly: y, col: tool === "eraser" ? alt : col, base: snap(), sx: x, sy: y };
    if (tool === "pencil") dot(x, y, drawing.col, 1);
    else if (tool === "brush" || tool === "eraser") dot(x, y, drawing.col, tool === "eraser" ? size + 2 : size + 1);
    else if (tool === "spray") {
      const puff = () => { for (let i = 0; i < 6; i++) { const a = Math.random() * 6.283, r = Math.random() * (3 + size * 2); dot(Math.round(drawing.sx + Math.cos(a) * r), Math.round(drawing.sy + Math.sin(a) * r), drawing.col, 1); } };
      puff(); sprayIv = setInterval(puff, 40);
    }
    mark();
  });
  cv.addEventListener("pointermove", (e) => {
    const [x, y] = at(e);
    sPos.textContent = x >= 0 && y >= 0 && x < W && y < H ? `${x}, ${y}` : "";
    if (!drawing) return;
    const d = drawing;
    if (tool === "pencil") lineTo(d.lx, d.ly, x, y, d.col, 1);
    else if (tool === "brush") lineTo(d.lx, d.ly, x, y, d.col, size + 1);
    else if (tool === "eraser") lineTo(d.lx, d.ly, x, y, d.col, size + 2);
    else if (tool === "spray") { d.sx = x; d.sy = y; }
    else {
      c.putImageData(d.base, 0, 0);
      let [ex, ey] = e.shiftKey ? constrain(d.x0, d.y0, x, y, tool) : [x, y];
      if (tool === "line") lineTo(d.x0, d.y0, ex, ey, d.col, size);
      else if (tool === "rect" || tool === "frect") rectOut(d.x0, d.y0, ex, ey, d.col, size, tool === "frect");
      else if (tool === "ellipse") ellipse(d.x0, d.y0, ex, ey, d.col, size);
      sPos.textContent = `${Math.abs(ex - d.x0) + 1} × ${Math.abs(ey - d.y0) + 1}`;
    }
    d.lx = x; d.ly = y;
  });
  const end = () => { if (!drawing) return; clearInterval(sprayIv); drawing = null; };
  cv.addEventListener("pointerup", end); cv.addEventListener("pointercancel", end);
  cv.addEventListener("pointerleave", () => { if (!drawing) sPos.textContent = ""; });

  // file ops
  async function save(as) {
    if (!doc || as) {
      const r = await saveAs(w, doc ? name : "untitled.png", doc ? fs.getDoc(doc)?.loc || "documents" : "documents", "png", "paint");
      if (!r) return false;
      const clash = fs.children(r.loc).find((k) => k.name.toLowerCase() === r.name.toLowerCase() && k.id !== doc);
      if (clash) {
        if (!clash.user || clash.type !== "pic") { await msgbox({ title: "Save As", icon: "error", text: `${r.name} can't be replaced. Pick another name.`, parent: w }); return false; }
        if ((await msgbox({ title: "Save As", icon: "warn", text: `${r.name} already exists.\nDo you want to replace it?`, buttons: ["Yes", "No"], parent: w, def: 1 })) !== 0) return false;
        doc = clash.id;
      } else doc = as || !doc ? "pic-" + uid() : doc;
      name = r.name;
      fs.saveDoc({ id: doc, name, data: cv.toDataURL("image/png"), loc: r.loc });
      w._doc = doc;
      bus.emit("notify", { title: "Picture saved", text: `${name} is in ${r.loc === "desktop" ? "your desktop" : "My Documents"}.`, icon: "paint", action: () => openNode(r.loc) });
    } else {
      const d = fs.getDoc(doc);
      if (!d) { doc = null; return save(true); }
      fs.saveDoc({ ...d, data: cv.toDataURL("image/png") });
    }
    if (settings.wallpaper === "painting" && settings.wallPicDoc === doc) setSettings({ wallPic: cv.toDataURL("image/png") });
    dirty = false; title(); sfx("pop");
    return true;
  }
  async function guard() {
    if (!dirty) return true;
    const r = await msgbox({ title: "Paint", icon: "warn", text: `Save changes to ${name}?`, buttons: ["Save", "Don't Save", "Cancel"], parent: w });
    if (r === 0) return save(false);
    return r === 1;
  }
  const newPic = async () => { if (!(await guard())) return; push(); clear(); doc = null; name = "untitled.png"; w._doc = null; dirty = false; title(); };
  const download = () => {
    const big = h("canvas", { width: String(W * 8), height: String(H * 8) }), bc = big.getContext("2d");
    bc.imageSmoothingEnabled = false; bc.drawImage(cv, 0, 0, W * 8, H * 8);
    const a = h("a", { href: big.toDataURL("image/png"), download: name.replace(/\.png$/i, "") + ".png" });
    document.body.append(a); a.click(); a.remove();
  };
  const wallpaper = () => { setSettings({ wallpaper: "painting", wallPic: cv.toDataURL("image/png"), wallPicDoc: doc }); bus.emit("notify", { title: "Wallpaper set", text: "Your painting is on the desktop now. Change it back in Display settings.", icon: "display", action: () => launch("settings", "background") }); };
  const transform = (fn) => { push(); const src = h("canvas", { width: String(W), height: String(H) }); src.getContext("2d").putImageData(snap(), 0, 0); c.save(); clear(); fn(src); c.restore(); mark(); };
  const invert = () => { push(); const img = snap(); for (let i = 0; i < img.data.length; i += 4) { img.data[i] = 255 - img.data[i]; img.data[i + 1] = 255 - img.data[i + 1]; img.data[i + 2] = 255 - img.data[i + 2]; } c.putImageData(img, 0, 0); mark(); };

  const w = openWindow({
    id: "paint-" + uid(), posKey: "paint", title: "untitled - Paint", icon: "paint", app: "paint", w: 680, h: 520, minW: 340, minH: 300, from, bodyClass: "",
    onClose: () => guard(),
    menubar: [
      { label: "File", items: () => [
        { label: "New", kbd: "Ctrl+N", action: newPic },
        { label: "Open…", kbd: "Ctrl+O", action: () => openNode("documents") },
        { label: "Save", kbd: "Ctrl+S", action: () => save(false) },
        { label: "Save As…", action: () => save(true) },
        { sep: true },
        { label: "Download as PNG", action: download },
        { label: "Set as Wallpaper", icon: "display", action: wallpaper },
        { sep: true },
        { label: "Close", kbd: "Alt+F4", action: () => w.close() },
      ] },
      { label: "Edit", items: () => [
        { label: "Undo", kbd: "Ctrl+Z", disabled: !undo.length, action: doUndo },
        { label: "Redo", kbd: "Ctrl+Y", disabled: !redo.length, action: doRedo },
        { sep: true },
        { label: "Clear Image", kbd: "Ctrl+Shift+N", action: () => { push(); clear(); mark(); } },
      ] },
      { label: "View", items: () => [
        { label: "Zoom", sub: [2, 3, 4, 5, 6, 8].map((z) => ({ label: `${z * 100}%`, radio: zoom === z, action: () => setZoom(z) })) },
        { label: "Show Grid", kbd: "Ctrl+G", checked: showGrid, action: () => { showGrid = !showGrid; store.set("paintGrid", showGrid); setZoom(zoom); } },
      ] },
      { label: "Image", items: () => [
        { label: "Flip Horizontal", action: () => transform((s) => { c.translate(W, 0); c.scale(-1, 1); c.drawImage(s, 0, 0); }) },
        { label: "Flip Vertical", action: () => transform((s) => { c.translate(0, H); c.scale(1, -1); c.drawImage(s, 0, 0); }) },
        { label: "Invert Colors", kbd: "Ctrl+I", action: invert },
      ] },
      { label: "Help", items: () => [
        { label: "Tips", action: () => msgbox({ title: "Paint", icon: "info", parent: w, text: phone() ? "Draw with your finger. Tap a swatch to pick the color.\nThe box next to the swatches swaps the front and back colors, and the eraser paints with the back color." : "Left-click draws with the front color. Right-click draws with the back color.\nRight-click a swatch to set the back color. X swaps them.\nKeys: P pencil, B brush, E eraser, F fill, I pick, A airbrush, L line, R box, S filled box, O ellipse." }) },
        { label: "Help Topics", icon: "help", kbd: "F1", action: () => launch("help", "programs") },
      ] },
    ],
    build(w) {
      const tools = h("div", { class: "ptools", role: "toolbar", "aria-label": "Tools" });
      TOOLS.forEach(([id, label, key]) => {
        const b = h("button", { type: "button", class: "ptool", "aria-label": `${label} (${key})`, "data-tip": `${label} (${key})`, "aria-pressed": "false", onclick: () => { if (id === "picker") store.set("paintPrev", tool); setTool(id); } }, toolIcon(id));
        toolBtns[id] = b; tools.append(b);
      });
      [1, 2, 3].forEach((s) => sizeRow.append(h("button", { type: "button", role: "radio", "aria-checked": String(s === size), "aria-label": `Size ${s}`, class: s === size ? "on" : "", onclick: (e) => { size = s; sizeRow.querySelectorAll("button").forEach((b) => { const on = b === e.currentTarget; b.classList.toggle("on", on); b.setAttribute("aria-checked", String(on)); }); } }, h("i", { style: { width: "36px", height: s * 2 + "px" } }))));
      tools.append(sizeRow);
      const sw = h("div", { class: "pswatches", role: "group", "aria-label": "Colors. Click for the front color, right-click for the back color." });
      PAL16.forEach((col) => {
        const b = h("button", { type: "button", "aria-label": col, style: { background: col } });
        b.addEventListener("click", (e) => { if (e.ctrlKey) bg = col; else fg = col; setColors(); });
        b.addEventListener("contextmenu", (e) => { e.preventDefault(); bg = col; setColors(); });
        sw.append(b);
      });
      const cur = h("button", { type: "button", class: "pcur", "aria-label": "Swap colors (X)", "data-tip": "Swap colors (X)", onclick: () => { [fg, bg] = [bg, fg]; setColors(); } }, fgEl, bgEl);
      cur.style.border = "0"; cur.style.padding = "0";
      w.body.append(h("div", { class: "paint" }, tools, stage), h("div", { class: "ppal" }, cur, sw));
      w.el.append(w.statusbar(sTool, sPos, sSize));
    },
  });
  w._doc = doc;

  w.el.addEventListener("keydown", (e) => {
    if (e.target.closest("input, textarea, select") || e.altKey) return;
    const k = e.key.toLowerCase(), mod = e.ctrlKey || e.metaKey;
    if (mod) {
      if (k === "z" && !e.shiftKey) doUndo();
      else if (k === "y" || (k === "z" && e.shiftKey)) doRedo();
      else if (k === "s") save(e.shiftKey);
      else if (k === "n" && e.shiftKey) { push(); clear(); mark(); }
      else if (k === "n") newPic();
      else if (k === "o") openNode("documents");
      else if (k === "g") { showGrid = !showGrid; store.set("paintGrid", showGrid); setZoom(zoom); }
      else if (k === "i") invert();
      else if (k === "=" || k === "+") setZoom(zoom + 1);
      else if (k === "-") setZoom(zoom - 1);
      else return;
      e.preventDefault(); return;
    }
    const t = TOOLS.find((x) => x[2].toLowerCase() === k);
    if (t) { e.preventDefault(); if (t[0] === "picker") store.set("paintPrev", tool); setTool(t[0]); }
    else if (k === "x") { [fg, bg] = [bg, fg]; setColors(); }
    else if (k === "+" || k === "=") setZoom(zoom + 1);
    else if (k === "-") setZoom(zoom - 1);
  });
  stage.addEventListener("wheel", (e) => { if (!e.ctrlKey) return; e.preventDefault(); setZoom(zoom + (e.deltaY < 0 ? 1 : -1)); }, { passive: false });

  clear();
  setColors(); setTool("pencil");
  const fit = () => Math.max(2, Math.min(6, Math.floor((stage.clientWidth - 24) / W), Math.floor((stage.clientHeight - 24) / H)));
  setZoom(fit());
  if (phone()) {
    // fill the screen on whole device pixels, and again after a rotate
    const dpr = devicePixelRatio || 1, fill = () => stage.clientWidth && setZoom(Math.max(2, Math.floor(Math.min((stage.clientWidth - 16) / W, (stage.clientHeight - 16) / H) * dpr) / dpr));
    const ro = new ResizeObserver(fill); ro.observe(stage); w.on(() => ro.disconnect());
  }
  if (docId) {
    const d = fs.getDoc(docId);
    if (d && d.data) { const im = new Image(); im.onload = () => { c.drawImage(im, 0, 0, W, H); }; im.src = d.data; }
  }
  title();
  setTimeout(() => cv.focus({ preventScroll: true }), 0);
  return w;
}
