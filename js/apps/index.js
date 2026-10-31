// Program launcher. Apps load on first use, with an hourglass cursor while they do.
import { msgbox } from "../wm.js";
import * as fs from "../fs.js";

const LOAD = {
  welcome: () => import("./welcome.js"),
  explorer: () => import("./explorer.js"),
  project: () => import("./project.js"),
  notepad: () => import("./notepad.js"),
  mail: () => import("./mail.js"),
  settings: () => import("./settings.js"),
  help: () => import("./help.js"),
  terminal: () => import("./terminal.js"),
  paint: () => import("./paint.js"),
  mines: () => import("./mines.js"),
  dos: () => import("./dos.js"),
  tunes: () => import("./tunes.js"),
  reel: () => import("./reel.js"),
  calc: () => import("./calc.js"),
  browser: () => import("./browser.js"),
  run: () => import("./tools.js").then((m) => ({ open: m.run })),
  find: () => import("./tools.js").then((m) => ({ open: m.find })),
  taskman: () => import("./tools.js").then((m) => ({ open: m.taskman })),
  system: () => import("./tools.js").then((m) => ({ open: m.system })),
  properties: () => import("./tools.js").then((m) => ({ open: m.properties })),
};
export const APPS = Object.keys(LOAD);
const cache = new Map();

// launch("explorer", "projects", fromElement) -> Promise<win>
export async function launch(app, arg = null, from = null) {
  const load = LOAD[app];
  if (!load) { msgbox({ title: "Run", icon: "error", text: `PixelOS can't find "${app}". Check the name and try again.` }); return null; }
  let mod = cache.get(app);
  if (!mod) {
    const t = setTimeout(() => document.body.classList.add("busy"), 60);
    try { mod = await load(); cache.set(app, mod); }
    catch (e) { console.error(e); msgbox({ title: "PixelOS", icon: "error", text: "That program didn't load. Check your connection and try again." }); return null; }
    finally { clearTimeout(t); setTimeout(() => document.body.classList.remove("busy"), 120); }
  }
  return mod.open(arg, from);
}

export function openNode(id, from = null) {
  const n = fs.node(id);
  if (!n) return null;
  if (fs.isFolder(n)) return launch("explorer", id, from);
  // a project with a live site opens as a working app inside the browser; the rest open their write-up
  if (n.type === "project") return n.project?.live ? launch("browser", "app:" + id, from) : launch("project", id, from);
  if (n.type === "doc") return launch("notepad", id, from);
  if (n.type === "pic") return launch("paint", id, from);
  if (n.app) return launch(n.app, n.arg ?? null, from);
  return null;
}
export const properties = (id, from) => launch("properties", id, from);
