// Real DOS games, run by js-dos (DOSBox compiled to WebAssembly) inside games/play.html.
// Each game is a .jsdos bundle in games/. Closing the window removes the frame, which stops the emulator.
import { h, bus } from "../core.js";
import { openWindow, msgbox } from "../wm.js";
import { launch } from "./index.js";

export const GAMES = {
  doom: {
    title: "Doom", icon: "doom", size: "2.4 MB", w: 680, h: 500,
    about: "DOOM, shareware episode 1: Knee-Deep in the Dead.\nid Software, 1993. Version 1.9, shared as id released it.\nThe full game is sold by id Software.",
    keys: "Arrows  move and turn\nCtrl  fire\nSpace  open doors, press switches\nShift  run · Alt  strafe\n1–7  pick a weapon · Tab  map\nEsc  menu · Y  confirm\n\nOn a phone, use the on-screen buttons.",
  },
};

export function open(arg, from) {
  const id = GAMES[arg] ? arg : "doom";
  const g = GAMES[id];
  let fr = null;
  const status = h("span", {}, `Loading ${g.title} (${g.size})…`);
  const hint = h("span", { class: "fit" }, "Click the game to play");
  const cover = h("div", { class: "dos-wait", "aria-live": "polite" }, h("p", {}, `Loading ${g.title}…`), h("p", { class: "dim" }, `${g.size} the first time, then it's cached.`));
  const showKeys = () => msgbox({ title: `${g.title}: controls`, icon: g.icon, parent: w, text: g.keys });

  const w = openWindow({
    id: "dos:" + id, posKey: "dos", title: g.title, icon: g.icon, app: "dos", arg: id,
    w: g.w, h: g.h, minW: 340, minH: 260, from, bodyClass: "dosbody",
    menubar: [
      { label: "Game", items: () => [
        { label: "Restart", action: () => { fr.src = fr.src; status.textContent = `Restarting ${g.title}…`; cover.hidden = false; } },
        { label: "Full Screen", kbd: "F11", action: () => fr.requestFullscreen?.() },
        { sep: true },
        { label: "Exit", action: () => w.close() },
      ] },
      { label: "Help", items: () => [
        { label: "Controls", action: showKeys },
        { label: `About ${g.title}`, action: () => msgbox({ title: g.title, icon: g.icon, parent: w, text: g.about }) },
        { label: "Help Topics", icon: "help", kbd: "F1", action: () => launch("help", "programs") },
      ] },
    ],
    build(w) {
      fr = h("iframe", { src: `games/play.html?g=${id}`, title: g.title, "data-focus": "", allow: "autoplay; fullscreen; gamepad" });
      w.body.append(h("div", { class: "dosview" }, fr, cover));
      w.el.append(w.statusbar(status, hint));
    },
  });
  if (w._built) return w;
  w._built = true;

  const onMsg = (e) => {
    if (e.source !== fr.contentWindow || e.data?.type !== "dos") return;
    if (e.data.ev === "ready") { cover.hidden = true; status.textContent = `${g.title} is running`; fr.focus(); bus.emit("dos:ready", id); }
    else if (e.data.ev === "focus") w.focus(false);
  };
  window.addEventListener("message", onMsg);
  // pause while minimized so it doesn't keep burning the CPU (and playing sound) in the background
  const sync = () => { try { fr.contentWindow?.dosPause?.(w.min); } catch {} };
  const off = bus.on("wins", sync);
  w.on(() => { window.removeEventListener("message", onMsg); off && off(); });
  setTimeout(() => fr.focus(), 0);
  return w;
}
