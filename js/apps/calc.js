// Calculator: the classic immediate-execution kind. No eval. Keyboard works, memory keys too.
import { h, store, announce } from "../core.js";
import { openWindow, msgbox } from "../wm.js";
import { sfx } from "../sound.js";
import { launch } from "./index.js";

const ERR = { div0: "Cannot divide by zero.", bad: "Invalid input." };
const round = (n) => (Number.isFinite(n) ? parseFloat(n.toPrecision(14)) : n);
const show = (n) => (Math.abs(n) >= 1e16 || (n !== 0 && Math.abs(n) < 1e-12) ? n.toExponential(10).replace(/\.?0+e/, "e") : String(round(n)));

export function open(arg, from) {
  let acc = null, op = null, entry = "0", fresh = true, err = null, mem = 0, lastOp = null, group = store.get("calcGroup", false);
  const disp = h("div", { class: "disp well", role: "status", "aria-live": "polite", "aria-label": "Display" }, "0");
  const ind = h("div", { class: "ind", "aria-label": "Memory", title: "Memory" });
  const K = {};
  const val = () => parseFloat(entry);
  const fmtEntry = () => { if (!group || /e/.test(entry)) return entry; const [i, f] = entry.split("."); return i.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + (f != null ? "." + f : ""); };
  const render = () => { disp.textContent = err || fmtEntry(); ind.textContent = mem ? "M" : ""; };
  const fail = (m) => { err = m; acc = null; op = null; fresh = true; sfx("error"); render(); };
  const apply = (a, o, b) => { if (o === "/" && b === 0) return null; return round(o === "+" ? a + b : o === "-" ? a - b : o === "*" ? a * b : a / b); };
  const setEntry = (n) => { entry = show(n); fresh = true; };

  function press(k) {
    if (err && !["C", "CE"].includes(k) && !/^\d$/.test(k)) return;
    if (err) { err = null; acc = null; op = null; entry = "0"; }
    if (/^\d$/.test(k)) {
      if (fresh) { entry = k; fresh = false; } else if (entry.replace(/[-.]/g, "").length < 16) entry = entry === "0" ? k : entry + k;
    } else if (k === ".") {
      if (fresh) { entry = "0."; fresh = false; } else if (!entry.includes(".")) entry += ".";
    } else if ("+-*/".includes(k)) {
      if (op && !fresh) { const r = apply(acc, op, val()); if (r === null) return fail(ERR.div0); acc = r; setEntry(r); }
      else if (!op || !fresh) acc = val();
      op = k; fresh = true; lastOp = null;
    } else if (k === "=") {
      if (op) { const b = val(), r = apply(acc, op, b); if (r === null) return fail(ERR.div0); lastOp = [op, b]; acc = null; op = null; setEntry(r); }
      else if (lastOp) { const r = apply(val(), lastOp[0], lastOp[1]); if (r === null) return fail(ERR.div0); setEntry(r); }
      else fresh = true;
    } else if (k === "C") { acc = null; op = null; entry = "0"; fresh = true; lastOp = null; }
    else if (k === "CE") { entry = "0"; fresh = true; }
    else if (k === "BS") { if (!fresh) { entry = entry.length > 1 && !/^-\d$/.test(entry) ? entry.slice(0, -1) : "0"; if (entry === "0") fresh = true; } }
    else if (k === "neg") { if (val() !== 0) entry = entry.startsWith("-") ? entry.slice(1) : "-" + entry; }
    else if (k === "sqrt") { if (val() < 0) return fail(ERR.bad); setEntry(Math.sqrt(val())); }
    else if (k === "inv") { if (val() === 0) return fail(ERR.div0); setEntry(1 / val()); }
    else if (k === "%") { setEntry(acc != null ? (acc * val()) / 100 : 0); }
    else if (k === "MC") mem = 0;
    else if (k === "MR") { setEntry(mem); }
    else if (k === "MS") { mem = val(); fresh = true; }
    else if (k === "M+") { mem = round(mem + val()); fresh = true; }
    render();
  }

  const copy = () => navigator.clipboard?.writeText(disp.textContent.replace(/,/g, "")).then(() => announce("Copied.")).catch(() => {});
  const paste = async () => {
    try {
      const t = (await navigator.clipboard.readText()).trim().replace(/,/g, "");
      if (!/^-?\d*\.?\d+(e[-+]?\d+)?$/i.test(t)) { sfx("error"); return; }
      err = null; entry = String(parseFloat(t)); fresh = false; render();
    } catch { msgbox({ title: "Calculator", icon: "info", parent: w, text: "Your browser didn't allow pasting here. Type the number instead." }); }
  };

  const w = openWindow({
    id: "calc", title: "Calculator", icon: "calc", app: "calc", w: 340, h: "auto", resizable: false, maximizable: false, remember: true, from, bodyClass: "",
    menubar: [
      { label: "Edit", items: () => [{ label: "Copy", kbd: "Ctrl+C", action: copy }, { label: "Paste", kbd: "Ctrl+V", action: paste }] },
      { label: "View", items: () => [{ label: "Digit grouping", checked: group, action: () => { group = !group; store.set("calcGroup", group); render(); } }] },
      { label: "Help", items: () => [
        { label: "Keyboard keys", action: () => msgbox({ title: "Calculator", icon: "calc", parent: w, text: "Numbers and + - * / work as you'd expect.\nEnter = equals · Esc = C · Delete = CE · Backspace deletes a digit\n% percent · R = 1/x · @ = square root · F9 = ±\nCtrl+L/R/M/P = MC/MR/MS/M+" }) },
        { label: "Help Topics", icon: "help", kbd: "F1", action: () => launch("help", "programs") },
      ] },
    ],
    build(w) {
      const b = (k, label, cls = "", aria) => (K[k] = h("button", { type: "button", class: "btn " + cls, "aria-label": aria || label, onclick: () => { press(k); sfx("click"); } }, label));
      const keys = h("div", { class: "keys", style: { gridTemplateColumns: "1fr 8px repeat(5, 1fr)" } });
      const gap = () => h("i", { "aria-hidden": "true" });
      [
        [b("MC", "MC", "op", "Memory clear"), gap(), b("7", "7"), b("8", "8"), b("9", "9"), b("/", "÷", "op", "Divide"), b("sqrt", "√", "fn", "Square root")],
        [b("MR", "MR", "op", "Memory recall"), gap(), b("4", "4"), b("5", "5"), b("6", "6"), b("*", "×", "op", "Multiply"), b("%", "%", "fn", "Percent")],
        [b("MS", "MS", "op", "Memory store"), gap(), b("1", "1"), b("2", "2"), b("3", "3"), b("-", "−", "op", "Subtract"), b("inv", "1/x", "fn", "Reciprocal")],
        [b("M+", "M+", "op", "Memory add"), gap(), b("0", "0"), b("neg", "±", "", "Change sign"), b(".", ".", "", "Decimal point"), b("+", "+", "op", "Add"), b("=", "=", "op", "Equals")],
      ].flat().forEach((el) => keys.append(el));
      w.body.append(h("div", { class: "calc" }, disp,
        h("div", { class: "mem" }, ind, b("BS", "Back", "", "Backspace"), b("CE", "CE", "", "Clear entry"), b("C", "C", "", "Clear all")), keys));
    },
  });
  if (w._built) return w;
  w._built = true;
  const MAP = { Enter: "=", "=": "=", Escape: "C", Delete: "CE", Backspace: "BS", "%": "%", r: "inv", R: "inv", "@": "sqrt", F9: "neg", ",": ".", x: "*", X: "*" };
  const CTRL = { l: "MC", r: "MR", m: "MS", p: "M+" };
  w.el.addEventListener("keydown", (e) => {
    if (e.altKey) return;
    const mod = e.ctrlKey || e.metaKey;
    let k = null;
    if (mod) { const lk = e.key.toLowerCase(); if (lk === "c" && !getSelection().toString()) { e.preventDefault(); copy(); return; } if (lk === "v") { e.preventDefault(); paste(); return; } k = CTRL[lk]; }
    else if (/^[\d.+\-*/]$/.test(e.key)) k = e.key;
    else k = MAP[e.key];
    if (!k) return;
    if (k === "C" && e.key === "Escape" && !err && entry === "0" && acc === null) return; // let Esc fall through when there's nothing to clear
    e.preventDefault(); e.stopPropagation();
    press(k);
    const el = K[k];
    if (el) { el.style.boxShadow = "var(--in)"; setTimeout(() => (el.style.boxShadow = ""), 90); }
  });
  render();
  return w;
}
