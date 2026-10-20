// The pretend file system: fixed folders, the real projects, and the visitor's own notes and paintings.
import { store, bus, uid } from "./core.js";
import { PROJECTS, README } from "./data.js";

const N = {
  computer: { name: "My Computer", icon: "computer", type: "folder", desc: "Everything on this machine: the work, your documents, the programs and the settings.", kids: () => ["projects", "documents", "desktop", "programs", "games", "control", "bin"] },
  desktop: { name: "Desktop", icon: "folder", type: "folder", parent: "computer", desc: "The icons on your desktop.", kids: () => desktopItems() },
  projects: { name: "Projects", icon: "folderStar", type: "folder", parent: "computer", desc: "Six things I built end to end. Open one to read about it, or open it live.", kids: () => PROJECTS.map((p) => p.id) },
  documents: { name: "My Documents", icon: "folder", type: "folder", parent: "computer", desc: "Notes and paintings you save. They stay in this browser.", kids: () => ["readme", ...docsIn("documents")] },
  programs: { name: "Programs", icon: "folderApp", type: "folder", parent: "computer", desc: "Every program on PixelOS.", kids: () => ["welcome", "terminal", "notepad", "paint", "mines", "tunes", "calc", "mail", "browser", "taskman", "find", "help"] },
  games: { name: "Games", icon: "folderApp", type: "folder", parent: "computer", desc: "Minesweeper, and the real Doom from 1993.", kids: () => ["doom", "mines"] },
  control: { name: "Control Panel", icon: "folderGear", type: "folder", parent: "computer", desc: "Change how PixelOS looks, sounds and behaves.", kids: () => ["display", "soundcp", "mecp", "system"] },
  bin: { name: "Recycle Bin", icon: "recycle", type: "bin", parent: "computer", desc: "Things you deleted. Restore them, or empty the bin for good.", kids: () => binItems().map((b) => b.id) },
  readme: { name: "About me.txt", icon: "txt", type: "doc", app: "notepad", parent: "documents", readonly: true, desc: "Who I am, what I'm doing now and how to reach me." },
  welcome: { name: "Welcome", icon: "logo", type: "app", app: "welcome", parent: "programs", desc: "The welcome window." },
  terminal: { name: "Terminal", icon: "terminal", type: "app", app: "terminal", parent: "programs", desc: "A command line. Type help to see what it can do." },
  notepad: { name: "Notepad", icon: "note", type: "app", app: "notepad", parent: "programs", desc: "Write a note and save it to the desktop." },
  paint: { name: "Paint", icon: "paint", type: "app", app: "paint", parent: "programs", desc: "Draw pixel art. You can set it as your wallpaper." },
  mines: { name: "Minesweeper", icon: "mines", type: "app", app: "mines", parent: "programs", desc: "Clear the field without hitting a mine. Three levels." },
  doom: { name: "Doom", icon: "doom", type: "app", app: "dos", arg: "doom", parent: "games", desc: "The real 1993 Doom, shareware episode 1, running in an emulated DOS PC." },
  tunes: { name: "Tunes", icon: "tunes", type: "app", app: "tunes", parent: "programs", desc: "A chiptune player with three original tracks." },
  calc: { name: "Calculator", icon: "calc", type: "app", app: "calc", parent: "programs", desc: "Adds things up. Works with the keyboard." },
  mail: { name: "Mail Rohan", icon: "mail", type: "app", app: "mail", parent: "programs", desc: "Write to me. It opens in your own email app." },
  browser: { name: "Web Browser", icon: "web", type: "app", app: "browser", parent: "programs", desc: "Browse the live projects." },
  taskman: { name: "Task Manager", icon: "system", type: "app", app: "taskman", parent: "programs", desc: "See what is running and end it." },
  find: { name: "Find", icon: "find", type: "app", app: "find", parent: "programs", desc: "Search projects, programs and your documents." },
  help: { name: "Help", icon: "help", type: "app", app: "help", parent: "programs", desc: "How to use PixelOS." },
  display: { name: "Display", icon: "display", type: "app", app: "settings", arg: "background", parent: "control", desc: "Wallpaper, screen saver and colors." },
  soundcp: { name: "Sound", icon: "sound", type: "app", app: "settings", arg: "sound", parent: "control", desc: "Volume and system sounds." },
  mecp: { name: "Pixel Rohan", icon: "me", type: "app", app: "settings", arg: "me", parent: "control", desc: "Check on me, and change what I do and how often I write." },
  system: { name: "System", icon: "system", type: "app", app: "system", parent: "control", desc: "Details about this computer." },
};
for (const p of PROJECTS) N[p.id] = { name: p.name, icon: p.icon, type: "project", app: "project", arg: p.id, parent: "projects", desc: p.sum, project: p };
for (const [id, n] of Object.entries(N)) n.id = id;
N.readme.text = README;

export const TYPE_NAMES = { folder: "File folder", bin: "Recycle Bin", app: "Program", project: "Project", doc: "Text document", pic: "Bitmap image" };
export const DESKTOP_DEFAULT = [
  ["computer", "projects", "readme", "mail", "bin"],
  ["flaggo", "coachmate", "multibagger", "extracta", "wacleaner", "clenow"],
  ["terminal", "paint", "mines", "doom", "tunes"],
];
const SHORTCUTS = new Set([...PROJECTS.map((p) => p.id), "terminal", "paint", "mines", "doom", "tunes", "mail", "notepad", "calc", "browser"]);
export const UNDELETABLE = new Set(["computer", "bin"]);

let docs = store.get("docs", []);
let hidden = new Set(store.get("hidden", []));
let binStatic = store.get("binStatic", []); // [{id, when}]
let names = store.get("names", {});
const save = () => { store.set("docs", docs); store.set("hidden", [...hidden]); store.set("binStatic", binStatic); store.set("names", names); bus.emit("fs"); };

function docNode(d) {
  const pic = d.id.startsWith("pic-");
  return { id: d.id, name: d.name, icon: pic ? "paint" : "note", type: pic ? "pic" : "doc", app: pic ? "paint" : "notepad", arg: d.id, parent: d.loc === "bin" ? "bin" : d.loc, user: true, doc: d,
    desc: pic ? "A painting you made." : "A note you wrote." };
}
const docsIn = (loc) => docs.filter((d) => d.loc === loc).map((d) => d.id);

export function node(id) {
  if (!id) return null;
  if (N[id]) {
    const n = { ...N[id] };
    if (names[id]) n.name = names[id];
    if (id === "bin") n.icon = binItems().length ? "recycleFull" : "recycle";
    return n;
  }
  const d = docs.find((x) => x.id === id);
  return d ? docNode(d) : null;
}
export const children = (id) => { const n = N[id]; return n && n.kids ? n.kids().map(node).filter(Boolean) : []; };
export const isFolder = (n) => n && (n.type === "folder" || n.type === "bin");
export const isShortcut = (id, where) => where === "desktop" && SHORTCUTS.has(id);
export const typeName = (n) => TYPE_NAMES[n.type] || "File";
export function sizeOf(n) {
  if (n.doc) return n.doc.data ? Math.round(n.doc.data.length * 0.75) : new Blob([n.doc.text || ""]).size;
  if (n.text) return n.text.length;
  if (isFolder(n)) return null;
  return n.type === "app" ? 24 * 1024 + n.name.length * 911 : n.type === "project" ? 2048 : null;
}
export function fmtSize(b) {
  if (b == null) return "";
  return b < 1024 ? `${b} bytes` : `${Math.max(1, Math.round(b / 1024))} KB`;
}

export function pathOf(id) {
  if (id === "computer") return "C:\\";
  const parts = [];
  let n = node(id);
  while (n && n.id !== "computer") { parts.unshift(n.name); n = node(n.parent); }
  return "C:\\" + parts.join("\\");
}
export function resolvePath(raw) {
  let s = String(raw || "").trim().replace(/\//g, "\\").replace(/\\+$/, "");
  if (!s || /^c:?$/i.test(s)) return "computer";
  const byName = Object.values(N).concat(docs.map(docNode)).find((n) => (names[n.id] || n.name).toLowerCase() === s.toLowerCase() || n.id === s.toLowerCase());
  if (!/^c:/i.test(s)) return byName ? byName.id : null;
  const segs = s.replace(/^c:\\?/i, "").split("\\").filter(Boolean);
  let cur = "computer";
  for (const seg of segs) {
    const kid = children(cur).find((k) => k.name.toLowerCase() === seg.toLowerCase());
    if (!kid) return null;
    cur = kid.id;
  }
  return cur;
}

/* desktop membership */
export function desktopItems() {
  return [...DESKTOP_DEFAULT.flat().filter((id) => !hidden.has(id)), ...docsIn("desktop")];
}
export function resetDesktop() { hidden = new Set(); binStatic = []; save(); }

/* docs */
export const getDoc = (id) => docs.find((d) => d.id === id);
export function uniqueName(base, loc, ext) {
  const taken = new Set(docs.filter((d) => d.loc === loc).map((d) => d.name.toLowerCase()));
  if (loc === "documents") taken.add(N.readme.name.toLowerCase());
  let name = `${base}.${ext}`, i = 2;
  while (taken.has(name.toLowerCase())) name = `${base} (${i++}).${ext}`;
  return name;
}
export function saveDoc(d) {
  const i = docs.findIndex((x) => x.id === d.id);
  d.mtime = Date.now();
  if (i >= 0) docs[i] = d; else docs.push(d);
  save();
  return d;
}
export function newNote(loc = "desktop", text = "") {
  return saveDoc({ id: "note-" + uid(), name: uniqueName("New Text Document", loc, "txt"), text, loc });
}
export function rename(id, name) {
  name = name.trim();
  if (!name) return false;
  const d = getDoc(id);
  if (d) { const ext = d.id.startsWith("pic-") ? ".png" : ".txt"; d.name = /\.\w{2,4}$/.test(name) ? name : name + ext; }
  else if (N[id]) names[id] = name;
  else return false;
  save();
  return true;
}

/* recycle bin */
export function binItems() {
  return [...binStatic.map((b) => ({ ...node(b.id), when: b.when, from: "desktop" })),
    ...docs.filter((d) => d.loc === "bin").map((d) => ({ ...docNode(d), when: d.when, from: d.from }))].filter((x) => x.id);
}
export function canDelete(id, where) {
  if (UNDELETABLE.has(id) || id === "readme" && where !== "desktop") return false;
  if (getDoc(id)) return true;
  return where === "desktop" && desktopItems().includes(id);
}
export function trash(id) {
  const d = getDoc(id);
  if (d) { if (d.loc === "bin") return; d.from = d.loc; d.loc = "bin"; d.when = Date.now(); }
  else { hidden.add(id); binStatic = binStatic.filter((b) => b.id !== id).concat({ id, when: Date.now() }); }
  save();
  bus.emit("me:react", "trash");
}
export function restore(id) {
  const d = getDoc(id);
  if (d) { d.loc = d.from || "desktop"; delete d.from; delete d.when; }
  else { hidden.delete(id); binStatic = binStatic.filter((b) => b.id !== id); }
  save();
  bus.emit("me:react", "restore");
}
export function purge(id) {
  if (getDoc(id)) docs = docs.filter((d) => d.id !== id);
  else binStatic = binStatic.filter((b) => b.id !== id);
  save();
}
export function emptyBin() {
  docs = docs.filter((d) => d.loc !== "bin");
  binStatic = [];
  save();
  bus.emit("me:react", "binEmpty");
}

/* search */
export function search(q) {
  q = q.trim().toLowerCase();
  if (!q) return [];
  const all = Object.keys(N).map(node).concat(docs.filter((d) => d.loc !== "bin").map(docNode));
  return all.filter((n) => {
    const hay = [n.name, n.desc, n.project && [n.project.kind, n.project.stack, n.project.blurb].join(" "), n.doc && n.doc.text, n.text].filter(Boolean).join(" ").toLowerCase();
    return hay.includes(q);
  }).map((n) => {
    const src = (n.project ? n.project.blurb : n.doc ? n.doc.text || "" : n.text || n.desc || "");
    const i = src.toLowerCase().indexOf(q);
    const snip = i < 0 ? n.desc || "" : (i > 30 ? "…" : "") + src.slice(Math.max(0, i - 30), i + q.length + 50).replace(/\s+/g, " ") + "…";
    return { ...n, snip };
  });
}
