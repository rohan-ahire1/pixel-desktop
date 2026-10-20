// Terminal: a small command line over the pretend file system, with history, tab completion and a few toys.
import { h, bus, store, settings, setSettings, EMAIL, fmtUptime, bootTime, sleep, reduce } from "../core.js";
import { openWindow, list as winList } from "../wm.js";
import { sfx } from "../sound.js";
import * as fs from "../fs.js";
import { PROJECTS, NOW, LINKS, ABOUT } from "../data.js";
import { WALLPAPERS } from "../wallpaper.js";
import { meStats, meStatus, meRunning, meSay, callMe, meCode, meBreak, startTour, hideMe } from "../me.js";
import { launch, openNode, APPS } from "./index.js";

const ver = "PixelOS [Version 1.0.2026]";
const FORTUNES = [
  "Ship it small, ship it soon, then make it good.",
  "The best code is the code you deleted.",
  "A backtest is a story you tell yourself. Trade small.",
  "If it hurts, do it more often. Deploys especially.",
  "Read the error message. Then read it again.",
  "The cat is always right.",
  "Done is a feature.",
  "Measure twice, git commit once.",
];

export function open(arg, from) {
  const out = h("div", { role: "log", "aria-live": "polite", "aria-label": "Terminal output" });
  const prompt = h("span", { class: "p1" });
  const input = h("input", { "aria-label": "Command", autocomplete: "off", autocapitalize: "off", spellcheck: "false", enterkeyhint: "go" });
  const inrow = h("div", { class: "inrow" }, prompt, input);
  const term = h("div", { class: "term" }, out, inrow);
  let cwd = "computer", busy = false, abort = false;
  const hist = store.get("termHist", []);
  let hi = hist.length;

  const w = openWindow({
    id: "terminal-" + Math.random().toString(36).slice(2, 7), posKey: "terminal", title: "Terminal", icon: "terminal", app: "terminal", w: 680, h: 430, minW: 320, minH: 200, from, bodyClass: "",
    menubar: [
      { label: "File", items: () => [{ label: "New Window", kbd: "Ctrl+Shift+N", action: () => launch("terminal") }, { sep: true }, { label: "Close", kbd: "Alt+F4", action: () => w.close() }] },
      { label: "Edit", items: () => [
        { label: "Copy", kbd: "Ctrl+C", disabled: !String(getSelection()).length, action: () => navigator.clipboard?.writeText(String(getSelection())) },
        { label: "Paste", kbd: "Ctrl+V", action: () => navigator.clipboard?.readText().then((t) => { input.value += t.replace(/\n/g, " "); input.focus(); }).catch(() => {}) },
        { sep: true }, { label: "Clear Screen", kbd: "Ctrl+L", action: () => { out.replaceChildren(); input.focus(); } },
      ] },
      { label: "Help", items: () => [{ label: "Commands", action: () => exec("help") }, { label: "Help Topics", icon: "help", kbd: "F1", action: () => launch("help") }] },
    ],
    build(w) { w.body.append(term); },
  });

  const line = (...k) => { const d = h("div", { class: "ln" }, ...k); out.append(d); term.scrollTop = term.scrollHeight; return d; };
  const span = (cls, t) => h("span", { class: cls }, t);
  const link = (url, t) => h("a", { href: url, target: "_blank", rel: "noopener" }, t || url.replace(/^https?:\/\//, ""));
  const path = () => fs.pathOf(cwd);
  const setPrompt = () => { prompt.textContent = path() + ">"; };
  const resolve = (p) => {
    if (!p || p === ".") return cwd;
    if (p === "..") return fs.node(cwd)?.parent || cwd;
    if (p === "~" || p === "/" || p === "\\") return "computer";
    const kid = fs.children(cwd).find((k) => k.name.toLowerCase() === p.toLowerCase() || k.id === p.toLowerCase() || k.name.toLowerCase().replace(/\.\w+$/, "") === p.toLowerCase());
    return kid ? kid.id : fs.resolvePath(p);
  };
  const ago = (s) => (s < 60 ? `${s}s` : s < 3600 ? `${Math.floor(s / 60)}m` : `${Math.floor(s / 3600)}h ${Math.floor(s / 60) % 60}m`);

  const C = {
    help: { d: "List commands", f() {
      const rows = Object.entries(C).filter(([, c]) => c.d).map(([k, c]) => [k, c.d]);
      line(span("hl", "PixelOS commands. Most DOS and Unix names work too.")); line("");
      rows.forEach(([k, d]) => line(span("exe", k.padEnd(11)), d));
      line(""); line(span("dim", "Tab completes names. Up and down walk your history. Ctrl+C stops a running command."));
    } },
    ls: { d: "List what's in this folder", f(a) {
      const id = resolve(a.filter((x) => !x.startsWith("-"))[0]), n = fs.node(id);
      if (!n) return line(span("err", `ls: ${a[0]}: no such file or folder`));
      if (!fs.isFolder(n)) return line(n.name);
      const kids = fs.children(id);
      if (!kids.length) return line(span("dim", "(empty)"));
      const long = a.includes("-l") || a.includes("-la");
      kids.forEach((k) => {
        const kind = fs.isFolder(k) ? span("dir", k.name + "\\") : k.type === "app" || k.type === "project" ? span("exe", k.name) : span("", k.name);
        line(long ? span("dim", fs.typeName(k).padEnd(16) + (fs.fmtSize(fs.sizeOf(k)) || "").padStart(9) + "  ") : "", kind);
      });
      line(span("dim", `${kids.length} item${kids.length === 1 ? "" : "s"}`));
    } },
    cd: { d: "Change folder (cd projects, cd ..)", f(a) {
      if (!a.length) return line(path());
      const id = resolve(a.join(" ")), n = fs.node(id);
      if (!n) return line(span("err", `The system cannot find the path specified: ${a.join(" ")}`));
      if (!fs.isFolder(n)) return line(span("err", `${n.name} is not a folder. Try: open ${n.name}`));
      cwd = id; setPrompt();
    } },
    pwd: { f() { line(path()); } },
    cat: { d: "Print a file (cat about)", f(a) {
      const id = resolve(a.join(" ")) || (a[0] && a[0].toLowerCase().startsWith("about") ? "readme" : null), n = fs.node(id);
      if (!a.length) return line(span("err", "cat: which file? Try: cat about"));
      if (!n) return line(span("err", `cat: ${a.join(" ")}: no such file`));
      if (fs.isFolder(n)) return line(span("err", `cat: ${n.name}: is a folder`));
      if (n.type === "project") { const p = n.project; line(span("hl", `${p.name} · ${p.kind}`)); line(p.blurb); line(span("dim", `${p.year} · ${p.status} · ${p.stack}`)); if (p.live) line(link(p.live)); return; }
      if (n.type === "pic") return line(span("dim", "That's a picture. Opening it in Paint…")), openNode(id);
      if (n.type === "app") return line(span("dim", `${n.name} is a program (${n.app}.exe). Run it with: open ${n.name}`));
      line((n.doc ? n.doc.text : n.text) || span("dim", "(empty file)"));
    } },
    open: { d: "Open anything (open flaggo, open paint)", f(a) {
      const q = a.join(" ");
      if (!q) return line(span("err", "open: open what? Try: open projects"));
      if (APPS.includes(q.toLowerCase())) { line(span("dim", `Starting ${q}…`)); return launch(q.toLowerCase()); }
      const id = resolve(q);
      if (id) { line(span("dim", `Opening ${fs.node(id).name}…`)); return openNode(id); }
      if (/\.\w{2,}/.test(q)) { line(span("dim", `Opening ${q} in the browser…`)); return launch("browser", /^https?:/.test(q) ? q : "https://" + q); }
      line(span("err", `open: can't find '${q}'`));
    } },
    projects: { d: "What I've built", f() {
      PROJECTS.forEach((p) => line(span("exe", p.name.padEnd(13)), p.kind.padEnd(19), span("dim", `${p.year.padEnd(8)} ${p.status}`)));
      line(""); line(span("dim", "Read one with: cat flaggo   Open one with: open flaggo"));
    } },
    whoami: { d: "Who made this", f() { line(span("hl", "Rohan Ahire")); line(ABOUT); } },
    now: { d: "What I'm working on", f() { NOW.forEach((n) => line(span("exe", "▸ "), n)); } },
    contact: { d: "How to reach me", f() {
      line("Email     ", h("a", { href: "mailto:" + EMAIL }, EMAIL));
      line("GitHub    ", link(LINKS.github)); line("LinkedIn  ", link(LINKS.linkedin));
      line(""); line(span("dim", "Or type mail to write from here."));
    } },
    mail: { d: "Write to me", f(a) { line(span("dim", "Opening Mail…")); launch("mail", a.length ? { subject: a.join(" ") } : null); } },
    github: { f() { line(span("dim", "Opening GitHub in a new tab…")); window.open(LINKS.github, "_blank", "noopener"); } },
    linkedin: { f() { line(span("dim", "Opening LinkedIn in a new tab…")); window.open(LINKS.linkedin, "_blank", "noopener"); } },
    neofetch: { d: "System info, with style", f() {
      const ua = navigator.userAgent, br = /Firefox/.test(ua) ? "Firefox" : /Edg\//.test(ua) ? "Edge" : /Chrome/.test(ua) ? "Chrome" : /Safari/.test(ua) ? "Safari" : "Browser";
      const art = ["  ▄▄▄▄▄▄▄    ", "  █ ▀▀▀ █▄  ", "  █ ▀▀▀ █▀█ ", "  █ █ █ ▀▀█ ", "  █ ▀▀▀▀▀ █ ", "  ▀▀▀▀▀▀▀▀▀ ", "            ", "            "];
      const info = [[null, "visitor@pixelos"], [null, "---------------"], ["OS", "PixelOS 1.0"], ["Host", `${br}, ${innerWidth}x${innerHeight}`], ["Uptime", fmtUptime()],
        ["Shell", "pxsh 1.0"], ["Theme", settings.scheme], ["Wallpaper", WALLPAPERS.find((x) => x.id === settings.wallpaper)?.name || settings.wallpaper], ["Avatar", meRunning() ? `Rohan (${meStatus()})` : "away"], ["Windows", String(winList().length)]];
      info.forEach(([k, v], i) => line(span("p2", art[i] || "            "), k ? span("exe", k + ": ") : "", k ? v : span("hl", v)));
      line(span("p2", "            "), h("span", { class: "blocks" }, ...["#10132e", "#d9534f", "#3fd16b", "#f7c437", "#0b2fa8", "#b98ae0", "#5cc9c2", "#eef0f8"].map((c) => h("span", { style: { background: c } }))));
    } },
    date: { f() { line(new Date().toLocaleDateString([], { weekday: "long", year: "numeric", month: "long", day: "numeric" })); } },
    time: { f() { line(new Date().toLocaleTimeString()); } },
    uptime: { f() { line(`up ${fmtUptime()}, since ${new Date(bootTime).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`); } },
    echo: { f(a) { line(a.join(" ")); } },
    clear: { d: "Clear the screen", f() { out.replaceChildren(); } },
    history: { f() { hist.slice(-20).forEach((c, i) => line(span("dim", String(hist.length - Math.min(20, hist.length) + i + 1).padStart(4) + "  "), c)); } },
    ps: { d: "What's running", f() {
      line(span("dim", "  PID  NAME             TITLE"));
      const t = Math.floor((Date.now() - bootTime) / 1000);
      [["1", "pixelos", "PixelOS kernel"], ["2", "explorer", "Desktop"], ["3", "wallpaper", "the lake"], meRunning() && ["4", "rohan", "Pixel Rohan"], ...winList().map((x, i) => [String(100 + i), x.app || "app", x.title])].filter(Boolean)
        .forEach(([p, n, ti]) => line(p.padStart(5) + "  " + n.padEnd(17) + ti));
      line(span("dim", `uptime ${ago(t)}`));
    } },
    kill: { d: "End a program (kill notepad)", f(a) {
      const q = (a[0] || "").toLowerCase().replace(/\.exe$/, "");
      if (!q) return line(span("err", "kill: kill what? Try: ps"));
      if (q === "rohan" || q === "4") { hideMe(60); return line("Rohan left. Back in a minute."); }
      if (q === "pixelos" || q === "1") return exec("shutdown");
      const ws = winList().filter((x) => x.app === q || String(100 + winList().indexOf(x)) === q);
      if (!ws.length) return line(span("err", `kill: no process named ${q}`));
      ws.forEach((x) => x !== w && x.close());
      line(`Sent stop to ${ws.length} window${ws.length === 1 ? "" : "s"}.`);
    } },
    rohan: { d: "Talk to pixel me (rohan wave, rohan tour)", f(a) {
      if (!meRunning()) return line(span("dim", "I'm away from the taskbar. Turn me back on in Control Panel › Pixel Rohan."));
      const s = meStats(), v = (a[0] || "").toLowerCase();
      if (v === "wave" || v === "hi" || v === "come") { callMe(); return line("On my way."); }
      if (v === "code" || v === "work") { meCode(); return line("Opening the laptop."); }
      if (v === "break" || v === "coffee") { meBreak(); return line("Coffee first."); }
      if (v === "tour") { startTour(); return line("Follow me."); }
      if (v === "say") { meSay(a.slice(1).join(" ") || "Hello from the terminal!"); return line("Said it."); }
      if (v === "mail" || v === "inbox") { launch("mail", "inbox"); return line("Opening the inbox."); }
      line(span("hl", "Rohan"), ` is ${meStatus()}.`);
      line(span("dim", `Mail ${s.mails || 0} · Lines ${s.lines || 0} · Coffees ${s.coffees || 0} · Naps ${s.naps || 0} · Lifts ${s.lifts || 0}`));
      line(span("dim", "Try: rohan wave, rohan code, rohan break, rohan tour, rohan say hi, rohan mail"));
    } },
    fortune: { f() { line(FORTUNES[Math.floor(Math.random() * FORTUNES.length)]); } },
    catsay: { d: "Like cowsay, but better", f(a) {
      const msg = a.join(" ") || "mew.", bar = "─".repeat(msg.length + 2);
      [` ┌${bar}┐`, ` │ ${msg} │`, ` └${bar}┘`, "     \\", "      /\\_/\\", "     ( o.o )", "      > ^ <"].forEach((l) => line(l));
    } },
    color: { d: "Change text color (color green)", f(a) {
      const map = { green: "#3fd16b", amber: "#ffb000", white: "#eef0f8", blue: "#7fa2ff", pink: "#ff8fb0", default: "" };
      const c = (a[0] || "").toLowerCase();
      if (!(c in map)) return line(span("dim", "color " + Object.keys(map).join(" | ")));
      term.style.color = map[c]; input.style.color = map[c] || ""; store.set("termColor", c);
    } },
    wallpaper: { d: "Change the wallpaper", f(a) {
      const q = a.join(" ").toLowerCase(), wp = WALLPAPERS.find((x) => x.id === q || x.name.toLowerCase().includes(q));
      if (!q || !wp) return WALLPAPERS.forEach((x) => line(span(x.id === settings.wallpaper ? "hl" : "exe", x.id.padEnd(10)), x.name));
      if (wp.id === "painting" && !settings.wallPic) return line(span("err", "Paint something first, then use File > Set as Wallpaper."));
      setSettings({ wallpaper: wp.id }); line(`Wallpaper: ${wp.name}`);
    } },
    play: { d: "Play some music", f() { line(span("dim", "Starting Tunes…")); launch("tunes", "play"); } },
    matrix: { d: "Follow the white rabbit", async f() {
      const chars = "ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄ01234567890";
      const cols = Math.max(20, Math.floor(term.clientWidth / 9) - 2);
      for (let i = 0; i < 60 && !abort; i++) {
        line(span("exe", Array.from({ length: cols }, () => (Math.random() < 0.55 ? " " : chars[Math.floor(Math.random() * chars.length)])).join("")));
        await sleep(reduce ? 0 : 45);
      }
      line(span("dim", "Wake up, visitor."));
    } },
    ping: { async f(a) {
      const host = a[0] || "rohanahire.com";
      line(`Pinging ${host}:`);
      for (let i = 0; i < 4 && !abort; i++) {
        const t0 = performance.now();
        let ok = true;
        try { await fetch(location.origin + "/?ping=" + Math.random(), { method: "HEAD", cache: "no-store" }); } catch { ok = false; }
        line(ok ? `Reply from ${host}: time=${Math.max(1, Math.round(performance.now() - t0))}ms` : span("err", "Request timed out."));
        await sleep(500);
      }
    } },
    tree: { f() {
      const walk = (id, pre, depth) => fs.children(id).forEach((k, i, arr) => {
        const last = i === arr.length - 1;
        line(span("dim", pre + (last ? "└── " : "├── ")), fs.isFolder(k) ? span("dir", k.name) : k.name);
        if (fs.isFolder(k) && depth < 2 && k.type !== "bin") walk(k.id, pre + (last ? "    " : "│   "), depth + 1);
      });
      line(span("dir", path())); walk(cwd, "", 0);
    } },
    ver: { f() { line(ver); } },
    sudo: { f(a) { line(span("err", "visitor is not in the sudoers file. This incident will be reported to Rohan.")); if (a.join(" ").includes("rm")) sfx("error"); } },
    rm: { f(a) {
      if (a.includes("-rf") || a.includes("/")) return line(span("err", "Nice try. The Recycle Bin is right there on the desktop."));
      const id = resolve(a.join(" ")), n = fs.node(id);
      if (!n) return line(span("err", `rm: ${a.join(" ")}: no such file`));
      if (!fs.canDelete(id, n.parent)) return line(span("err", `rm: ${n.name} can't be deleted`));
      fs.trash(id); sfx("crumple"); line(`Moved ${n.name} to the Recycle Bin.`);
    } },
    touch: { f(a) {
      const loc = cwd === "desktop" || cwd === "documents" ? cwd : null;
      if (!loc) return line(span("err", "You can only make files in Desktop or My Documents. cd desktop first."));
      const d = fs.newNote(loc); if (a.length) fs.rename(d.id, a.join(" "));
      line(`Created ${fs.node(d.id).name}`);
    } },
    hire: { f() { line(span("hl", "Good call.")); exec("mail Let's work together"); } },
    shutdown: { f(a) { bus.emit("shell:shutdown", a.includes("-r") || a.includes("/r") ? "restart" : undefined); } },
    exit: { f() { w.close(); } },
  };
  const ALIAS = { dir: "ls", ll: "ls", type: "cat", more: "cat", less: "cat", start: "open", run: "open", cls: "clear", about: "whoami", "?": "help", man: "help",
    tasklist: "ps", top: "ps", taskkill: "kill", del: "rm", erase: "rm", reboot: "shutdown", restart: "shutdown", poweroff: "shutdown", logout: "exit", quit: "exit", cowsay: "catsay", cat2: "rohan", pixel: "rohan", me: "rohan", chdir: "cd", info: "neofetch", sysinfo: "neofetch", skills: "projects", work: "projects", email: "mail" };

  async function exec(raw) {
    raw = raw.trim();
    line(span("p1", path() + ">"), raw);
    if (!raw) return;
    if (hist[hist.length - 1] !== raw) { hist.push(raw); store.set("termHist", hist.slice(-100)); }
    hi = hist.length;
    let [cmd, ...a] = raw.match(/"[^"]*"|\S+/g).map((x) => x.replace(/^"|"$/g, ""));
    cmd = cmd.toLowerCase();
    if (cmd === "cd.." || cmd === "cd\\") { a = [cmd.slice(2)]; cmd = "cd"; }
    if (cmd === "rm" && a[0] === "-rf" && a[1] === "/") { line(span("err", "Nice try. The Recycle Bin is right there on the desktop.")); return; }
    const c = C[ALIAS[cmd] || cmd];
    if (c) {
      busy = true; abort = false; inrow.style.visibility = "hidden";
      try { await c.f(a); } catch (e) { console.error(e); line(span("err", "Something went wrong: " + e.message)); }
      busy = false; inrow.style.visibility = ""; input.focus({ preventScroll: true }); term.scrollTop = term.scrollHeight;
      return;
    }
    if (APPS.includes(cmd) && !["project", "properties", "explorer"].includes(cmd)) { line(span("dim", `Starting ${cmd}…`)); return launch(cmd); }
    const id = resolve(raw);
    if (id) { const n = fs.node(id); if (fs.isFolder(n)) { cwd = id; setPrompt(); } else openNode(id); return; }
    bus.emit("me:react", "termerr");
    line(span("err", `'${cmd}' is not recognized as a command.`), span("dim", " Type help to see what's here."));
  }

  function complete() {
    const v = input.value, m = v.match(/^(\S*)(\s+)?(.*)$/);
    const first = !m[2];
    const word = first ? m[1] : m[3];
    const pool = first ? [...Object.keys(C), ...APPS.filter((x) => !["project", "properties", "explorer"].includes(x))] : fs.children(cwd).map((k) => k.name);
    const hits = [...new Set(pool)].filter((x) => x.toLowerCase().startsWith(word.toLowerCase()));
    if (hits.length === 1) input.value = first ? hits[0] + " " : m[1] + " " + (hits[0].includes(" ") ? `"${hits[0]}"` : hits[0]);
    else if (hits.length > 1) {
      line(span("p1", path() + ">"), v); line(span("dim", hits.join("   ")));
      let pre = hits[0];
      for (const x of hits) while (!x.toLowerCase().startsWith(pre.toLowerCase())) pre = pre.slice(0, -1);
      if (pre.length > word.length) input.value = first ? pre : m[1] + " " + pre;
    } else sfx("click");
  }

  input.addEventListener("keydown", async (e) => {
    if (e.key === "Enter") { e.preventDefault(); const v = input.value; input.value = ""; await exec(v); }
    else if (e.key === "Tab") { e.preventDefault(); complete(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); if (hi > 0) input.value = hist[--hi]; }
    else if (e.key === "ArrowDown") { e.preventDefault(); input.value = hi < hist.length - 1 ? hist[++hi] : (hi = hist.length, ""); }
    else if (e.ctrlKey && (e.key === "l" || e.key === "L")) { e.preventDefault(); out.replaceChildren(); }
    else if (e.ctrlKey && (e.key === "c" || e.key === "C") && !input.selectionEnd) { e.preventDefault(); line(span("p1", path() + ">"), input.value + "^C"); input.value = ""; }
    else if (e.ctrlKey && e.shiftKey && (e.key === "N" || e.key === "n")) { e.preventDefault(); launch("terminal"); }
  });
  // Ctrl+C while a command runs
  w.el.addEventListener("keydown", (e) => { if (busy && e.ctrlKey && (e.key === "c" || e.key === "C")) { abort = true; line("^C"); } });
  term.addEventListener("pointerup", () => { if (!String(getSelection()) && !busy) input.focus({ preventScroll: true }); });

  const col = store.get("termColor", "");
  if (col && col !== "default") C.color.f([col]);
  setPrompt();
  line(ver);
  line(span("dim", "Type help to see commands. Try neofetch, projects or pixel."));
  line("");
  setTimeout(() => input.focus(), 0);
  if (typeof arg === "string" && arg) exec(arg);
  return w;
}
