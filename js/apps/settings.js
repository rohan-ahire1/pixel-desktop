// Control panel in one dialog: Background, Screen Saver, Appearance, Sound and Rohan. OK / Cancel / Apply.
import { h, settings, setSettings, onTick, reduce } from "../core.js";
import { icon } from "../px.js";
import { openWindow, msgbox } from "../wm.js";
import { sfx } from "../sound.js";
import { WALLPAPERS, createScene } from "../wallpaper.js";
import { SCHEMES } from "../theme.js";
import { SAVERS, saverScene, previewSaver } from "../boot.js";
import { meStats, meStatus, meRunning, callMe, startTour, meCode, meBreak } from "../me.js";
import { pixelate } from "../desktop.js";
import { launch } from "./index.js";

const TABS = [
  { id: "background", label: "Background" },
  { id: "saver", label: "Screen Saver" },
  { id: "appearance", label: "Appearance" },
  { id: "sound", label: "Sound" },
  { id: "me", label: "Rohan" },
];
const SOUNDS = [["startup", "Start PixelOS"], ["open", "Open program"], ["close", "Close program"], ["min", "Minimize"], ["max", "Maximize"], ["menu", "Menu popup"], ["ding", "Default beep"], ["error", "Critical stop"], ["notify", "Notification"], ["crumple", "Empty Recycle Bin"], ["mail", "You've got mail"], ["shutdown", "Shut down"]];

// A keyboard-friendly single-select list box.
function listbox(items, value, onPick, label) {
  const ul = h("ul", { class: "lbox", role: "listbox", tabindex: "0", "aria-label": label });
  let cur = value;
  const draw = () => {
    ul.replaceChildren(...items().map((it) => {
      const li = h("li", { role: "option", "aria-selected": String(it.id === cur), "aria-disabled": it.disabled ? "true" : null, class: it.disabled ? "dis" : null, "data-id": it.id }, it.icon ? icon(it.icon, { size: 16, scale: 1, still: true }) : null, it.label);
      li.addEventListener("click", () => !it.disabled && pick(it.id));
      return li;
    }));
    ul.setAttribute("aria-activedescendant", "");
  };
  const pick = (id) => { cur = id; draw(); onPick(id); ul.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" }); };
  ul.addEventListener("keydown", (e) => {
    const all = items().filter((x) => !x.disabled), i = all.findIndex((x) => x.id === cur);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); const n = all[Math.max(0, Math.min(all.length - 1, i + (e.key === "ArrowDown" ? 1 : -1)))]; if (n) pick(n.id); }
    if (e.key === "Home") { e.preventDefault(); pick(all[0].id); }
    if (e.key === "End") { e.preventDefault(); pick(all[all.length - 1].id); }
  });
  draw();
  ul.redraw = draw;
  return ul;
}
function monitor() {
  const cv = h("canvas", { width: "190", height: "120", "aria-hidden": "true" });
  return { el: h("div", { class: "monitor", "aria-hidden": "true" }, h("div", { class: "scr" }, cv), h("div", { class: "neck" }), h("div", { class: "foot" })), cv };
}

export function open(tab, from) {
  tab = TABS.some((t) => t.id === tab) ? tab : "background";
  let pend = {};
  const val = (k) => (k in pend ? pend[k] : settings[k]);
  const set = (patch) => { Object.assign(pend, patch); applyBtn.disabled = false; };
  const tabBtns = {}, panels = {};
  let cur = tab;

  const w = openWindow({
    id: "settings", title: "Display Properties", icon: "display", app: "settings", arg: tab, dialog: true, w: 540, from, bodyClass: "dlg",
    onReopen: (w) => tab && w._show && w._show(tab),
    escClose: true,
  });
  if (w._show) return w;
  const applyBtn = h("button", { type: "button", class: "btn", disabled: true, onclick: () => apply() }, "Apply");
  const apply = () => { if (Object.keys(pend).length) setSettings(pend); pend = {}; applyBtn.disabled = true; };
  const tabs = h("div", { class: "tabs", role: "tablist" });
  const stack = h("div", { style: { display: "grid" } });
  const show = (id) => {
    cur = id;
    for (const t of TABS) {
      tabBtns[t.id].setAttribute("aria-selected", String(t.id === id));
      tabBtns[t.id].tabIndex = t.id === id ? 0 : -1;
      panels[t.id].style.visibility = t.id === id ? "" : "hidden";
      panels[t.id].inert = t.id !== id;
    }
    w.setTitle(id === "sound" ? "Sound Properties" : id === "me" ? "Pixel Rohan" : "Display Properties");
    w.setIcon(id === "sound" ? "sound" : id === "me" ? "me" : "display");
    panels[id].refresh?.();
  };
  w._show = (id) => show(id);
  TABS.forEach((t, i) => {
    const b = h("button", { type: "button", class: "tab", role: "tab", id: "st-" + t.id, "aria-controls": "sp-" + t.id, onclick: () => show(t.id) }, t.label);
    b.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      e.preventDefault();
      const n = TABS[(i + (e.key === "ArrowRight" ? 1 : -1) + TABS.length) % TABS.length];
      show(n.id); tabBtns[n.id].focus();
    });
    tabBtns[t.id] = b; tabs.append(b);
    panels[t.id] = h("div", { class: "tabpanel", role: "tabpanel", id: "sp-" + t.id, "aria-labelledby": "st-" + t.id, style: { gridArea: "1 / 1" } });
    stack.append(panels[t.id]);
  });
  w.body.append(h("div", {}, tabs, stack));
  const okBtn = h("button", { type: "button", class: "btn def", onclick: () => { apply(); w.close(); } }, "OK");
  w.body.append(h("div", { class: "btnrow" },
    okBtn,
    h("button", { type: "button", class: "btn", onclick: () => w.close() }, "Cancel"),
    applyBtn));
  w.el.addEventListener("keydown", (e) => { if (e.key === "Enter" && e.target.matches("input[type=checkbox], input[type=radio], .lbox")) { e.preventDefault(); apply(); w.close(); } });

  /* ---------- Background ---------- */
  {
    const p = panels.background, mon = monitor(), scene = createScene(mon.cv);
    const paint = () => scene.render(val("wallpaper"), 120 / 190, val("wallPic"));
    const lb = listbox(() => WALLPAPERS.map((x) => ({ id: x.id, label: x.name, disabled: x.id === "painting" && !val("wallPic") })), val("wallpaper"), (id) => { set({ wallpaper: id }); paint(); }, "Wallpaper");
    const file = h("input", { type: "file", accept: "image/*", hidden: true });
    file.addEventListener("change", async () => {
      const f = file.files[0]; file.value = "";
      if (!f) return;
      try { set({ wallPic: await pixelate(f), wallpaper: "painting" }); lb.redraw(); paint(); }
      catch (e) { msgbox({ title: "Wallpaper", icon: "error", text: "PixelOS couldn't read that picture. Try a PNG or JPEG.", parent: w }); }
    });
    p.append(mon.el,
      h("label", { for: "lb-wall", style: { display: "block", marginBottom: "4px" } }, "Wallpaper"),
      Object.assign(lb, { id: "lb-wall" }),
      h("div", { class: "btnrow", style: { marginTop: "10px", justifyContent: "space-between" } },
        h("span", { style: { fontSize: "13.5px", color: "var(--muted)", alignSelf: "center", maxWidth: "200px" } }, "Pictures turn into 16-colour pixel art."),
        h("span", { class: "btnrow" }, h("button", { type: "button", class: "btn sm", onclick: () => file.click() }, "Browse…"), h("button", { type: "button", class: "btn sm", onclick: () => launch("paint") }, "Paint one…"))),
      file);
    paint();
    if (!reduce) w.on(onTick((t) => { if (cur === "background" && !w.min) scene.draw(t); }));
    p.refresh = () => { lb.redraw(); paint(); };
  }

  /* ---------- Screen Saver ---------- */
  {
    const p = panels.saver, mon = monitor();
    let sc = null;
    const redo = () => { sc = val("saver") === "none" ? null : saverScene(val("saver"), mon.cv, true); if (!sc) { const c = mon.cv.getContext("2d"); mon.cv.width = 190; mon.cv.height = 120; c.fillStyle = "#000"; c.fillRect(0, 0, 190, 120); } };
    const sel = h("select", { class: "field", id: "sv-sel", style: { flex: 1 } }, h("option", { value: "none" }, "(None)"), ...SAVERS.map((s) => h("option", { value: s.id }, s.name)));
    sel.value = val("saver");
    sel.addEventListener("change", () => { set({ saver: sel.value }); redo(); prev.disabled = sel.value === "none"; });
    const wait = h("input", { type: "number", class: "field", id: "sv-wait", min: "1", max: "60", value: String(val("saverWait")), style: { width: "70px" } });
    wait.addEventListener("change", () => { const v = Math.max(1, Math.min(60, Math.round(+wait.value || 3))); wait.value = v; set({ saverWait: v }); });
    const prev = h("button", { type: "button", class: "btn sm", disabled: val("saver") === "none", onclick: () => previewSaver(sel.value) }, "Preview");
    p.append(mon.el,
      h("fieldset", { class: "group" }, h("legend", {}, "Screen Saver"),
        h("div", { class: "lbl-row" }, sel, prev),
        h("div", { class: "lbl-row", style: { marginTop: "10px" } }, h("label", { for: "sv-wait" }, "Wait:"), wait, h("span", {}, "minutes"))));
    redo();
    if (!reduce) w.on(onTick((t) => { if (cur === "saver" && sc && !w.min) sc.draw(t); }));
  }

  /* ---------- Appearance ---------- */
  {
    const p = panels.appearance;
    const prevBox = h("div", { class: "scheme-prev", "aria-hidden": "true" });
    const drawPrev = () => {
      const s = SCHEMES.find((x) => x.id === val("scheme")) || SCHEMES[0];
      prevBox.replaceChildren(
        h("div", { class: "mini" }, h("div", { class: "mt", style: { background: "#7b80a0" } }, "Inactive Window"), h("div", { class: "mb2" })),
        h("div", { class: "mini" }, h("div", { class: "mt", style: { background: s.c[0] } }, "Active Window"), h("div", { class: "mb2" }, "Window text ", h("span", { style: { background: s.c[0] } }, "Selected"))));
    };
    const lb = listbox(() => SCHEMES.map((s) => ({ id: s.id, label: s.name })), val("scheme"), (id) => { set({ scheme: id }); drawPrev(); }, "Color scheme");
    lb.style.maxHeight = "130px";
    const radio = (v, label) => {
      const r = h("input", { type: "radio", name: "isz", value: v, id: "isz-" + v });
      r.checked = val("iconSize") === v;
      r.addEventListener("change", () => set({ iconSize: v }));
      return h("label", { class: "check", for: "isz-" + v }, r, label);
    };
    const wl = h("input", { type: "checkbox", id: "ap-wl" });
    wl.checked = val("welcome") !== false;
    wl.addEventListener("change", () => set({ welcome: wl.checked }));
    p.append(prevBox, h("label", { style: { display: "block", marginBottom: "4px" } }, "Color scheme"), lb,
      h("fieldset", { class: "group", style: { marginTop: "12px" } }, h("legend", {}, "Desktop"),
        h("div", { style: { display: "flex", gap: "18px", flexWrap: "wrap" } }, radio("large", "Large icons"), radio("small", "Small icons")),
        h("label", { class: "check", for: "ap-wl", style: { marginTop: "10px" } }, wl, "Show the Welcome window at startup")));
    drawPrev();
  }

  /* ---------- Sound ---------- */
  {
    const p = panels.sound;
    const on = h("input", { type: "checkbox", id: "snd-on" });
    on.checked = val("sound");
    const vol = h("input", { type: "range", min: "0", max: "100", id: "snd-vol", value: String(Math.round(val("volume") * 100)), style: { flex: 1 } });
    const pct = h("span", { style: { width: "42px", textAlign: "right", fontFamily: "var(--mono)", fontSize: "13px" } }, vol.value + "%");
    // sound changes apply live so you can hear them; Cancel puts them back
    const was = { sound: settings.sound, volume: settings.volume };
    on.addEventListener("change", () => { setSettings({ sound: on.checked }); set({ sound: on.checked }); });
    vol.addEventListener("input", () => { pct.textContent = vol.value + "%"; setSettings({ volume: vol.value / 100 }); set({ volume: vol.value / 100 }); });
    vol.addEventListener("change", () => sfx("ding"));
    let pickS = SOUNDS[0][0];
    const lb = listbox(() => SOUNDS.map(([id, label]) => ({ id, label, icon: "sound" })), pickS, (id) => (pickS = id), "Events");
    lb.addEventListener("dblclick", () => sfx(pickS));
    p.append(
      h("div", { class: "lbl-row", style: { marginBottom: "12px" } }, icon("sound", { size: 32, scale: 1 }), h("label", { class: "check", for: "snd-on" }, on, "Play system sounds")),
      h("fieldset", { class: "group" }, h("legend", {}, "Volume"), h("div", { class: "lbl-row" }, h("label", { for: "snd-vol", class: "sr" }, "Volume"), h("span", {}, "Low"), vol, h("span", {}, "High"), pct)),
      h("div", { style: { marginTop: "12px" } }, h("label", { style: { display: "block", marginBottom: "4px" } }, "Events"), lb),
      h("div", { class: "btnrow", style: { marginTop: "8px" } }, h("button", { type: "button", class: "btn sm", onclick: () => sfx(pickS) }, "▶ Play")));
    let keep = false;
    applyBtn.addEventListener("click", () => Object.assign(was, { sound: settings.sound, volume: settings.volume }));
    okBtn.addEventListener("click", () => (keep = true), { capture: true });
    w.on(() => { if (!keep && (settings.sound !== was.sound || settings.volume !== was.volume)) setSettings(was); });
  }

  /* ---------- Rohan ---------- */
  {
    const p = panels.me;
    const check = (k, id, label) => {
      const c = h("input", { type: "checkbox", id });
      c.checked = val(k) !== false;
      c.addEventListener("change", () => set({ [k]: c.checked }));
      return h("label", { class: "check", for: id }, c, label);
    };
    const grid = h("div", { class: "statgrid", style: { gridTemplateColumns: "auto 1fr auto 1fr", gap: "6px 12px" } });
    const acts = h("div", { class: "btnrow", style: { justifyContent: "flex-start", marginTop: "10px" } });
    const draw = () => {
      const s = meStats();
      const since = s.since ? new Date(s.since).toLocaleDateString([], { dateStyle: "medium" }) : "today";
      grid.replaceChildren(
        h("span", {}, "Right now"), h("b", {}, meStatus().replace(/^./, (c) => c.toUpperCase())),
        h("span", {}, "Mail"), h("span", {}, String(s.mails || 0)),
        h("span", {}, "Lines"), h("span", {}, String(s.lines || 0)),
        h("span", {}, "Coffees"), h("span", {}, String(s.coffees || 0)),
        h("span", {}, "Naps"), h("span", {}, String(s.naps || 0)),
        h("span", {}, "Waves"), h("span", {}, String(s.waves || 0)),
        h("span", {}, "Lifts"), h("span", {}, String(s.lifts || 0)),
        h("span", {}, "Here since"), h("span", {}, since));
      acts.querySelectorAll("button").forEach((b) => (b.disabled = !meRunning()));
    };
    acts.append(
      h("button", { type: "button", class: "btn sm", onclick: () => { callMe(); draw(); } }, "Say hi"),
      h("button", { type: "button", class: "btn sm", onclick: () => { w.close(); startTour(); } }, "Show me around"),
      h("button", { type: "button", class: "btn sm", onclick: () => { meCode(); draw(); } }, "Get to work"),
      h("button", { type: "button", class: "btn sm", onclick: () => { meBreak(); draw(); } }, "Coffee break"));
    p.append(
      h("div", { class: "lbl-row", style: { marginBottom: "12px", alignItems: "flex-start" } }, icon("me", { size: 32, scale: 2 }),
        h("div", {}, h("b", { style: { fontFamily: "var(--display)", fontSize: "18px" } }, "Pixel Rohan"), h("p", { style: { margin: "4px 0 0", fontSize: "15px", lineHeight: 1.35 } }, "That's me on the taskbar. Click to call me, drag to pick me up."))),
      h("fieldset", { class: "group" }, h("legend", {}, "What I've been up to"), grid),
      acts,
      h("fieldset", { class: "group", style: { marginTop: "12px", display: "grid", gap: "6px" } }, h("legend", {}, "Options"),
        check("me", "me-on", "Show me on the taskbar"),
        check("meMail", "me-mail", "Send mail while you look around"),
        check("meVoice", "me-voice", "Say \u201cYou've got mail!\u201d"),
        check("meQuiet", "me-quiet", "Quiet mode (no comments)")));
    draw();
    const iv = setInterval(() => cur === "me" && draw(), 1000);
    w.on(() => clearInterval(iv));
    p.refresh = draw;
  }

  show(tab);
  setTimeout(() => tabBtns[tab].focus(), 0);
  return w;
}
