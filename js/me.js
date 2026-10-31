// Pixel Rohan lives on top of the taskbar. He walks in and waves, sits down and codes when you go quiet,
// naps if you leave, reacts to what you open, gives a short tour and runs the mail to the tray.
// Visitors can pick him up, swing him around and drop (or throw) him; he falls back down to the taskbar.
import { h, bus, settings, setSettings, store, reduce, small, clamp, pick } from "./core.js";
import { px, K } from "./px.js";
import { openMenu } from "./menu.js";
import { list as winList, active, minimizeAll } from "./wm.js";
import { launch } from "./apps/index.js";
import { PROJECTS } from "./data.js";
import { sfx } from "./sound.js";
import { GW, GH, build } from "./me-sprite.js";

const CH = 64; // strip height in sprite pixels
const R = (a, b) => a + Math.random() * (b - a);
const GLYPH = {
  "{": [".##", ".#.", "#..", ".#.", ".##"], "}": ["##.", ".#.", "..#", ".#.", "##."], "<": ["..#", ".#.", "#..", ".#.", "..#"],
  ">": ["#..", ".#.", "..#", ".#.", "#.."], "/": ["..#", "..#", ".#.", "#..", "#.."], ";": ["...", ".#.", "...", ".#.", "#.."],
  "0": ["###", "#.#", "#.#", "#.#", "###"], "1": [".#.", "##.", ".#.", ".#.", "###"],
  Z: ["###", "..#", ".#.", "#..", "###"], N: ["..##", "..#.", "..#.", "###.", "##.."],
};
const CODE = "{}<>/;01", CODE_C = "#7cffb2";
const THOUGHTS = ["one more bug…", "it works on my machine", "ship it?", "who wrote this? oh. me.", "naming things is hard", "just one more feature", "coffee first", "it compiled. suspicious."];
const SEATED = new Set(["sit", "open", "code", "sip", "think", "close", "nap", "wake", "rise"]);
const DESC = { off: "on the way", walk: "walking around", stand: "hanging out", dance: "dancing", pose: "watching you", sit: "sitting down", open: "opening his laptop",
  code: "coding", sip: "having a coffee", think: "thinking", close: "closing his laptop", nap: "napping", wake: "waking up", rise: "getting up",
  held: "being carried", fall: "falling" };
const AIR = new Set(["held", "fall"]);
const air = () => AIR.has(me.st);
// when a window covers his spot he ducks behind the taskbar, leaving his hair and eyes peeking out,
// so whatever you're doing stays visible; he pops back up to talk, deliver mail or give the tour
const DUCK_STAND = 27, DUCK_SIT = 20;
function covered() {
  const pr = pet.getBoundingClientRect(), l = (me.x - 9) * S, r = (me.x + 9) * S, t = pr.bottom - GH * S;
  return winList().some((w) => { if (w.min || !w.el.isConnected) return false; const b = w.el.getBoundingClientRect(); return b.right > l && b.left < r && b.bottom > t && b.top < pr.bottom; });
}
const ducked = () => me.sink > 0.3;
const sinkPx = () => me.sink * (SEATED.has(me.st) ? DUCK_SIT : DUCK_STAND);

let pet, cv, ctx, hit, say, sayTxt, sayBtns, live, hc, hctx;
let S = 3, CW = 400, now = 0, running = false, raf = 0, hiddenUntil = 0, lastInput = performance.now();
let lastTip = -40, duckedAt = -1, hoverT = 0, hiddenAt = 0, peakWins = 0, konami = 0;
let tour = null, delivering = false, deliverFin = null, dirty = true, lastKey = "", lastDesc = "", sayT = 0, onHide = null, lastReact = -99, lineT = 0;
const me = { x: -30, y: 0, sink: 0, vy: 0, dir: 1, st: "off", t: 0, dur: 0, tx: 0, then: null, pose: "stand", carry: false, blink: 3, talk: 0, smile: 0, lookUp: 0, sub: 10, spawn: 0 };
const parts = [];
const ptr = { x: -1, seen: -99, inWin: false };
const music = { on: false, bpm: 110 };
const seen = store.get("meSeen", {}), cool = {};
const stats = store.get("meStats", { mails: 0, coffees: 0, lines: 0, naps: 0, waves: 0, lifts: 0, since: Date.now() });
// drag: screen px of the sprite's top-left (x, y), velocity, tilt; the grip point is his raised hands
const drag = { down: null, on: false, x: 0, y: 0, vx: 0, vy: 0, tilt: 0, lt: 0, bounced: false, top: 0, whee: 0, eat: false };
function bump(k, n = 1) { stats[k] = (stats[k] || 0) + n; store.set("meStats", stats); bus.emit("me:stats", stats); }

/* ---------- state ---------- */
export const meStatus = () => (!settings.me ? "hiding" : running ? DESC[me.st] || "around" : "away");
export const meStats = () => ({ ...stats });
export const meRunning = () => running;
function setSt(st, dur = 1, then = null) {
  me.st = st; me.t = 0; me.dur = dur; me.then = then; dirty = true;
  const d = meStatus();
  if (d !== lastDesc) { lastDesc = d; bus.emit("me:status", d); }
}
function finish() { const fn = me.then; me.then = null; if (fn) fn(); else setSt("stand", R(6, 12)); }
function walkTo(x, then = null, carry = false) { me.tx = clamp(x, 10, CW - 10); me.carry = carry; setSt("walk", 30, then); }
function pose(name, dur = 2.6, then = null) {
  setSt("pose", dur, then); me.pose = name;
  if (name === "startle" && !reduce) { me.vy = 42; me.y = 0.01; }
}
// big moments need him on his feet: shut the laptop and stand up first
function standThen(fn) {
  if (me.st === "off" || air()) return;
  if (SEATED.has(me.st)) setSt("rise", reduce ? 0 : 0.45, fn); else fn();
}
const backToIdle = () => setSt("stand", R(6, 12));
function wake() { setSt("wake", 1.3, () => pose("stretch", 1.3, backToIdle)); speak("Huh? I'm up."); }
function faceActive() {
  const w = active();
  if (!w || w.min) return;
  const r = w.el.getBoundingClientRect(), d = (r.left + r.width / 2) / S - me.x;
  if (Math.abs(d) > 8) me.dir = Math.sign(d);
}

/* ---------- talking ---------- */
function tell(msg) { live.textContent = ""; setTimeout(() => (live.textContent = msg), 30); }
function hush(fire = true) {
  clearTimeout(sayT);
  if (say.hidden) return;
  say.hidden = true; dirty = true;
  const fn = onHide; onHide = null;
  if (fire && fn) fn();
}
// speak(text, { buttons: [[label, fn, isDefault]], think, ms, onHide })
function speak(text, o = {}) {
  if (!running || me.st === "off") return;
  hush(false);
  sayTxt.textContent = text;
  sayBtns.replaceChildren(...(o.buttons || []).map(([label, fn, def]) => h("button", { type: "button", class: "btn sm" + (def ? " def" : ""),
    onclick: (e) => { e.stopPropagation(); onHide = null; hush(false); fn(); } }, label)));
  sayBtns.hidden = !o.buttons?.length;
  say.classList.toggle("think", !!o.think);
  say.hidden = false;
  onHide = o.onHide || null;
  if (!o.think) { me.talk = Math.min(2.4, 0.5 + text.length * 0.035); tell(`Rohan: ${text}`); }
  const ms = o.ms ?? (o.buttons ? 25000 : clamp(1800 + text.length * 55, 2600, 7500));
  sayT = setTimeout(() => hush(), ms);
  dirty = true; draw();
  if (o.buttons && !reduce) sayBtns.firstChild?.focus({ preventScroll: true });
}
export function meSay(text) { if (!running) return false; standThen(() => { pose("wave", 2.4, backToIdle); speak(String(text).slice(0, 120)); }); return true; }

/* ---------- reactions ---------- */
const LINES = {
  tunes: { pose: "point", say: "Go on, press play.", once: 1 },
  music: { pose: "dance", say: "Doesn't sound that bad, right?", once: 1 },
  paint: { pose: "point", say: "Draw me something. File › Set as Wallpaper makes it the background.", once: 1 },
  mines: { pose: "point", say: "Careful. Some of those squares bite.", once: 1 },
  dos: { pose: "thumbs", say: ["Real Doom, 1993. Ctrl shoots, Space opens doors.", "Rip and tear. Arrows to move."], once: 1 },
  "mines:lose": { pose: "cover", say: ["I couldn't watch.", "Oof. Again?", "That one was hiding."], cool: 15 },
  "mines:win": { pose: "thumbs", say: "Okay, that was impressive.", cool: 30 },
  terminal: { pose: "point", say: "Type help. Or try rohan.", once: 1 },
  termerr: { pose: "facepalm", say: ["Typo? Happens to me daily.", "Not a command. Try help."], cool: 45 },
  calc: { pose: "cover", say: "Doing your taxes? I'll look away.", once: 1 },
  help: { pose: "pointUp", say: "Stuck? F1 opens this anytime. Or right-click me.", once: 1 },
  settings: { pose: "thumbs", say: "Make it yours. The wallpapers are all drawn in code.", once: 1 },
  browser: { pose: "point", say: "Pixel Navigator. My projects run right inside it.", once: 1 },
  projects: { pose: "pointUp", say: "Everything in here is real. Pick one.", once: 1 },
  computer: { pose: "point", say: "All of this runs in your browser. Poke around.", once: 1 },
  readme: { pose: "wave", say: "That's me. Hi again.", once: 1 },
  mail: { pose: "thumbs", say: "Say hi. It goes straight to my inbox.", once: 1 },
  "app:recoup": { pose: "point", say: "It's all sample data, so click whatever you like.", once: 1 },
  "app:pointer": { pose: "thumbs", say: "Pick a pattern and step through it.", once: 1 },
  "app:flaggo": { pose: "thumbs", say: "Flaggo! Try the daily challenge.", once: 1 },
  "app:coachmate": { pose: "point", say: "Got a Chess.com username? Type it in.", once: 1 },
  taskman: { pose: "wave", say: "Looking for me? I'm rohan.exe. Please don't.", once: 1 },
  wallpaper: { pose: "thumbs", say: ["Ooh, nice pick.", "Good choice.", "That one's my favourite too."], cool: 30 },
  error: { pose: "facepalm", say: ["Oops. Not what you wanted?", "Hm. Let's try that again."], cool: 20 },
  bug: { pose: "facepalm", say: "That's a real bug. Sorry about that.", cool: 60 },
  blocked: { pose: "facepalm", say: "Some sites won't open inside a frame. The button opens it in a new tab.", cool: 30 },
  shutdown: { pose: "wave", say: "Bye! Come back soon.", force: 1 },
  max: { pose: "cover", say: "Full screen? I'll duck.", once: 1 },
  crowd: { pose: "facepalm", say: ["That's a lot of windows.", "This many windows? You'd love my browser tabs."], cool: 180 },
  tidy: { pose: "thumbs", say: ["Clean desk. Nice.", "All closed. Fresh start."], cool: 180 },
  back: { pose: "wave", say: ["Welcome back. I kept your seat warm.", "Oh, you're back!", "There you are."], cool: 120 },
  offline: { pose: "facepalm", say: "Wi-Fi's gone. Good thing I can code offline.", cool: 60 },
  online: { pose: "thumbs", say: "And we're back online.", cool: 60 },
  mailsent: { pose: "thumbs", say: ["Sent! I read every one of these.", "Thanks for writing. I'll reply soon."], cool: 30 },
  trash: { pose: "point", say: ["Into the bin it goes.", "Bye, file."], cool: 90 },
  restore: { pose: "thumbs", say: "Saved it just in time.", cool: 90 },
  binEmpty: { pose: "cover", say: "Gone for good. No take-backs.", cool: 60 },
  copy: { pose: "thumbs", say: ["Taking notes? I'm flattered.", "Copied. Use it wisely."], cool: 180 },
  phew: { pose: "wave", say: ["Phew. I can see again.", "Is it safe to come up?"], cool: 120 },
  long: { pose: "wave", say: "Ten minutes already? Thanks for sticking around.", cool: 1e9 },
  konami: { pose: "dance", say: "Up, up, down, down… you know the code. Respect.", force: 1 },
};
// things he mentions now and then while standing around with nothing to do
const TIPS = [
  ["point", "Psst. Right-click the desktop."], ["pointUp", "Doom's in Start › Games. The real one."], ["point", "The terminal knows more than it lets on."],
  ["thumbs", "You can pick me up, you know. Drag me."], ["pointUp", "Flaggo has a new daily challenge."], ["point", "Try a different wallpaper. Right-click the desktop."],
  ["wave", "Got a question? Mail me. I answer."], ["pointUp", "Every project in here is something I actually shipped."],
];
export function react(key) {
  if (!running || me.st === "off" || air() || tour || delivering) return false;
  let L = LINES[key];
  if (!L && key.startsWith("project:")) {
    const p = PROJECTS.find((q) => "project:" + q.id === key);
    if (p) L = { pose: "point", say: `${p.name}: ${p.sum}`, once: 1 };
  }
  if (!L || (L.once && seen[key])) return false;
  const t = performance.now() / 1000;
  if (L.cool && t - (cool[key] ?? -1e9) < L.cool) return false;
  if (!L.force && t - lastReact < 3) return false;
  lastReact = cool[key] = t;
  if (L.once) { seen[key] = 1; store.set("meSeen", seen); }
  if (settings.meQuiet && !L.force) return false;
  const text = Array.isArray(L.say) ? pick(L.say) : L.say;
  standThen(() => {
    faceActive();
    if (L.pose === "dance") { me.party = key === "konami"; setSt("dance", me.party ? 6 : R(10, 16)); } else pose(L.pose, 2.8, backToIdle);
    speak(text);
  });
  return true;
}
function keyFor(w) {
  const id = w.id || "", app = w.app;
  if (id.startsWith("browser:")) return "app:" + id.slice(8);
  if (id === "browser") return "browser";
  if (id.startsWith("project:")) return id;
  if (app === "explorer") return w.arg === "projects" ? "projects" : w.arg === "computer" ? "computer" : null;
  if (app === "notepad") return w.arg === "readme" ? "readme" : null;
  if (id === "mail") return "mail";
  return ["tunes", "paint", "mines", "dos", "terminal", "calc", "help", "settings", "taskman"].includes(app) ? app : null;
}

/* ---------- tour ---------- */
const TOUR = [
  ["computer", "My Computer. Specs, drives and the Control Panel."],
  ["projects", "Projects. Everything I've built. Recoup, Pointer and Flaggo run right here."],
  ["terminal", "The terminal. Type help, or rohan to boss me around."],
  ["mail", "Mail. Write to me here. I'll send you notes too."],
];
const tourKey = (e) => { if (e.key === "Escape" && tour) { e.preventDefault(); e.stopPropagation(); endTour(false); } };
const clearHi = () => document.querySelectorAll(".tour-hi").forEach((el) => el.classList.remove("tour-hi"));
export function startTour() {
  if (!settings.me) { setSettings({ me: true }); setTimeout(startTour, 2500); return; }
  if (!running || me.st === "off" || air() || tour) return;
  tour = { i: -1 };
  if (winList().some((w) => !w.min && !w.modal)) minimizeAll();
  addEventListener("keydown", tourKey, true);
  bus.emit("me:status", "giving a tour");
  nextStep();
}
function nextStep() {
  if (!tour) return;
  clearHi();
  const steps = TOUR.filter(([id]) => document.getElementById("di-" + id));
  tour.i++;
  if (tour.i >= steps.length) { endTour(true); return; }
  const [id, text] = steps[tour.i], el = document.getElementById("di-" + id), r = el.getBoundingClientRect();
  const last = tour.i === steps.length - 1;
  standThen(() => walkTo((r.right) / S + 10, () => {
    if (!tour) return;
    me.dir = -1; pose("pointUp", 1e9);
    el.classList.add("tour-hi");
    speak(text, { buttons: [[last ? "Done" : "Next ›", nextStep, true], ["End tour", () => endTour(false)]], onHide: () => endTour(false) });
  }));
}
function endTour(done) {
  if (!tour) return;
  tour = null; clearHi();
  removeEventListener("keydown", tourKey, true);
  backToIdle();
  speak(done ? "That's the tour. Right-click me anytime for more." : "No worries. Right-click me if you want it again.");
}

/* ---------- mail run ---------- */
function deliver({ done }) {
  let fired = false;
  const fin = () => { if (fired) return; fired = true; clearTimeout(to); delivering = false; deliverFin = null; done(); };
  const to = setTimeout(fin, 12000);
  const tb = document.querySelector(".tray .trb.mail");
  if (!running || me.st === "off" || air() || reduce || document.hidden || tour || !tb || !tb.offsetWidth) {
    fin();
    if (running && me.st !== "off" && !air() && !tour && !settings.meQuiet) standThen(() => { pose("wave", 2.2, backToIdle); speak("You've got mail!"); });
    return;
  }
  delivering = true; deliverFin = fin; hush();
  const r = tb.getBoundingClientRect(), tx = clamp((r.left + r.width / 2) / S, 10, CW - 10);
  standThen(() => walkTo(tx - 4, () => {
    me.dir = 1;
    parts.push({ k: "env", x: tx - 4, y: CH - 30, vy: -10, t: 0 });
    pose("wave", 2.4, backToIdle);
    speak("You've got mail!");
    bump("mails");
    setTimeout(fin, 500);
  }, true));
}

/* ---------- actions ---------- */
let pokes = [];
function hello() {
  if (!running || me.st === "off" || air()) return;
  const t = performance.now();
  pokes = pokes.filter((p) => t - p < 3000).concat(t);
  if (pokes.length >= 7) { pokes = []; standThen(() => { pose("facepalm", 2.4, backToIdle); speak(pick(["I'm going to start charging for this.", "Okay, that's enough poking for one day."])); }); return; }
  if (pokes.length >= 4) { standThen(() => { pose("startle", 0.8, backToIdle); speak(pick(["Okay, okay, I'm here!", "That tickles!", "Hey! Easy."]), { ms: 1800 }); }); return; }
  if (me.st === "nap") { wake(); return; }
  if (SEATED.has(me.st)) { me.lookUp = now + 2.5; speak(pick(["Hm? Oh, hi!", "One sec, almost done.", "Hey! Just fixing a bug."])); return; }
  pose("wave", 2.2, backToIdle); bump("waves");
  speak(pick(["Hi! Right-click me for more.", "Hey there!", "Want a tour? Right-click me.", "Try the terminal. Type rohan.", "I'm Rohan. The real one built all this."]));
}
export function meCode() {
  if (!running || me.st === "off" || air() || tour) return;
  if (me.st === "nap") { setSt("open", 1); return; }
  if (!SEATED.has(me.st)) setSt("sit", 0.6);
  else if (me.st !== "code") setSt("open", 1);
}
export function meBreak() {
  if (!running || me.st === "off" || air() || tour) return;
  if (SEATED.has(me.st)) { setSt("sip", 2.6); bump("coffees"); speak(pick(["Coffee break.", "Brb, refilling."])); }
  else standThen(() => { pose("stretch", 1.6, backToIdle); speak("Stretch time."); });
}
export function callMe(x) {
  if (!settings.me) { setSettings({ me: true }); return; }
  if (!running || me.st === "off" || air()) return;
  if (me.st === "nap") { wake(); return; }
  const tx = clamp(x ?? (now - ptr.seen < 3 ? ptr.x : CW / 2), 14, CW - 14);
  standThen(() => walkTo(tx, () => { pose("wave", 2, backToIdle); speak(pick(["You called?", "Here!", "What's up?"])); }));
}
export function hideMe(sec = 60) {
  hiddenUntil = performance.now() + sec * 1000;
  stop();
  setTimeout(() => {
    if (settings.me && !running) { start(); arrive(true); bus.emit("notify", { title: "Rohan is back", text: "Ending rohan.exe only works for a minute.", icon: "me" }); }
  }, sec * 1000);
}
function sendAway() {
  setSettings({ me: false });
  bus.emit("notify", { title: "Rohan stepped out", text: "Click here to bring me back. I'm also in the Control Panel.", icon: "me", action: () => setSettings({ me: true }) });
}
function menu(x, y) {
  const seated = SEATED.has(me.st);
  openMenu([
    { label: "Say hi", icon: "me", bold: true, action: hello },
    { label: "Show me around", action: startTour },
    { label: seated ? "Take a break" : "Back to work", action: seated ? meBreak : meCode },
    { label: "Check mail", icon: "mail", action: () => launch("mail", "inbox") },
    { sep: true },
    { label: settings.meQuiet ? "Talk to me again" : "Quiet mode", action: () => setSettings({ meQuiet: !settings.meQuiet }) },
    { label: "Avatar settings…", action: () => launch("settings", "me") },
    { label: "Send me away", action: sendAway },
  ], { x, y, restoreFocus: hit });
}
const spot = () => Math.round(CW * (small() ? 0.4 : 0.3));
function greet(back) {
  const met = store.get("meMet", false), hr = new Date().getHours(), late = hr >= 23 || hr < 5;
  pose("wave", 2.4, backToIdle);
  if (back) speak("I'm back!");
  else if (!met) {
    store.set("meMet", true);
    speak("Hey, I'm Rohan! Well, the pixel version. Want a quick tour?", { buttons: [["Sure", startTour, true], ["Maybe later", () => speak("Cool. Right-click me if you change your mind.")]] });
  } else {
    const day = new Date().getDay(), weekend = day === 0 || day === 6, morning = hr >= 5 && hr < 11;
    speak(late ? "Welcome back! Up late? Same." : pick(["Welcome back!", "Oh hey, you're back!", "Welcome back. I've been coding."]
      .concat(morning ? ["Morning! Coffee's on.", "Good morning. Early start?"] : [], weekend ? ["Here on a weekend? Me too.", "Weekend project time?"] : [], day === 5 && hr >= 16 ? ["Friday evening. Ship it or leave it?"] : [])));
  }
}
function arrive(back) {
  if (!running) return;
  me.x = -24; me.y = 0; me.dir = 1; parts.length = 0;
  walkTo(spot(), () => greet(back));
}
// the boot film lands him on his spot: screen px of the sprite's top-left, and his scale
export function meDock() {
  if (!running) return null;
  const r = cv.getBoundingClientRect();
  return { x: r.left + (spot() - GW / 2) * S, y: r.top + (CH - GH) * S, S };
}
// and lets go of him there, so he skips the walk in
export function meLand() {
  if (!running || me.st !== "off") return;
  me.x = spot(); me.y = 0; me.dir = 1; parts.length = 0;
  greet(false);
  dirty = true; draw();
}

/* ---------- pick me up ---------- */
const GRIP_X = 17, GRIP_Y = 3; // where the pointer holds him (his hands), in sprite pixels
const ground = () => pet.getBoundingClientRect().bottom - GH * S;
function pickUp(e) {
  if (!running || me.st === "off") return;
  const napping = me.st === "nap";
  if (tour) { tour = null; clearHi(); removeEventListener("keydown", tourKey, true); }
  if (deliverFin) deliverFin();
  hush(false);
  drag.on = true; drag.vx = drag.vy = 0; drag.tilt = 0; drag.lt = performance.now(); drag.bounced = false; drag.eat = true;
  drag.x = e.clientX - GRIP_X * S; drag.y = e.clientY - GRIP_Y * S; drag.top = drag.y;
  setSt("held", 0); me.carry = false; me.y = 0; me.vy = 0;
  hc.hidden = false; hit.hidden = true;
  document.documentElement.classList.add("me-dragging");
  bump("lifts"); sfx("lift");
  speak(napping ? "Huh?! Whoa, whoa!" : pick(["Whoa!", "Hey! Put me down!", "Where are we going?", "I can walk, you know.", "Okay, this is new."]
    .concat(stats.lifts > 10 ? ["You again? Fine, carry me.", "Frequent flyer, me."] : [])));
  drawHeld();
}
function moveHeld(e) {
  const t = performance.now(), dt = Math.max(8, t - drag.lt) / 1000;
  const nx = e.clientX - GRIP_X * S, ny = e.clientY - GRIP_Y * S;
  // smoothed velocity in screen px/s, used for the swing and the throw
  drag.vx = drag.vx * 0.5 + ((nx - drag.x) / dt) * 0.5;
  drag.vy = drag.vy * 0.5 + ((ny - drag.y) / dt) * 0.5;
  drag.x = nx; drag.y = ny; drag.lt = t; drag.top = Math.min(drag.top, ny);
  if (Math.hypot(drag.vx, drag.vy) > 2200 && now - drag.whee > 4 && say.hidden) { drag.whee = now; speak(pick(["Wheee!", "Too fast!", "Aaaa!"]), { ms: 1400 }); sfx("whee"); }
}
function letGo(e) {
  if (!drag.on) return;
  drag.on = false;
  document.documentElement.classList.remove("me-dragging");
  if (performance.now() - drag.lt > 90) drag.vx = drag.vy = 0; // held still before letting go: just drop
  drag.vx = clamp(drag.vx, -1800, 1800); drag.vy = clamp(drag.vy, -1800, 1200);
  const bin = e && document.elementsFromPoint?.(e.clientX, e.clientY).find((el) => el.id === "di-bin");
  drag.bin = !!bin;
  if (bin) speak("Not the Recycle Bin!", { ms: 1800 });
  setSt("fall", 0);
  if (reduce || drag.y >= ground()) land(reduce ? 0 : Math.max(0, drag.vy));
}
function land(impact) {
  const height = ground() - drag.top;
  me.x = clamp((drag.x + GRIP_X * S) / S, 10, CW - 10); me.y = 0; me.dir = drag.vx < 0 ? -1 : 1;
  hc.hidden = true; hit.hidden = false; drag.tilt = 0; dirty = true;
  if (impact > 1100 || height > 360) {
    sfx("bonk");
    for (let i = 0; i < 3; i++) parts.push({ k: "star", a: (i * Math.PI * 2) / 3, t: 0 });
    pose("startle", 0.5, () => pose("facepalm", 2.2, backToIdle));
    speak(drag.bin ? "Rude. I'm not trash." : pick(["Ow!", "Ouch. I'm fine. I'm fine.", "My laptop was in that bag!", "Was that necessary?"]));
  } else {
    sfx("thud");
    pose("thumbs", 1.8, backToIdle);
    speak(drag.bin ? "Rude. I'm not trash." : pick(["Nailed the landing.", "Thanks for the lift.", "Smooth.", "Ten out of ten."]));
  }
  drag.top = 0;
}
function airStep(dt) {
  if (me.st === "held") {
    if (performance.now() - drag.lt > 60) { drag.vx *= 0.8; drag.vy *= 0.8; }
  } else {
    const g = ground();
    drag.vy += 2600 * dt; drag.vx *= 1 - 0.5 * dt;
    drag.x += drag.vx * dt; drag.y += drag.vy * dt;
    const maxX = innerWidth - GW * S;
    if (drag.x < 0) { drag.x = 0; drag.vx = -drag.vx * 0.5; sfx("thud"); }
    else if (drag.x > maxX) { drag.x = maxX; drag.vx = -drag.vx * 0.5; sfx("thud"); }
    if (drag.y >= g) {
      drag.y = g;
      if (drag.vy > 1100 && !drag.bounced) { drag.bounced = true; drag.vy = -drag.vy * 0.28; drag.vx *= 0.5; sfx("thud"); }
      else { land(drag.vy); return; }
    }
  }
  // swing like a pendulum from the grip: lean against the direction of travel
  const want = clamp(-drag.vx * 0.025, -40, 40) * (me.st === "held" ? 1 : 0.5);
  drag.tilt += (want - drag.tilt) * Math.min(1, dt * 10);
}
function drawHeld() {
  if (hc.hidden) return;
  const held = me.st === "held";
  const o = { pose: held ? "held" : "flail", f: F(held ? 0.18 : 0.08), dir: me.dir, shut: held && me.blink < 0, mouth: me.talk > 0 ? (F(0.12) % 2 ? 1 : 3) : held ? 0 : 3 };
  hctx.clearRect(0, 0, GW, GH);
  const g = build(o);
  for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) { const c = g[j * GW + i]; if (c) { hctx.fillStyle = c; hctx.fillRect(i, j, 1, 1); } }
  hc.style.transform = `translate(${Math.round(drag.x)}px, ${Math.round(drag.y)}px) rotate(${reduce ? 0 : drag.tilt.toFixed(1)}deg)`;
}

/* ---------- loop ---------- */
const F = (sec) => (reduce ? 0 : Math.floor(now / sec));
function update(dt) {
  now += dt; me.t += dt;
  const idle = (performance.now() - lastInput) / 1000;
  if (!reduce) { me.blink -= dt; if (me.blink < -0.13) me.blink = R(2.5, 5); }
  if (me.talk > 0) me.talk -= dt;
  if (air()) { airStep(dt); dirty = true; }
  const duck = !air() && me.st !== "off" && me.st !== "pose" && !tour && !delivering && !me.carry && (say.hidden || say.classList.contains("think")) && covered();
  const goal = duck ? 1 : 0;
  if (goal && duckedAt < 0) duckedAt = now;
  if (!goal && duckedAt >= 0) { if (now - duckedAt > 8 && me.st === "stand" && Math.random() < 0.4) react("phew"); duckedAt = -1; }
  if (me.sink !== goal) { me.sink = reduce ? goal : goal > me.sink ? Math.min(1, me.sink + dt * 4) : Math.max(0, me.sink - dt * 2.5); dirty = true; }
  switch (me.st) {
    case "walk": {
      const d = me.tx - me.x;
      if (reduce || Math.abs(d) < 0.6) { me.x = me.tx; me.carry = false; finish(); break; }
      me.dir = Math.sign(d);
      const sp = me.carry ? Math.max(60, Math.abs(d) / 3) : tour ? Math.max(70, Math.abs(d) / 1.5) : 30;
      me.x += me.dir * Math.min(Math.abs(d), sp * dt);
      if (me.t > me.dur) { me.carry = false; finish(); }
      break;
    }
    case "stand":
      if (now - ptr.seen < 2 && Math.abs(ptr.x - me.x) > 6) me.dir = Math.sign(ptr.x - me.x);
      if (tour || delivering) break;
      if (music.on && me.t > 1.5) { setSt("dance", R(10, 18)); break; }
      if (idle > 20 || me.t > 60) { setSt("sit", 0.6); break; }
      if (me.t > me.dur) {
        if (!settings.meQuiet && say.hidden && !ducked() && now - lastTip > 75 && Math.random() < 0.25) { lastTip = now; const [ps, txt] = pick(TIPS); pose(ps, 3, backToIdle); speak(txt); break; }
        if (!ptr.inWin && !ducked() && Math.random() < 0.55) walkTo(R(24, Math.max(48, CW * 0.55)));
        else me.dur = me.t + R(5, 10);
      }
      break;
    case "dance": if ((!music.on && !me.party) || me.t > me.dur) { me.party = false; backToIdle(); } break;
    case "pose":
      if (me.y > 0 || me.vy > 0) { me.vy -= 170 * dt; me.y = Math.max(0, me.y + me.vy * dt); if (!me.y) me.vy = 0; }
      if (me.t > me.dur) finish();
      break;
    case "sit": if (me.t > me.dur) setSt("open", 1); break;
    case "open": if (me.t > me.dur) { setSt("code", 0); me.sub = R(8, 16); } break;
    case "code": {
      const typing = me.t % 4.5 < 3.3;
      if (typing && !reduce && !ducked() && (me.spawn -= dt) < 0) { me.spawn = R(0.3, 0.55); parts.push({ k: CODE[(Math.random() * CODE.length) | 0], x: me.x + R(-6, 3), y: CH - 22, t: 0, c: CODE_C }); }
      if (typing && (lineT += dt) > 3) { lineT = 0; bump("lines"); }
      if (idle > 150) { setSt("close", 1); break; }
      if (me.t > me.sub && !tour) {
        if (Math.random() < 0.45) { setSt("sip", 2.6); bump("coffees"); }
        else { setSt("think", 3.4); if (!settings.meQuiet && say.hidden && !ducked()) speak(pick(THOUGHTS), { think: true, ms: 3200 }); }
      }
      break;
    }
    case "sip": case "think": if (me.t > me.dur) { setSt("code", 0); me.sub = R(8, 16); } break;
    case "close": if (me.t > me.dur) { setSt("nap", 0); bump("naps"); } break;
    case "nap": if (!reduce && !ducked() && (me.spawn -= dt) < 0) { me.spawn = 1.4; parts.push({ k: "Z", x: me.x + me.dir * 6, y: CH - 32, t: 0, c: "#ffffff" }); } break;
    case "wake": case "rise": if (me.t > me.dur) finish(); break;
  }
  if (music.on && me.st === "dance" && !reduce && !ducked() && Math.random() < dt * 0.8) parts.push({ k: "N", x: me.x + me.dir * R(4, 10), y: CH - 40, t: 0, c: "#ffffff" });
  if (!reduce && !ducked() && ["code", "think"].includes(me.st) && Math.random() < dt * 2) parts.push({ k: "steam", x: me.x + me.dir * 12, y: CH - 10, t: 0 });
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i]; p.t += dt;
    if (p.k === "env") { p.vy += 140 * dt; p.y += p.vy * dt; if (p.y > CH + 4) parts.splice(i, 1); continue; }
    if (p.k === "star") { p.a += dt * 5; if (p.t > 2.6) parts.splice(i, 1); continue; }
    p.y -= (p.k === "steam" ? 5 : 8) * dt; p.x += Math.sin(p.t * 3 + i) * 0.12;
    if (p.t > (p.k === "steam" ? 1.2 : 2)) parts.splice(i, 1);
  }
}

function opts() {
  const st = me.st;
  if (st === "off" || air()) return null;
  const o = { pose: "stand", f: 0, dir: me.dir, look: 0, shut: me.blink < 0, mouth: me.smile > now ? 2 : 0 };
  if (me.talk > 0) o.mouth = reduce || F(0.12) % 2 ? 1 : 0;
  switch (st) {
    case "walk": o.pose = me.carry ? "carry" : "walk"; o.f = F(me.carry ? 0.09 : 0.14); if (me.carry) o.lift = [1, 0, 2, 0][o.f % 4]; o.look = 1; break;
    case "stand": o.look = now - ptr.seen < 2 ? 1 : 0; break;
    case "dance": o.pose = "dance"; o.f = reduce ? 0 : Math.floor((now * music.bpm) / 60); o.bob = o.f % 2; if (!me.talk) o.mouth = 2; break;
    case "pose": o.pose = me.pose; o.f = F(0.25); if (me.pose === "wave" && me.talk <= 0) o.mouth = 2; if (me.pose === "facepalm") o.frown = true; break;
    case "sit": case "rise": o.pose = "sit"; o.lid = 0; o.mug = true; break;
    case "open": o.pose = "sit"; o.lid = clamp(Math.round((me.t / me.dur) * 7), 1, 7); o.mug = true; break;
    case "close": o.pose = "sit"; o.lid = clamp(7 - Math.round((me.t / me.dur) * 7), 0, 7); o.mug = true; break;
    case "code": o.pose = "laptop"; o.f = me.t % 4.5 < 3.3 ? F(0.12) : 0; o.mug = true; o.lid = 7; if (me.lookUp > now) o.lookY = 0; break;
    case "think": o.pose = "think"; o.look = 1; o.mug = true; o.lid = 7; break;
    case "sip": o.pose = "sip"; o.lid = 7; o.shut = true; break;
    case "nap": o.pose = "nap"; o.lid = 0; o.mug = true; break;
    case "wake": o.pose = "sit"; o.lid = 0; o.mug = true; break;
  }
  return o;
}
function glyph(map, x, y, c) {
  map.forEach((r, j) => { for (let i = 0; i < r.length; i++) if (r[i] === "#") { px(ctx, x + i + 1, y + j + 1, K); } });
  map.forEach((r, j) => { for (let i = 0; i < r.length; i++) if (r[i] === "#") px(ctx, x + i, y + j, c); });
}
function draw() {
  if (!ctx) return;
  const o = opts(), key = JSON.stringify(o) + Math.round(me.x) + "," + Math.round(me.y - sinkPx());
  if (!dirty && !parts.length && key === lastKey) return;
  dirty = false; lastKey = key;
  ctx.clearRect(0, 0, CW, CH);
  if (o) {
    const g = build(o), x0 = Math.round(me.x) - GW / 2, top = CH - GH - Math.round(me.y - sinkPx());
    for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) { const c = g[j * GW + i]; if (c) { ctx.fillStyle = c; ctx.fillRect(x0 + i, top + j, 1, 1); } }
  }
  for (const p of parts) {
    const x = Math.round(p.x), y = Math.round(p.y);
    if (p.k === "steam") { if (p.t < 1) px(ctx, x, y, "rgba(230,234,244,.75)"); continue; }
    if (p.k === "star") {
      const sx = Math.round(me.x + Math.cos(p.a) * 8), sy = Math.round(CH - GH + 5 - me.y + Math.sin(p.a) * 2.5);
      px(ctx, sx - 1, sy, K, 3, 1); px(ctx, sx, sy - 1, K, 1, 3); px(ctx, sx, sy, "#f7c437");
      continue;
    }
    if (p.k === "env") { px(ctx, x - 1, y - 1, K, 9, 7); px(ctx, x, y, "#ffffff", 7, 5); for (let i = 0; i < 4; i++) { px(ctx, x + i, y + Math.round(i * 0.6), "#b9bfcc"); px(ctx, x + 6 - i, y + Math.round(i * 0.6), "#b9bfcc"); } px(ctx, x + 3, y + 2, "#e2504c"); continue; }
    if (p.t > 1.6 && Math.floor(p.t * 10) % 2) continue;
    glyph(GLYPH[p.k], x, y, p.c);
  }
  if (air()) {
    // a shadow on the taskbar under him, smaller the higher he is
    const sx = (drag.x + GRIP_X * S) / S, up = Math.max(0, ground() - drag.y) / S, w = Math.round(clamp(14 - up / 10, 4, 14));
    px(ctx, Math.round(sx - w / 2), CH - 2, "rgba(14,18,54,.28)", w, 2);
    drawHeld();
    if (!say.hidden) {
      const pr = pet.getBoundingClientRect(), w2 = say.offsetWidth, cx = drag.x + GRIP_X * S, left = clamp(cx - 46, 6, Math.max(6, innerWidth - w2 - 6));
      say.style.left = left + "px";
      say.style.bottom = Math.min(pr.bottom - drag.y + 8, pr.bottom - say.offsetHeight - 8) + "px";
      say.style.setProperty("--tail", clamp(cx - left - 6, 12, w2 - 26) + "px");
    }
    return;
  }
  const seated = SEATED.has(me.st), headTop = CH - GH + 4 + (seated ? 7 : 0) - me.y + sinkPx();
  hit.style.transform = `translate(${(me.x - 9) * S}px, ${headTop * S}px)`;
  hit.style.height = (CH - headTop) * S + "px";
  hit.hidden = !o;
  if (!say.hidden) {
    const w = say.offsetWidth, cx = me.x * S, left = clamp(cx - 46, 6, Math.max(6, innerWidth - w - 6));
    say.style.left = left + "px";
    say.style.bottom = (CH - headTop + 5) * S + "px";
    say.style.setProperty("--tail", clamp(cx - left - 6, 12, w - 26) + "px");
  }
}
function loop() {
  let last = performance.now();
  const step = (t) => {
    raf = requestAnimationFrame(step);
    if (document.hidden) { last = t; return; }
    if (t - last < 33) return;
    update(Math.min(0.1, (t - last) / 1000)); last = t;
    draw();
  };
  raf = requestAnimationFrame(step);
}

/* ---------- setup ---------- */
function size() {
  S = small() ? 2 : 3;
  CW = Math.ceil((innerWidth || 1280) / S);
  cv.width = CW; cv.height = CH;
  cv.style.width = CW * S + "px"; cv.style.height = CH * S + "px";
  pet.style.height = CH * S + "px";
  hit.style.width = 18 * S + "px";
  hc.style.width = GW * S + "px"; hc.style.height = GH * S + "px"; hc.style.transformOrigin = `${GRIP_X * S}px ${GRIP_Y * S}px`;
  me.x = me.st === "off" ? me.x : clamp(me.x, 10, CW - 10);
  dirty = true;
}
function start() {
  if (running || performance.now() < hiddenUntil) return;
  running = true; pet.hidden = false;
  size(); draw(); loop();
  bus.emit("me:status", meStatus());
}
function stop() {
  if (tour) { tour = null; clearHi(); removeEventListener("keydown", tourKey, true); }
  if (drag.on) { drag.on = false; document.documentElement.classList.remove("me-dragging"); }
  if (hc) hc.hidden = true;
  running = false; cancelAnimationFrame(raf);
  hush(false); pet.hidden = true;
  setSt("off", 0);
  bus.emit("me:status", meStatus());
}

export function initMe() {
  cv = h("canvas", { class: "px", "aria-hidden": "true" });
  ctx = cv.getContext("2d");
  hit = h("button", { type: "button", class: "pet-hit", "aria-label": "Pixel Rohan. Click to say hi, drag to pick me up, right-click for more." });
  sayTxt = h("span"); sayBtns = h("div", { class: "me-btns", hidden: true });
  say = h("div", { class: "me-say", hidden: true }, sayTxt, sayBtns);
  live = h("span", { class: "sr", "aria-live": "polite" });
  pet = h("div", { class: "pet me", hidden: true }, h("div", { class: "pet-clip" }, cv), hit, say, live);
  hc = h("canvas", { class: "px me-held", width: String(GW), height: String(GH), "aria-hidden": "true", hidden: true });
  hctx = hc.getContext("2d");
  document.body.append(pet, hc);

  // press and drag to pick him up; a plain click still says hi
  hit.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || !running || me.st === "off" || air()) return;
    drag.down = { x: e.clientX, y: e.clientY, id: e.pointerId };
  });
  addEventListener("pointermove", (e) => {
    if (drag.on) { moveHeld(e); return; }
    if (drag.down && e.pointerId === drag.down.id && Math.hypot(e.clientX - drag.down.x, e.clientY - drag.down.y) > 6) { drag.down = null; pickUp(e); }
  });
  const up = (e) => { drag.down = null; if (drag.on) { letGo(e.type === "pointerup" ? e : null); setTimeout(() => (drag.eat = false), 0); } };
  addEventListener("pointerup", up);
  addEventListener("pointercancel", up);
  addEventListener("blur", () => up({ type: "blur" }));
  addEventListener("keydown", (e) => { if (e.key === "Escape" && drag.on) { e.preventDefault(); e.stopPropagation(); up({ type: "key" }); } }, true);
  hit.addEventListener("click", (e) => { if (drag.eat) { drag.eat = false; return; } hello(); });
  hit.addEventListener("contextmenu", (e) => { e.preventDefault(); e.stopPropagation(); if (!drag.on && !air()) menu(e.clientX, e.clientY); });
  hit.addEventListener("keydown", (e) => {
    if (e.key === "ContextMenu" || (e.key === "F10" && e.shiftKey)) { e.preventDefault(); const r = hit.getBoundingClientRect(); menu(r.left + r.width / 2, r.top); }
  });
  hit.addEventListener("pointerenter", () => {
    me.smile = now + 2.5; dirty = true;
    clearTimeout(hoverT);
    hoverT = setTimeout(() => {
      if (drag.on || !say.hidden || settings.meQuiet || (cool.hover && now - cool.hover < 90)) return;
      cool.hover = now; speak(pick(["Can I help you?", "You're staring. I can tell.", "Go on, click me.", "Right-click me. There's a menu."]));
    }, 2600);
  });
  hit.addEventListener("pointerleave", () => clearTimeout(hoverT));
  say.addEventListener("click", (e) => { if (!e.target.closest("button")) hush(); });

  const poke = () => { lastInput = performance.now(); if (running && me.st === "nap") wake(); };
  for (const ev of ["pointerdown", "keydown", "wheel"]) addEventListener(ev, poke, { capture: true, passive: true });
  addEventListener("pointermove", (e) => {
    poke();
    if (!running || e.pointerType !== "mouse") return;
    ptr.inWin = !!e.target.closest?.(".win");
    const bottom = pet.getBoundingClientRect().bottom;
    if (ptr.inWin || e.clientY < bottom - 260 || e.clientY > bottom) return;
    ptr.x = e.clientX / S; ptr.seen = now;
  }, { passive: true });
  addEventListener("resize", () => { if (running) { size(); draw(); } });
  addEventListener("error", () => react("bug"));
  addEventListener("unhandledrejection", () => react("bug"));

  const openWins = () => winList().filter((w) => !w.min && !w.modal).length;
  bus.on("win:open", (w) => {
    const n = openWins(); peakWins = Math.max(peakWins, n);
    const k = n >= 6 ? "crowd" : keyFor(w);
    if (k) setTimeout(() => react(k), 400);
  });
  bus.on("win:close", () => { if (peakWins >= 3 && !openWins()) { peakWins = 0; setTimeout(() => react("tidy"), 300); } });
  bus.on("win:resize", (w) => { if (w.max) setTimeout(() => react("max"), 300); });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) hiddenAt = performance.now();
    else if (hiddenAt && performance.now() - hiddenAt > 45000) { hiddenAt = 0; setTimeout(() => react("back"), 600); }
  });
  addEventListener("offline", () => react("offline"));
  addEventListener("online", () => react("online"));
  document.addEventListener("copy", (e) => { if (!e.target.closest?.("input, textarea")) react("copy"); });
  const CODE_KEYS = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"];
  addEventListener("keydown", (e) => {
    konami = e.key === CODE_KEYS[konami] ? konami + 1 : e.key === CODE_KEYS[0] ? 1 : 0;
    if (konami === CODE_KEYS.length) { konami = 0; react("konami"); }
  });
  setTimeout(() => react("long"), 600000);
  bus.on("msgbox", (m) => { if (m.icon === "error") react("error"); });
  bus.on("music", (m) => { music.on = !!m.playing; music.bpm = m.bpm || 110; if (m.playing) react("music"); });
  bus.on("mines:lose", () => { if (!react("mines:lose") && running && !SEATED.has(me.st) && me.st !== "off") pose("startle", 1.2, backToIdle); });
  bus.on("mines:win", () => react("mines:win"));
  bus.on("shell:shutdown", () => react("shutdown"));
  bus.on("me:react", (k) => react(k));
  bus.on("me:call", () => callMe());
  bus.on("me:tour", () => startTour());
  bus.on("me:menu", ({ x, y }) => (running ? menu(x, y) : setSettings({ me: true })));
  bus.on("me:deliver", deliver);
  bus.on("shell:ready", () => { if (running && me.st === "off") arrive(false); });
  bus.on("settings", (p) => {
    if ("me" in p) { if (settings.me) { start(); if (running && me.st === "off") arrive(true); } else stop(); }
    if ("wallpaper" in p) react("wallpaper");
    if ("meQuiet" in p && settings.meQuiet) hush(false);
  });

  if (settings.me) start();
}
