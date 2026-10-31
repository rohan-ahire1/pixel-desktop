// Plays the films: the boot, the reel and the project clips all run in one black overlay.
// Scenes never touch the page and this file never draws, so either can change alone.
import { h, $, EMAIL, reduce, session, settings, sleep } from "../core.js";
import { ready } from "../sound.js";

const FPS = 30, QUIET = ["Shift", "Control", "Alt", "Meta", "CapsLock"];

function mount(kind, W, H, label, ov = h("div", { class: "overlay" })) {
  const cv = h("canvas", { width: W, height: H, role: "img", "aria-label": label });
  const stage = h("div", { class: "film-stage", style: { aspectRatio: W + " / " + H, width: `min(100vw, ${(W / H) * 100}vh)` } }, cv);
  ov.classList.add("film");
  ov.dataset.film = kind;
  ov.append(stage);
  document.body.append(ov);
  return { ov, stage, c: cv.getContext("2d") };
}
// the canvas text needs the pixel font, but a slow font must not hold the film up
const fonts = () => Promise.race([document.fonts?.load('600 22px "Pixelify Sans"'), sleep(400)]).catch(() => {});

function loop(step) {
  let live = true, prev = performance.now();
  requestAnimationFrame(function tick(now) {
    if (!live) return;
    const dt = Math.max(0, Math.min(0.1, (now - prev) / 1000));
    prev = now;
    step(dt);
    if (live) requestAnimationFrame(tick);
  });
  return () => { live = false; };
}
// any key or click outside the film's own buttons counts; browser shortcuts still work
function listen(ov, onSkip, onTab = (e) => e.preventDefault()) {
  const key = (e) => {
    if (QUIET.includes(e.key) || e.metaKey || e.ctrlKey || e.altKey || /^F\d+$/.test(e.key)) return;
    if (e.key === "Tab") return onTab(e);
    if (e.target.closest?.(".film-ui") && e.key !== "Escape") return;
    e.preventDefault(); e.stopPropagation();
    onSkip(e);
  };
  const press = (e) => { if (!e.target.closest(".film-ui")) onSkip(e); };
  addEventListener("keydown", key, true);
  ov.addEventListener("pointerdown", press);
  return () => { removeEventListener("keydown", key, true); ov.removeEventListener("pointerdown", press); };
}
// true if the visitor skipped while the font was still loading
async function fontsOrSkip(ov) {
  let skipped = false;
  const off = listen(ov, () => { skipped = true; });
  await fonts();
  off();
  return skipped;
}
function pause(ov, ms) {
  return new Promise((done) => {
    const finish = () => { clearTimeout(timer); off(); done(); };
    const timer = setTimeout(finish, ms), off = listen(ov, finish);
  });
}

function soundButton(ov) {
  if (settings.sound === false) return () => false;
  let on = session.get("film-sound") === "1";
  const label = () => (on ? "Sound on" : "Sound off");
  const btn = h("button", { type: "button", class: "film-sound film-ui", onclick: () => { on = !on; session.set("film-sound", on ? "1" : "0"); btn.textContent = label(); } }, label());
  ov.append(btn);
  return () => on;
}

// Resolves when the desktop should appear. The caller owns the overlay and fades it out.
export async function playBoot(ov) {
  const f = await import("./coffee-panic.js");
  const { c } = mount("boot", f.W, f.H, f.LABEL, ov);
  if (await fontsOrSkip(ov)) return;
  document.fonts?.ready.then(f.resetLayers);
  if (reduce) { f.frame(c, f.STILL, true, 0); return pause(ov, 900); }
  const clock = f.startClock(), sound = soundButton(ov);
  return new Promise((done) => {
    let shown = -1;
    const finish = () => { stop(); off(); done(); };
    const off = listen(ov, (e) => {
      if (e.type === "pointerdown" && f.canThrow(clock)) clock.thrown = true;
      else finish();
    });
    const stop = loop((dt) => {
      const was = clock.t;
      f.advance(clock, dt);
      if (sound() && ready()) f.CUES.forEach(([at, play]) => { if (was < at && clock.t >= at) play(); });
      if (clock.t >= f.END) return finish();
      const n = Math.floor(clock.w * FPS);
      if (n !== shown) { shown = n; f.frame(c, clock.t, true, clock.w); }
    });
  });
}

function endCard(stage, replay, close) {
  const link = (label, tone, href) => h("a", { class: "film-btn " + tone, href, target: href.startsWith("mailto") ? null : "_blank", rel: "noopener" }, label);
  const btn = (label, onclick) => h("button", { type: "button", class: "film-btn", onclick }, label);
  const el = h("div", { class: "film-card film-ui", role: "group", "aria-label": "Rohan Ahire. Full-stack engineer, Mumbai. Open to remote (US/EU)." },
    link("Résumé", "gold", "resume.pdf"), link("Email", "blue", "mailto:" + EMAIL), !reduce && btn("Replay", replay), btn("Close", close));
  stage.append(el);
  el.firstChild.focus({ preventScroll: true });
  return el;
}

// Runs the reel's timeline between two points; with a card it stops there until the visitor closes it.
async function cut(kind, range, withCard) {
  if ($(".film")) return;
  const f = await import("./one-cut.js");
  const [from, to] = range(f), back = document.activeElement, s = mount(kind, f.W * f.S, f.H * f.S, f.LABEL);
  const skipped = await fontsOrSkip(s.ov);
  const hint = h("div", { class: "film-hint" }, "Press any key to skip");
  s.ov.append(hint);
  return new Promise((done) => {
    let t = from, shown = -1, card = null, stop = null;
    const paint = () => { const n = Math.floor(t * FPS); if (n !== shown) { shown = n; f.draw(s.c, n / FPS); } };
    const close = () => { stop?.(); off(); s.ov.remove(); if (back?.isConnected) back.focus({ preventScroll: true }); done(); };
    const replay = () => { card.remove(); card = null; t = from; hint.hidden = false; };
    const land = () => { t = Math.max(t, f.LEN); hint.hidden = true; card = endCard(s.stage, replay, close); };
    const tab = (e) => {
      e.preventDefault();
      if (!card) return;
      const all = [...card.querySelectorAll("a, button")], i = all.indexOf(document.activeElement);
      all[(i + (e.shiftKey ? -1 : 1) + all.length) % all.length].focus();
    };
    const off = listen(s.ov, (e) => {
      if (card) { if (e.key === "Escape") close(); }
      else if (withCard) land();
      else close();
    }, tab);
    if (reduce && withCard) { land(); paint(); return; }
    if (skipped && !withCard) return close();
    if (skipped) land();
    stop = loop((dt) => {
      t += dt;
      if (!card && t >= to) { if (!withCard) return close(); land(); }
      paint();
    });
  });
}
export const playReel = () => cut("reel", (f) => [0, f.LEN], true);
export const playClip = (project) => cut("clip", (f) => f.chapter(project));
export const playNext = (project, withCard) => cut("clip", (f) => f.handoff(project), withCard);
