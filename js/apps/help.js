// Help: short topics on using PixelOS, with links that open the thing they describe.
import { h, bus } from "../core.js";
import { icon } from "../px.js";
import { openWindow } from "../wm.js";
import { launch, openNode } from "./index.js";

const a = (label, fn) => h("button", { type: "button", class: "btn sm", style: { margin: "0 6px 6px 0" }, onclick: fn }, label);
const kb = (...keys) => keys.map((k, i) => [i ? " + " : "", h("span", { class: "kbd" }, k)]);
const TOPICS = [
  { id: "start", title: "Getting started", icon: "logo", body: () => [
    h("p", {}, "This is my portfolio, built as a small desktop computer. Everything you see works like you'd expect: icons, windows, menus, the taskbar."),
    h("ul", {}, h("li", {}, "Double-click an icon to open it. On a phone, tap once."), h("li", {}, "The Projects folder has the things I built. Each opens a page about it."), h("li", {}, "Right-click almost anything for more options."), h("li", {}, "The Start button, bottom left, has every program.")),
    a("Open Projects", () => openNode("projects")), a("Read About me.txt", () => openNode("readme")),
  ] },
  { id: "windows", title: "Windows", icon: "display", body: () => [
    h("ul", {},
      h("li", {}, "Drag a window by its title bar."),
      h("li", {}, "Drag it to the left or right edge to fill half the screen. Drag it to the top to fill the screen."),
      h("li", {}, "Double-click the title bar to maximize or restore."),
      h("li", {}, "Drag any edge or corner to resize."),
      h("li", {}, "Right-click the title bar, or click its icon, for the window menu."),
      h("li", {}, "Right-click the taskbar to cascade or tile every window.")),
  ] },
  { id: "files", title: "Desktop and files", icon: "folder", body: () => [
    h("ul", {},
      h("li", {}, "Drag icons to move them. They snap to a grid and remember where you put them."),
      h("li", {}, "Drag on empty desktop to select several icons at once."),
      h("li", {}, "Press F2 to rename, Delete to send to the Recycle Bin."),
      h("li", {}, "Drop a picture from your own computer onto the desktop. It becomes 16-colour pixel art."),
      h("li", {}, "Notes and paintings you save stay in this browser. Nothing is uploaded.")),
    a("Open My Documents", () => openNode("documents")), a("Open Recycle Bin", () => openNode("bin")),
  ] },
  { id: "programs", title: "Programs", icon: "folderApp", body: () => [
    h("table", {}, h("tbody", {}, ...[
      ["Terminal", "A command line. Type help, or try neofetch.", "terminal"],
      ["Notepad", "Write notes and save them to the desktop.", "notepad"],
      ["Paint", "Draw pixel art and set it as your wallpaper.", "paint"],
      ["Minesweeper", "Three levels. Right-click or long-press to flag.", "mines"],
      ["Doom", "The real 1993 game. Arrows move, Ctrl fires, Space opens doors.", "dos"],
      ["Tunes", "Three original chiptune tracks. I dance.", "tunes"],
      ["Calculator", "Works with the keyboard.", "calc"],
      ["Web Browser", "Opens the live projects.", "browser"],
    ].map(([n, d, app]) => h("tr", {}, h("td", {}, h("button", { type: "button", class: "btn sm", onclick: () => launch(app) }, n)), h("td", {}, d))))),
  ] },
  { id: "rohan", title: "Pixel Rohan and mail", icon: "me", body: () => [
    h("p", {}, "That's me on the taskbar. I walk around, wave, and point things out. Leave me alone for a bit and I sit down, open my laptop and code. Leave me longer and I nap."),
    h("ul", {}, h("li", {}, "Click me to say hi, right-click for the tour and more."), h("li", {}, "Drag me to pick me up. Let go and I fall. Throw me if you must."), h("li", {}, "Every so often I bring you mail. The envelope in the tray opens your inbox."), h("li", {}, "Hit Reply on any message and it goes to my real email."), h("li", {}, "Play something in Tunes and watch."), h("li", {}, "In Terminal, type rohan.")),
    a("Show me around", () => bus.emit("me:tour")),
    a("Open the inbox", () => launch("mail", "inbox")),
    a("My settings", () => launch("settings", "me")),
  ] },
  { id: "keys", title: "Keyboard shortcuts", icon: "system", body: () => [
    h("table", {}, h("tbody", {}, ...[
      [kb("Ctrl", "Esc"), "Open the Start menu"],
      [kb("Alt", "F4"), "Close the active window"],
      [kb("Alt", "Tab"), "Switch windows (Alt + ` in some browsers)"],
      [kb("Win", "D"), "Show the desktop"],
      [kb("F1"), "Help"],
      [kb("F2"), "Rename the selected icon"],
      [kb("Del"), "Send to the Recycle Bin"],
      [kb("Alt", "Enter"), "Properties"],
      [kb("Shift", "F10"), "Right-click menu"],
      [kb("Arrows"), "Move between icons"],
    ].map(([k, d]) => h("tr", {}, h("td", {}, ...k.flat()), h("td", {}, d))))),
  ] },
  { id: "about", title: "About this site", icon: "info", body: () => [
    h("p", {}, "Built by hand by Rohan Ahire with plain JavaScript and canvas. No framework, no build step. Every icon, cursor, sound and song is made in code."),
    h("p", {}, "It works with a keyboard and a screen reader, respects reduced motion, and fits on a phone."),
    a("Mail Rohan", () => launch("mail")), a("System info", () => launch("system")),
  ] },
];

export function open(topic, from) {
  topic = TOPICS.some((t) => t.id === topic) ? topic : "start";
  const nav = h("nav", { "aria-label": "Help topics" });
  const art = h("article", { tabindex: "0", "aria-live": "polite" });
  const btns = {};
  const show = (id) => {
    const t = TOPICS.find((x) => x.id === id);
    Object.entries(btns).forEach(([k, b]) => b.setAttribute("aria-current", String(k === id)));
    art.replaceChildren(h("h2", {}, t.title), ...t.body());
    art.scrollTop = 0;
  };
  const w = openWindow({
    id: "help", title: "PixelOS Help", icon: "help", app: "help", w: 700, h: 470, minW: 320, minH: 260, from,
    onReopen: (w) => w._show?.(topic),
  });
  if (w._show) return w;
  w._show = show;
  TOPICS.forEach((t) => { btns[t.id] = h("button", { type: "button", onclick: () => show(t.id) }, icon(t.icon, { size: 16, scale: 1, still: true }), t.title); nav.append(btns[t.id]); });
  nav.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const all = [...nav.querySelectorAll("button")], i = all.indexOf(document.activeElement);
    const n = all[(i + (e.key === "ArrowDown" ? 1 : -1) + all.length) % all.length];
    n.focus(); n.click();
  });
  w.body.append(h("div", { class: "help" }, nav, art));
  show(topic);
  setTimeout(() => btns[topic].focus(), 0);
  return w;
}
