// System sounds, synthesized. Nothing plays until the visitor has clicked or pressed a key (browser rule).
import { settings, bus } from "./core.js";

let ac = null, master = null, noiseBuf = null;
const level = () => (settings.sound ? settings.volume : 0);

export function audio() {
  if (!ac) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ac = new AC();
    master = ac.createGain();
    master.gain.value = level();
    master.connect(ac.destination);
  }
  return ac;
}
export const output = () => (audio(), master);
export const ready = () => !!ac && ac.state === "running";
export function unlock() {
  if (!audio()) return;
  if (ac.state !== "running") ac.resume().catch(() => {});
}
for (const ev of ["pointerdown", "keydown"]) addEventListener(ev, unlock, { capture: true, passive: true });
bus.on("settings", (p) => { if (master && ("sound" in p || "volume" in p)) master.gain.setTargetAtTime(level(), ac.currentTime, 0.02); });

export function tone(f, d, o = {}) {
  const t0 = ac.currentTime + (o.at || 0);
  const osc = ac.createOscillator(), g = ac.createGain();
  osc.type = o.type || "square";
  osc.frequency.setValueAtTime(f, t0);
  if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t0 + (o.slide || d));
  const a = o.a || 0.005, v = o.vol || 0.12;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(v, t0 + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d);
  osc.connect(g); g.connect(o.dest || master);
  osc.start(t0); osc.stop(t0 + a + d + 0.05);
}
export function noise(d, o = {}) {
  if (!noiseBuf) {
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const ch = noiseBuf.getChannelData(0);
    for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
  }
  const t0 = ac.currentTime + (o.at || 0);
  const src = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
  src.buffer = noiseBuf;
  f.type = o.filter || "lowpass"; f.frequency.setValueAtTime(o.f || 1200, t0);
  if (o.fTo) f.frequency.exponentialRampToValueAtTime(o.fTo, t0 + d);
  f.Q.value = o.q || 0.8;
  g.gain.setValueAtTime(o.vol || 0.2, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
  src.connect(f); f.connect(g); g.connect(master);
  src.start(t0, Math.random() * 0.5); src.stop(t0 + d + 0.05);
}
export const NOTE = (n) => 440 * 2 ** ((n - 69) / 12);

const SFX = {
  startup() {
    [60, 64, 67, 72, 76].forEach((n, i) => tone(NOTE(n), 1.3 - i * 0.12, { type: "triangle", vol: 0.13, at: i * 0.11, a: 0.02 }));
    [48, 55].forEach((n) => tone(NOTE(n), 1.8, { type: "sine", vol: 0.1, at: 0.45, a: 0.25 }));
    tone(NOTE(84), 0.9, { type: "sine", vol: 0.05, at: 0.6, a: 0.05 });
  },
  shutdown() { [76, 72, 67, 60].forEach((n, i) => tone(NOTE(n), 0.7, { type: "triangle", vol: 0.12, at: i * 0.16, a: 0.02 })); tone(NOTE(48), 1.4, { type: "sine", vol: 0.1, at: 0.5, a: 0.1 }); },
  open() { tone(520, 0.07, { to: 880, vol: 0.05, type: "square" }); },
  close() { tone(700, 0.07, { to: 380, vol: 0.05, type: "square" }); },
  min() { tone(800, 0.12, { to: 260, vol: 0.05, type: "triangle" }); },
  max() { tone(300, 0.12, { to: 900, vol: 0.05, type: "triangle" }); },
  menu() { noise(0.02, { f: 3000, vol: 0.06, filter: "highpass" }); },
  click() { tone(1800, 0.015, { vol: 0.04, type: "square" }); },
  ding() { tone(NOTE(81), 0.7, { type: "sine", vol: 0.16 }); tone(NOTE(88), 0.5, { type: "sine", vol: 0.06 }); },
  error() { tone(196, 0.13, { vol: 0.1 }); tone(185, 0.18, { vol: 0.1, at: 0.15 }); },
  notify() { tone(NOTE(76), 0.18, { type: "triangle", vol: 0.12 }); tone(NOTE(83), 0.3, { type: "triangle", vol: 0.12, at: 0.12 }); },
  boom() { noise(0.7, { f: 900, fTo: 60, vol: 0.5 }); tone(90, 0.5, { to: 30, type: "sine", vol: 0.3 }); },
  win() { [72, 76, 79, 84, 79, 84].forEach((n, i) => tone(NOTE(n), i === 5 ? 0.6 : 0.12, { vol: 0.08, at: i * 0.1 })); },
  crumple() { for (let i = 0; i < 5; i++) noise(0.05, { f: 2000 + i * 400, vol: 0.12, at: i * 0.045, filter: "bandpass", q: 2 }); },
  meow() {
    const t0 = ac.currentTime, osc = ac.createOscillator(), f = ac.createBiquadFilter(), g = ac.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(520, t0); osc.frequency.linearRampToValueAtTime(860, t0 + 0.14); osc.frequency.linearRampToValueAtTime(480, t0 + 0.42);
    f.type = "bandpass"; f.Q.value = 3; f.frequency.setValueAtTime(900, t0); f.frequency.linearRampToValueAtTime(1800, t0 + 0.15); f.frequency.linearRampToValueAtTime(700, t0 + 0.42);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.22, t0 + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.45);
    osc.connect(f); f.connect(g); g.connect(master); osc.start(t0); osc.stop(t0 + 0.5);
  },
  purr() {
    const t0 = ac.currentTime, src = ac.createOscillator(), lfo = ac.createOscillator(), lg = ac.createGain(), g = ac.createGain(), f = ac.createBiquadFilter();
    src.type = "sawtooth"; src.frequency.value = 52; lfo.frequency.value = 24; lg.gain.value = 0.08;
    f.type = "lowpass"; f.frequency.value = 320;
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.1, t0 + 0.2); g.gain.setValueAtTime(0.1, t0 + 1); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.4);
    lfo.connect(lg); lg.connect(g.gain); src.connect(f); f.connect(g); g.connect(master);
    src.start(t0); lfo.start(t0); src.stop(t0 + 1.5); lfo.stop(t0 + 1.5);
  },
  type() { tone(1200 + Math.random() * 400, 0.01, { vol: 0.025, type: "square" }); },
  // "You've got mail!": a bright four-note chiptune jingle
  mail() { [[72, 0], [76, 0.09], [79, 0.18], [84, 0.3]].forEach(([n, at], i) => { tone(NOTE(n), i === 3 ? 0.45 : 0.1, { vol: 0.07, at }); tone(NOTE(n + 12), i === 3 ? 0.3 : 0.06, { type: "triangle", vol: 0.04, at }); }); tone(NOTE(48), 0.5, { type: "triangle", vol: 0.08, at: 0.3 }); },
  pop() { tone(300, 0.06, { to: 1200, vol: 0.08, type: "sine" }); },
  lift() { tone(260, 0.12, { to: 620, vol: 0.07, type: "square" }); },
  whee() { tone(900, 0.5, { to: 240, slide: 0.5, vol: 0.05, type: "triangle" }); },
  thud() { tone(140, 0.14, { to: 50, vol: 0.2, type: "sine" }); noise(0.06, { f: 400, vol: 0.12, filter: "lowpass", q: 1 }); },
  bonk() { tone(110, 0.1, { to: 45, vol: 0.22, type: "sine" }); noise(0.08, { f: 300, vol: 0.16, filter: "lowpass", q: 1 }); [0.12, 0.2, 0.28].forEach((at, i) => tone(1800 - i * 200, 0.05, { vol: 0.035, at, type: "sine" })); },
};

export function sfx(name) {
  if (!ready() || !settings.sound) return;
  try { SFX[name] && SFX[name](); } catch (e) {}
}
