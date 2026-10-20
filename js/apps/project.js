// A project's own window: what it is, what it's built with, and a way to see it live.
import { h, EMAIL } from "../core.js";
import { icon } from "../px.js";
import { openWindow } from "../wm.js";
import { PROJECTS } from "../data.js";
import { launch, openNode, properties } from "./index.js";

export function open(id, from) {
  const p = PROJECTS.find((x) => x.id === id) || PROJECTS[0];
  const i = PROJECTS.indexOf(p);
  const go = (d) => { const n = PROJECTS[(i + d + PROJECTS.length) % PROJECTS.length]; w.close(true); launch("project", n.id); };
  const ask = () => launch("mail", { subject: `About ${p.name}` });
  const w = openWindow({
    id: "project:" + p.id, posKey: "project", title: p.name, icon: p.icon, app: "project", arg: p.id, w: 600, h: 520, minW: 320, minH: 280, from,
    bodyClass: "paper pad",
    menubar: [
      { label: "File", items: () => [
        p.live && { label: "Open it live", icon: "web", bold: true, action: () => launch("browser", "app:" + p.id) },
        { label: "Show in Projects", icon: "folderStar", action: () => openNode("projects") },
        { label: "Properties", action: () => properties(p.id) },
        { sep: true },
        { label: "Close", kbd: "Alt+F4", action: () => w.close() },
      ].filter(Boolean) },
      { label: "Go", items: () => [
        { label: "Previous project", kbd: "←", action: () => go(-1) },
        { label: "Next project", kbd: "→", action: () => go(1) },
        { sep: true },
        ...PROJECTS.map((x) => ({ label: x.name, icon: x.icon, radio: x === p, action: () => x !== p && (w.close(true), launch("project", x.id)) })),
      ] },
      { label: "Help", items: () => [{ label: `Ask Rohan about ${p.name}`, icon: "mail", action: ask }] },
    ],
  });
  if (w.body.childElementCount) return w;
  const facts = h("dl", { class: "facts" });
  [["Type", p.kind], ["Year", p.year], ["Status", p.status], ["Built with", p.stack], p.live && ["Live at", p.live.replace(/^https?:\/\//, "")]]
    .filter(Boolean).forEach(([k, v]) => facts.append(h("dt", {}, k), h("dd", {}, v)));
  w.body.append(
    h("div", { class: "proj-head" }, icon(p.icon, { size: 32, scale: 2 }), h("div", {}, h("h2", {}, p.name), h("p", {}, p.sum))),
    h("p", { class: "prose" }, p.blurb),
    facts,
    h("div", { class: "actions" },
      p.live && h("button", { type: "button", class: "btn blue", onclick: () => launch("browser", "app:" + p.id) }, `Open ${p.name}`),
      h("button", { type: "button", class: "btn", onclick: ask }, "Ask me about it"),
      h("span", { style: { flex: 1 } }),
      h("button", { type: "button", class: "btn sm", "aria-label": "Previous project", "data-tip": "Previous project", onclick: () => go(-1) }, "‹"),
      h("button", { type: "button", class: "btn sm", "aria-label": "Next project", "data-tip": "Next project", onclick: () => go(1) }, "›")),
  );
  w.el.append(w.statusbar(`${i + 1} of ${PROJECTS.length}`, h("span", { class: "fit" }, p.status)));
  w.body.tabIndex = -1;
  w.el.addEventListener("keydown", (e) => {
    if (e.target.closest("input, textarea, .menubar")) return;
    if (e.key === "ArrowLeft") { e.preventDefault(); go(-1); }
    if (e.key === "ArrowRight") { e.preventDefault(); go(1); }
  });
  return w;
}
