// Notepad: write, save to the desktop or My Documents, word wrap, time stamps. About me.txt opens read-only.
import { h, uid, bus } from "../core.js";
import { openWindow, msgbox, list as winList } from "../wm.js";
import { sfx } from "../sound.js";
import * as fs from "../fs.js";
import { launch, openNode, properties } from "./index.js";

const stamp = () => new Date().toLocaleString([], { hour: "numeric", minute: "2-digit", day: "numeric", month: "numeric", year: "numeric" });

// Save As dialog: name + where. Resolves { name, loc } or null.
export function saveAs(parent, name, loc = "desktop", ext = "txt", ic = "note") {
  return new Promise((resolve) => {
    let done = false;
    const finish = (v, w) => { if (done) return; done = true; w.close(true); resolve(v); };
    const field = h("input", { class: "field", value: name.replace(new RegExp("\\." + ext + "$", "i"), ""), "aria-label": "File name", style: { width: "100%" } });
    const where = h("select", { class: "field", "aria-label": "Save in", style: { width: "100%" } }, h("option", { value: "desktop" }, "Desktop"), h("option", { value: "documents" }, "My Documents"));
    where.value = loc === "documents" ? "documents" : "desktop";
    const ok = (w) => {
      const v = field.value.trim();
      if (!v) { field.focus(); return; }
      if (/[\\/:*?"<>|]/.test(v)) { msgbox({ title: "Save As", icon: "error", text: 'A file name can\'t contain any of these characters:\n\\ / : * ? " < > |', parent: w }); return; }
      finish({ name: /\.\w{2,4}$/.test(v) ? v : v + "." + ext, loc: where.value }, w);
    };
    const w = openWindow({
      id: "saveas-" + uid(), title: "Save As", icon: ic, dialog: true, modal: parent, minimizable: false, w: 380, escClose: true,
      onEscape: () => finish(null, w), onClose: () => { if (!done) { done = true; resolve(null); } }, bodyClass: "dlg",
      build(w) {
        field.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); ok(w); } });
        w.body.append(
          h("div", { class: "findbar" }, h("label", {}, "Save in:"), where, h("label", {}, "File name:"), field),
          h("div", { class: "btnrow" }, h("button", { type: "button", class: "btn def", onclick: () => ok(w) }, "Save"), h("button", { type: "button", class: "btn", onclick: () => finish(null, w) }, "Cancel")));
      },
    });
    setTimeout(() => { field.focus(); field.select(); }, 0);
  });
}

export function open(arg, from) {
  let docId = typeof arg === "string" ? arg : null;
  const existing = docId && winList().find((x) => x.app === "notepad" && x._doc === docId);
  if (existing) { existing.min ? existing.restore() : existing.focus(); return existing; }
  const n = docId ? fs.node(docId) : null;
  if (docId && !n) { msgbox({ title: "Notepad", icon: "error", text: "That file isn't there any more. It may have been deleted." }); return null; }
  const readonly = !!n?.readonly;
  let name = n ? n.name : "Untitled", saved = n ? (n.doc ? n.doc.text || "" : n.text || "") : (arg && arg.text) || "", wrap = true;
  const ta = h("textarea", { class: "np", spellcheck: "false", "aria-label": "Text", readonly: readonly || null, "data-focus": "" });
  ta.value = saved;
  const sPos = h("span", { class: "fit" }), sMode = h("span");
  const dirty = () => !ta.readOnly && ta.value !== saved;
  const title = () => w.setTitle(`${dirty() ? "*" : ""}${name} - Notepad`);

  async function save(as = false) {
    const copy = ta.readOnly;
    if (copy) as = true;
    const d = docId && fs.getDoc(docId);
    if (d && !as) { d.text = ta.value; fs.saveDoc(d); saved = ta.value; title(); sfx("click"); sMode.textContent = "Saved."; return true; }
    const r = await saveAs(w, copy ? "About me (copy).txt" : name === "Untitled" ? "New Text Document.txt" : name, d ? d.loc : "desktop");
    if (!r) return false;
    const exists = fs.children(r.loc).find((x) => x.name.toLowerCase() === r.name.toLowerCase() && x.id !== docId);
    if (exists) {
      const q = await msgbox({ title: "Save As", icon: "warn", text: `${r.name} already exists.\nDo you want to replace it?`, buttons: ["Yes", "No"], parent: w, def: 1 });
      if (q !== 0) return false;
      if (exists.user) fs.purge(exists.id); else return false;
    }
    const nd = fs.saveDoc({ id: "note-" + uid(), name: r.name, text: ta.value, loc: r.loc });
    docId = nd.id; w._doc = docId; name = nd.name; saved = ta.value;
    if (copy) { ta.readOnly = false; ta.focus(); }
    title(); sfx("pop");
    sMode.textContent = `Saved to ${r.loc === "documents" ? "My Documents" : "the desktop"}.`;
    return true;
  }
  async function guard() {
    if (!dirty()) return true;
    const r = await msgbox({ title: "Notepad", icon: "warn", text: `Do you want to save changes to ${name}?`, buttons: ["Save", "Don't Save", "Cancel"], parent: w });
    if (r === 0) return save();
    return r === 1;
  }
  const insertTime = () => { if (ta.readOnly) return; ta.focus(); ta.setRangeText(stamp(), ta.selectionStart, ta.selectionEnd, "end"); ta.dispatchEvent(new Event("input")); };
  const setWrap = (v) => { wrap = v; ta.classList.toggle("nowrap", !wrap); };
  const exec = (cmd) => { ta.focus(); try { document.execCommand(cmd); } catch (e) {} };

  const w = openWindow({
    id: "notepad-" + uid(), posKey: "notepad", title: `${name} - Notepad`, icon: "note", app: "notepad", arg: docId, w: 620, h: 460, minW: 300, minH: 200, from,
    menubar: [
      { label: "File", items: () => [
        { label: "New", kbd: "Ctrl+N", action: () => launch("notepad") },
        { label: "Open…", kbd: "Ctrl+O", action: () => openNode("documents") },
        { label: ta.readOnly ? "Save a copy…" : "Save", kbd: "Ctrl+S", action: () => save() },
        { label: "Save As…", action: () => save(true) },
        { sep: true },
        { label: "Properties", disabled: !docId, action: () => properties(docId) },
        { sep: true },
        { label: "Exit", action: () => w.close() },
      ] },
      { label: "Edit", items: () => [
        { label: "Undo", kbd: "Ctrl+Z", disabled: ta.readOnly, action: () => exec("undo") },
        { sep: true },
        { label: "Cut", kbd: "Ctrl+X", disabled: ta.readOnly, action: () => exec("cut") },
        { label: "Copy", kbd: "Ctrl+C", action: () => { ta.focus(); navigator.clipboard?.writeText(ta.value.slice(ta.selectionStart, ta.selectionEnd)).catch(() => exec("copy")); } },
        { label: "Paste", kbd: "Ctrl+V", disabled: ta.readOnly, action: () => navigator.clipboard?.readText().then((t) => { ta.focus(); ta.setRangeText(t, ta.selectionStart, ta.selectionEnd, "end"); ta.dispatchEvent(new Event("input")); }).catch(() => msgbox({ title: "Paste", icon: "info", text: "Use Ctrl+V to paste. Your browser keeps the clipboard private.", parent: w })) },
        { label: "Delete", kbd: "Del", disabled: ta.readOnly, action: () => exec("delete") },
        { sep: true },
        { label: "Select All", kbd: "Ctrl+A", action: () => { ta.focus(); ta.select(); } },
        { label: "Time/Date", kbd: "F5", disabled: ta.readOnly, action: insertTime },
      ] },
      { label: "Format", items: () => [{ label: "Word Wrap", checked: wrap, action: () => setWrap(!wrap) }] },
      { label: "Help", items: () => [{ label: "Help Topics", icon: "help", action: () => launch("help", "programs") }] },
    ],
    onClose: () => guard(),
  });
  w._doc = docId;
  w.body.append(ta);
  w.el.append(w.statusbar(sMode, sPos));
  sMode.textContent = readonly ? "Read-only. Use File › Save a copy to edit." : "";
  const pos = () => {
    const before = ta.value.slice(0, ta.selectionStart).split("\n");
    sPos.textContent = `Ln ${before.length}, Col ${before[before.length - 1].length + 1}`;
  };
  ta.addEventListener("input", () => { title(); pos(); if (sMode.textContent.startsWith("Saved")) sMode.textContent = ""; });
  ["keyup", "click", "select", "focus"].forEach((ev) => ta.addEventListener(ev, pos));
  ta.addEventListener("keydown", (e) => {
    const mod = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
    if (mod && k === "s") { e.preventDefault(); save(e.shiftKey); }
    else if (mod && k === "n" && e.altKey) { e.preventDefault(); launch("notepad"); }
    else if (mod && k === "o") { e.preventDefault(); openNode("documents"); }
    else if (e.key === "F5") { e.preventDefault(); insertTime(); }
    else if (e.key === "Tab" && !ta.readOnly) { e.preventDefault(); ta.setRangeText("\t", ta.selectionStart, ta.selectionEnd, "end"); ta.dispatchEvent(new Event("input")); }
  });
  // .LOG files stamp themselves, like the real thing
  if (saved.startsWith(".LOG") && !readonly) { ta.value += (saved.endsWith("\n") ? "" : "\n") + stamp() + "\n"; title(); }
  w.on(bus.on("fs", () => { if (docId && !fs.node(docId)) sMode.textContent = "This file was deleted. Save to keep it."; else if (docId) { name = fs.node(docId).name; title(); } }));
  pos();
  setTimeout(() => { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); if (readonly) ta.setSelectionRange(0, 0); }, 0);
  return w;
}
