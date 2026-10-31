// Tunes: a chiptune player. Three original tracks, sequenced live through Web Audio. Rohan dances while it plays.
import { h, bus, store, onTick, reduce, announce } from "../core.js";
import { iconState } from "../px.js";
import { openWindow, msgbox } from "../wm.js";
import { audio, output } from "../sound.js";
import { launch } from "./index.js";

// Tokens are 16th notes: a note starts it, "-" holds the one before, "." rests.
const TRACKS = [
  { title: "Boot Sequence", bpm: 128, lead: "square", chords: ["Am", "F", "C", "G"],
    A: ["A4 - C5 - E5 - A5 - G5 - E5 - C5 - D5 -", "C5 - F5 - A5 - - - G5 - F5 - E5 - C5 -", "E5 - G5 - C6 - - - B5 - G5 - E5 - G5 -", "D5 - G5 - B5 - - - A5 - G5 - F#5 - D5 -"],
    B: ["A5 - - - E5 - A5 - C6 - B5 - A5 - E5 -", "F5 - - - C5 - F5 - A5 - G5 - F5 - C5 -", "G5 - - - E5 - G5 - C6 - D6 - E6 - - -", "D6 - - - B5 - - - G5 - - - . . . ."],
    kick: "x...x...x...x...", snare: "....x.......x...", hat: "x.x.x.x.x.x.x.x.", bass: "R.RoR.RoR.RoR.Ro" },
  { title: "Night Shift", bpm: 96, lead: "triangle", chords: ["Dm", "Bb", "C", "A"],
    A: ["D5 - - - F5 - A5 - - - G5 - F5 - E5 -", "D5 - - - - - . . F5 - D5 - Bb4 - C5 -", "E5 - - - G5 - C6 - - - Bb5 - A5 - G5 -", "A5 - - - - - - - C#5 - E5 - G5 - - -"],
    B: ["F5 - E5 - D5 - - - A4 - D5 - F5 - - -", "F5 - - - D5 - - - Bb4 - D5 - F5 - G5 -", "G5 - - - E5 - - - C5 - E5 - G5 - Bb5 -", "A5 - - - - - - - - - - - . . . ."],
    kick: "x.....x...x.....", snare: "....x.......x...", hat: "..x...x...x...x.", bass: "R...R.o.R...R.o." },
  { title: "Ship It!", bpm: 150, lead: "pulse", chords: ["C", "G", "Am", "F"],
    A: ["C5 . E5 . G5 . C6 . . . G5 . E5 . G5 .", "D5 . G5 . B5 . D6 . . . B5 . G5 . B5 .", "C6 . B5 . A5 . E5 . . . A5 . C6 . E6 .", "D6 - C6 - A5 - F5 - G5 - A5 - B5 - - -"],
    B: ["E6 - - - D6 - C6 - - - G5 - - - . .", "D6 - - - C6 - B5 - - - G5 - - - . .", "C6 - B5 - A5 - G5 - A5 - B5 - C6 - E6 -", "F6 - - - E6 - - - D6 - - - C6 - - -"],
    kick: "x...x...x...x...", snare: "....x.......x.x.", hat: "xxxxxxxxxxxxxxxx", bass: "R.o.R.o.R.o.R.o." },
];
const SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const midi = (s) => { const m = /^([A-G])([#b]?)(\d)$/.exec(s); return m ? 12 * (+m[3] + 1) + SEMI[m[1]] + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0) : null; };
const freq = (n) => 440 * 2 ** ((n - 69) / 12);
const chordNotes = (name, oct) => { const root = midi(name.replace("m", "") + oct), minor = /m$/.test(name); return [root, root + (minor ? 3 : 4), root + 7]; };
const toks = (bar) => { const t = bar.trim().split(/\s+/); while (t.length < 16) t.push("."); return t.slice(0, 16); };
// song form: intro (no lead), A, B, A, B
for (const T of TRACKS) {
  T.form = [[null, 0], [null, 1], [null, 2], [null, 3], ...[0, 1, 2, 3].map((i) => ["A", i]), ...[0, 1, 2, 3].map((i) => ["B", i]), ...[0, 1, 2, 3].map((i) => ["A", i]), ...[0, 1, 2, 3].map((i) => ["B", i])];
  T.steps = T.form.length * 16; T.sd = 60 / T.bpm / 4; T.len = T.steps * T.sd;
}
const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

// ── the engine (one per page, so it keeps playing while the window is minimized)
const P = { idx: store.get("tunesTrack", 0) % TRACKS.length, step: 0, playing: false, next: 0, iv: 0, bus: null, an: null, pulse: null, noise: null, vol: store.get("tunesVol", 0.8), repeat: store.get("tunesRepeat", "all"), listeners: new Set() };
const emit = () => { const T = TRACKS[P.idx]; iconState.playing = P.playing; bus.emit("music", { playing: P.playing, title: T.title, bpm: T.bpm }); P.listeners.forEach((f) => f()); };
function graph() {
  const ac = audio(); if (!ac) return null;
  if (!P.bus) {
    P.bus = ac.createGain(); P.bus.gain.value = P.vol * 0.55;
    P.an = ac.createAnalyser(); P.an.fftSize = 128; P.an.smoothingTimeConstant = 0.6;
    P.bus.connect(P.an); P.an.connect(output());
    const n = 32, re = new Float32Array(n), im = new Float32Array(n);
    for (let k = 1; k < n; k++) im[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * 0.25);
    P.pulse = ac.createPeriodicWave(re, im);
    P.noise = ac.createBuffer(1, ac.sampleRate * 0.5, ac.sampleRate);
    const d = P.noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return ac;
}
function voice(ac, type, f, t, dur, vol, slide) {
  const o = ac.createOscillator(), g = ac.createGain();
  if (type === "pulse") o.setPeriodicWave(P.pulse); else o.type = type;
  o.frequency.setValueAtTime(f, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.006);
  g.gain.setValueAtTime(vol, t + Math.max(0.01, dur - 0.04)); g.gain.linearRampToValueAtTime(0, t + dur);
  o.connect(g).connect(P.bus); o.start(t); o.stop(t + dur + 0.02);
}
function hit(ac, t, kind) {
  if (kind === "kick") { voice(ac, "sine", 150, t, 0.14, 0.9, 38); return; }
  const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain(), d = kind === "hat" ? 0.035 : 0.12;
  s.buffer = P.noise; f.type = kind === "hat" ? "highpass" : "bandpass"; f.frequency.value = kind === "hat" ? 7000 : 1800;
  g.gain.setValueAtTime(kind === "hat" ? 0.12 : 0.45, t); g.gain.exponentialRampToValueAtTime(0.001, t + d);
  s.connect(f).connect(g).connect(P.bus); s.start(t); s.stop(t + d + 0.01);
  if (kind === "snare") voice(ac, "triangle", 190, t, 0.06, 0.3, 120);
}
function playStep(ac, T, st, t) {
  const bar = Math.floor(st / 16), s = st % 16, [sec, ci] = T.form[bar], chord = T.chords[ci];
  const intro = sec === null;
  if (T.kick[s] === "x" && !(intro && bar < 2)) hit(ac, t, "kick");
  if (T.snare[s] === "x" && !intro) hit(ac, t, "snare");
  if (T.hat[s] === "x" && !(intro && bar < 1)) hit(ac, t, "hat");
  const b = T.bass[s];
  if (b !== ".") { const r = chordNotes(chord, 2)[0] + (b === "o" ? 12 : 0); voice(ac, "triangle", freq(r), t, T.sd * 1.8, 0.5); }
  const arp = chordNotes(chord, 4), an = arp[s % 3] + (s % 6 >= 3 ? 12 : 0);
  if (s % 2 === 0 || T.bpm < 120) voice(ac, "pulse", freq(an), t, T.sd * 0.9, intro ? 0.07 : 0.05);
  if (!intro) {
    const tk = toks(T[sec][ci]), n = tk[s];
    if (n !== "." && n !== "-") {
      let len = 1; while (s + len < 16 && tk[s + len] === "-") len++;
      const m = midi(n); if (m) voice(ac, T.lead, freq(m), t, T.sd * len * 0.95, T.lead === "triangle" ? 0.34 : 0.13);
    }
  }
}
function pump() {
  const ac = P.bus && audio(); if (!ac || !P.playing) return;
  const T = TRACKS[P.idx];
  while (P.next < ac.currentTime + 0.15) {
    if (P.step >= T.steps) { end(); return; }
    playStep(ac, T, P.step, P.next);
    P.step++; P.next += T.sd;
  }
}
function end() {
  if (P.repeat === "one") { P.step = 0; return; }
  if (P.repeat === "off" && P.idx === TRACKS.length - 1) { stop(); return; }
  select((P.idx + 1) % TRACKS.length, true);
}
export function play() {
  const ac = graph(); if (!ac) return;
  if (ac.state !== "running") ac.resume().catch(() => {});
  if (P.playing) return;
  P.playing = true; P.next = ac.currentTime + 0.06;
  clearInterval(P.iv); P.iv = setInterval(pump, 25); pump(); emit();
}
export function pause() { if (!P.playing) return; P.playing = false; clearInterval(P.iv); emit(); }
export function stop() { P.playing = false; clearInterval(P.iv); P.step = 0; emit(); }
function select(i, autoplay) {
  P.idx = (i + TRACKS.length) % TRACKS.length; P.step = 0; store.set("tunesTrack", P.idx);
  if (P.playing && P.bus) P.next = audio().currentTime + 0.06;
  if (autoplay && !P.playing) play(); else emit();
  announce(`Track ${P.idx + 1}: ${TRACKS[P.idx].title}`);
}
const pos = () => (P.playing && P.bus ? Math.max(0, P.step * TRACKS[P.idx].sd - (P.next - audio().currentTime)) : P.step * TRACKS[P.idx].sd);
const setVol = (v) => { P.vol = v; store.set("tunesVol", v); if (P.bus) P.bus.gain.setTargetAtTime(v * 0.55, audio().currentTime, 0.03); };

// ── the window
const SVGS = {
  prev: '<path d="M2 2h2v10H2zM5 7h1V6h1V5h1V4h1V3h1V2h1v10h-1v-1H9v-1H8V9H7V8H6V7z"/>',
  play: '<path d="M3 1h2v1h1v1h1v1h1v1h1v1h1v2H9v1H8v1H7v1H6v1H5v1H3z"/>',
  pause: '<path d="M3 2h3v10H3zM8 2h3v10H8z"/>',
  stop: '<path d="M3 3h8v8H3z"/>',
  next: '<path d="M10 2h2v10h-2zM3 2h1v1h1v1h1v1h1v1h1v1H8v1H7v1H6v1H5v1H4v1H3z"/>',
};
const ico = (k) => `<svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" shape-rendering="crispEdges" aria-hidden="true">${SVGS[k]}</svg>`;

export function open(arg, from) {
  const w0 = openWindow({ id: "tunes", title: "Tunes", icon: "tunes", app: "tunes", w: 380, h: 470, minW: 300, minH: 360, from, bodyClass: "", onClose: () => { stop(); P.listeners.delete(sync); }, menubar: menus(), build });
  if (arg === "play") play();
  return w0;

  function menus() {
    return [
      { label: "File", items: () => [{ label: "Close", kbd: "Alt+F4", action: () => w0.close() }] },
      { label: "Play", items: () => [
        { label: P.playing ? "Pause" : "Play", kbd: "Space", action: () => (P.playing ? pause() : play()) },
        { label: "Stop", action: stop },
        { label: "Previous Track", kbd: "Ctrl+←", action: () => select(P.idx - 1, P.playing) },
        { label: "Next Track", kbd: "Ctrl+→", action: () => select(P.idx + 1, P.playing) },
        { sep: true },
        { label: "Repeat", sub: [["off", "Off"], ["all", "All tracks"], ["one", "This track"]].map(([k, l]) => ({ label: l, radio: P.repeat === k, action: () => { P.repeat = k; store.set("tunesRepeat", k); sync(); } })) },
      ] },
      { label: "Help", items: () => [
        { label: "About Tunes", action: () => msgbox({ title: "About Tunes", icon: "tunes", parent: w0, text: "Three original chiptunes by Rohan.\nNo audio files: every note is played live by your browser.\nI dance while it plays." }) },
        { label: "Help Topics", icon: "help", kbd: "F1", action: () => launch("help", "programs") },
      ] },
    ];
  }
  var sync;
  function build(w) {
    const tt = h("div", { class: "tt" }, h("span")), time = h("div", { class: "time", "aria-live": "off" }, "0:00");
    const vis = h("canvas", { class: "px", width: "120", height: "28", "aria-hidden": "true" });
    const meta = h("div", { class: "meta" }), rep = h("div", { class: "meta", style: { textAlign: "right" } });
    const seek = h("input", { type: "range", min: "0", max: "1000", value: "0", "aria-label": "Position", style: { width: "100%" } });
    const btn = (k, label, fn) => h("button", { type: "button", class: "btn", "aria-label": label, "data-tip": label, html: ico(k), onclick: fn });
    const pp = btn("play", "Play", () => (P.playing ? pause() : play()));
    const vol = h("input", { type: "range", min: "0", max: "100", value: String(Math.round(P.vol * 100)), "aria-label": "Volume" });
    vol.addEventListener("input", () => setVol(vol.value / 100));
    let seeking = false;
    seek.addEventListener("input", () => { seeking = true; time.textContent = fmt((seek.value / 1000) * TRACKS[P.idx].len); });
    seek.addEventListener("change", () => { const T = TRACKS[P.idx]; P.step = Math.floor(((seek.value / 1000) * T.steps) / 16) * 16; if (P.playing) P.next = audio().currentTime + 0.05; seeking = false; });
    const list = h("ul", { class: "plist", role: "listbox", tabindex: "0", "aria-label": "Playlist" });
    const items = TRACKS.map((T, i) => {
      const li = h("li", { role: "option", id: "tn-" + i }, h("span", {}, `${i + 1}. ${T.title}`), h("span", { class: "d" }, fmt(T.len)));
      li.addEventListener("click", () => { focusI = i; sync(); });
      li.addEventListener("dblclick", () => select(i, true));
      list.append(li); return li;
    });
    let focusI = P.idx;
    list.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); focusI = (focusI + (e.key === "ArrowDown" ? 1 : -1) + TRACKS.length) % TRACKS.length; sync(); }
      else if (e.key === "Enter") { e.preventDefault(); select(focusI, true); }
    });
    w.body.append(h("div", { class: "tunes" },
      h("div", { class: "lcd" }, tt, time, vis, meta, rep),
      seek,
      h("div", { class: "tctl" }, btn("prev", "Previous track", () => select(P.idx - 1, P.playing)), pp, btn("stop", "Stop", stop), btn("next", "Next track", () => select(P.idx + 1, P.playing)),
        h("span", { "aria-hidden": "true", style: { marginLeft: "8px", fontSize: "var(--fs-sm)" } }, "Vol"), vol),
      list));

    sync = () => {
      const T = TRACKS[P.idx];
      tt.firstChild.textContent = `${P.idx + 1}. ${T.title}  ·  Rohan Ahire`;
      tt.classList.toggle("scroll", P.playing && !reduce);
      meta.textContent = `${T.bpm} BPM · 8-BIT · ${P.playing ? "PLAYING" : P.step ? "PAUSED" : "STOPPED"}`;
      rep.textContent = { off: "", all: "REPEAT ALL", one: "REPEAT ONE" }[P.repeat];
      pp.innerHTML = ico(P.playing ? "pause" : "play"); pp.setAttribute("aria-label", P.playing ? "Pause" : "Play"); pp.dataset.tip = P.playing ? "Pause" : "Play";
      items.forEach((li, i) => { li.classList.toggle("on", i === P.idx); li.setAttribute("aria-selected", String(i === focusI)); li.style.outline = i === focusI && i !== P.idx ? "1px dotted var(--ink)" : ""; });
      list.setAttribute("aria-activedescendant", "tn-" + focusI);
      w.setTitle(P.playing ? `${T.title} - Tunes` : "Tunes");
      draw();
    };
    P.listeners.add(sync);
    const vc = vis.getContext("2d"), bins = new Uint8Array(64), peaks = new Float32Array(20);
    function draw() {
      const T = TRACKS[P.idx], p = pos();
      if (!seeking) { time.textContent = fmt(p); seek.value = String(Math.round((p / T.len) * 1000)); }
      vc.clearRect(0, 0, 120, 28);
      if (P.an && P.playing) P.an.getByteFrequencyData(bins); else bins.fill(0);
      for (let i = 0; i < 20; i++) {
        const v = bins[1 + Math.floor(i * 1.4)] / 255, hgt = Math.round(v * 13) * 2;
        peaks[i] = Math.max(peaks[i] - 1, hgt);
        for (let y = 0; y < hgt; y += 2) { vc.fillStyle = y > 20 ? "#ff5d5d" : y > 13 ? "#f7c437" : "#3fd16b"; vc.fillRect(i * 6, 27 - y, 5, 1); }
        if (peaks[i] > 1) { vc.fillStyle = "#9cffb8"; vc.fillRect(i * 6, 27 - Math.round(peaks[i]), 5, 1); }
      }
    }
    w.on(onTick(() => { if (!w.min && (P.playing || seeking)) draw(); }));
    w.el.addEventListener("keydown", (e) => {
      if (e.target.closest("input")) return;
      if (e.key === " " && !e.target.closest("button")) { e.preventDefault(); P.playing ? pause() : play(); }
      else if ((e.ctrlKey || e.metaKey) && e.key === "ArrowRight") { e.preventDefault(); select(P.idx + 1, P.playing); }
      else if ((e.ctrlKey || e.metaKey) && e.key === "ArrowLeft") { e.preventDefault(); select(P.idx - 1, P.playing); }
    });
    sync();
  }
}
