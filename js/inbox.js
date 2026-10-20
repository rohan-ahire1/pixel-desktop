// "You've got mail!": short notes from Rohan that arrive while you look around. A welcome note, one for the
// first visit to a few important things, and a tip when you've gone quiet. Never repeats, at most 8 a visit.
import { bus, settings, store, session } from "./core.js";
import { sfx, ready } from "./sound.js";
import { active } from "./wm.js";
import { launch, openNode } from "./apps/index.js";
import { PROJECTS, ABOUT, NOW } from "./data.js";

const CAP = 8, GAP = 30, TIP_IDLE = 30;
const FROM = "Rohan Ahire";
const box = store.get("inbox", []);
const sent = new Set(store.get("mailSeen", []));
let count = +(session.get("mailN") || 0), lastAt = -1e9, lastInput = performance.now(), queue = [], started = false;
const apps = new Set();

const proj = (id) => PROJECTS.find((p) => p.id === id);
const sign = "\n\nRohan";
const MAILS = {
  welcome: () => ({ subject: "Welcome to my desktop",
    body: `Hey,\n\nThanks for stopping by. This whole site is a tiny operating system I built from scratch. Every icon is drawn in code and every sound is made by your browser.\n\nThe short version of me: ${ABOUT}\n\nThe good stuff is in the Projects folder. Flaggo and Coachmate run right here, in their own windows.\n\nI'll drop you a note now and then while you look around. I promise not to spam.${sign}`,
    actions: [["Open Projects", "projects"], ["Take the tour", "tour"]] }),
  "live:flaggo": () => ({ subject: "You found Flaggo", body: `${proj("flaggo").blurb}\n\nStart with the daily challenge.\n\nBuilt with ${proj("flaggo").stack}.${sign}`, actions: [["Open Flaggo", "open:flaggo"]] }),
  "live:coachmate": () => ({ subject: "About Coachmate", body: `${proj("coachmate").blurb}\n\nGot a Chess.com username? Type it in and see what it finds.\n\nBuilt with ${proj("coachmate").stack}.${sign}`, actions: [["Open Coachmate", "open:coachmate"]] }),
  notes: (id) => { const p = proj(id); return p && { subject: `Notes on ${p.name}`, body: `Since you opened ${p.name}, here's the longer story.\n\n${p.blurb}\n\nStack: ${p.stack}\nStatus: ${p.status}, ${p.year}\n\nHappy to walk you through the code. Just reply.${sign}`, actions: [["Reply", "reply"]] }; },
  tunes: () => ({ subject: "The music is homemade", body: `Every note in Tunes is played live by your browser. No audio files, just oscillators and a bit of maths.\n\nTurn it up. I'll dance.${sign}` }),
  mines: () => ({ subject: "Minesweeper champion", body: `You actually beat Minesweeper. Most people click until it explodes.\n\nIf you're that careful with code too, we should talk.${sign}`, actions: [["Reply", "reply"]] }),
  collab: () => ({ subject: "Want to work together?", body: `You've clicked around quite a bit, so here's the direct pitch.\n\nI take ideas from the first commit to something people can use: games, tools, trading systems, apps. If you have a project, a role, or just a question, hit Reply. It goes straight to my real inbox.${sign}`, actions: [["Reply", "reply"]] }),
  "tip:right": () => ({ subject: "Psst: right-click everything", body: `Almost everything here has a right-click menu: the desktop, the icons, window title bars, the taskbar, even me.\n\nOn a phone, press and hold instead.${sign}` }),
  "tip:now": () => ({ subject: "What I'm up to", body: `A quick update from my side:\n\n${NOW.map((n) => "  - " + n).join("\n")}\n\nAsk me about any of it.${sign}`, actions: [["Reply", "reply"]] }),
  "tip:terminal": () => ({ subject: "Try the terminal", body: `Open Terminal and type help to see what it can do. Type rohan to boss me around.\n\nI won't judge your typos. Much.${sign}`, actions: [["Open Terminal", "terminal"]] }),
  "tip:paint": () => ({ subject: "Make your own wallpaper", body: `Draw something in Paint, then pick File › Set as Wallpaper. It sticks around next time you visit.${sign}`, actions: [["Open Paint", "paint"]] }),
  "tip:keys": () => ({ subject: "Keyboard shortcuts", body: `It works like a real desktop:\n\n  Alt+\`            switch windows\n  Ctrl+Esc          Start menu\n  F1                Help\n  Ctrl+Shift+Esc    Task Manager\n  Ctrl+Alt+D        show the desktop\n  Ctrl+Alt+R        Run${sign}` }),
};
const TIPS = ["tip:right", "tip:now", "tip:terminal", "tip:paint", "tip:keys"];

const ACTIONS = {
  projects: () => launch("explorer", "projects"),
  tour: () => bus.emit("me:tour"),
  terminal: () => launch("terminal"),
  paint: () => launch("paint"),
};
export function runAction(a, m) {
  if (a === "reply") return launch("mail", { subject: "Re: " + m.subject });
  if (a.startsWith("open:")) return openNode(a.slice(5));
  ACTIONS[a]?.();
}

export const messages = () => box.slice().sort((a, b) => b.time - a.time);
export const unread = () => box.filter((m) => !m.read).length;
export const getMail = (id) => box.find((m) => m.id === id);
const save = () => { store.set("inbox", box); bus.emit("mail:changed", unread()); };
export function markRead(id, read = true) { const m = getMail(id); if (m && m.read !== read) { m.read = read; save(); } }
export function removeMail(id) { const i = box.findIndex((m) => m.id === id); if (i >= 0) { box.splice(i, 1); save(); } }

// the visitor is in the middle of something: don't pop a tip on them
function busy() {
  const el = document.activeElement;
  if (el && (el.matches?.("input, textarea, [contenteditable]") || el.closest?.(".term"))) return true;
  const w = active();
  if (!w || w.min) return false;
  const id = w.id || "";
  return /^(paint-|terminal-|notepad-|browser:)/.test(id) || ["mines", "calc", "mail"].includes(id);
}

function voice() {
  if (!settings.sound || !settings.meVoice || !ready() || !window.speechSynthesis) return;
  try { const u = new SpeechSynthesisUtterance("You've got mail!"); u.rate = 1.05; u.pitch = 1.1; u.volume = Math.min(1, settings.volume + 0.2); speechSynthesis.speak(u); } catch (e) {}
}
function arrive(m) {
  box.push(m);
  if (box.length > 40) box.splice(0, box.length - 40);
  save();
  sfx("mail");
  setTimeout(voice, 650);
  bus.emit("mail:new", m);
  bus.emit("notify", { title: "You've got mail!", text: m.subject, icon: "mail", silent: true, timeout: 9000, action: () => launch("mail", { read: m.id }) });
}
// send(key) -> true when it went out (or got queued behind the 30s gap)
function send(key, arg, force = false) {
  const k = arg ? `${key}:${arg}` : key;
  if (!settings.meMail || sent.has(key === "notes" ? "notes" : k) || count >= CAP) return false;
  const t = performance.now() / 1000;
  if (!force && t - lastAt < GAP) { if (!queue.some((q) => q[0] === key)) queue.push([key, arg]); return true; }
  const m = MAILS[key]?.(arg);
  if (!m) return false;
  sent.add(key === "notes" ? "notes" : k); store.set("mailSeen", [...sent]);
  count++; session.set("mailN", String(count)); lastAt = t;
  const mail = { id: k + "-" + Date.now().toString(36), from: FROM, time: Date.now(), read: false, actions: [], ...m };
  if (settings.me) bus.emit("me:deliver", { id: mail.id, done: () => arrive(mail) });
  else arrive(mail);
  return true;
}
export const mailStatus = () => ({ sent: count, cap: CAP, unread: unread() });

export function initInbox() {
  const poke = () => (lastInput = performance.now());
  for (const ev of ["pointerdown", "pointermove", "keydown", "wheel"]) addEventListener(ev, poke, { capture: true, passive: true });
  bus.on("shell:ready", () => {
    if (started) return;
    started = true;
    setTimeout(() => send("welcome", null, true), 15000);
    setInterval(() => {
      if (document.hidden) return;
      const t = performance.now() / 1000;
      if (queue.length && t - lastAt >= GAP) { const [k, a] = queue.shift(); send(k, a); return; }
      const idle = (performance.now() - lastInput) / 1000;
      if (idle < TIP_IDLE || t - lastAt < GAP * 2 || busy() || !sent.has("welcome")) return;
      const tip = TIPS.find((x) => !sent.has(x));
      if (tip) send(tip);
    }, 5000);
  });
  bus.on("win:open", (w) => {
    const id = w.id || "";
    if (!["welcome", "inbox"].includes(id)) apps.add(w.app || id);
    if (id === "browser:flaggo" || id === "browser:coachmate") setTimeout(() => send("live:" + id.slice(8)), 20000);
    else if (id.startsWith("project:")) setTimeout(() => send("notes", id.slice(8)), 12000);
    if (apps.size >= 4 && !["welcome", "inbox"].includes(id)) setTimeout(() => send("collab"), 25000);
  });
  bus.on("music", (m) => { if (m.playing) setTimeout(() => send("tunes"), 12000); });
  bus.on("mines:win", () => setTimeout(() => send("mines"), 3000));
  bus.on("settings", (p) => { if ("meMail" in p && !settings.meMail) queue = []; });
}
