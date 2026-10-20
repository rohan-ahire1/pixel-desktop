// Mail Rohan: an inbox for the notes Rohan sends while you look around, and a compose window that hands
// your message to your own email app.
import { h, EMAIL, bus, announce, fmtTime, small } from "../core.js";
import { icon } from "../px.js";
import { openWindow, msgbox } from "../wm.js";
import { sfx } from "../sound.js";
import { LINKS } from "../data.js";
import { messages, unread, getMail, markRead, removeMail, runAction } from "../inbox.js";

const DRAFT = "pxos-maildraft";
const ext = (url) => window.open(url, "_blank", "noopener");

export function open(arg, from) {
  if (arg === "inbox" || (arg && typeof arg === "object" && arg.read)) return openInbox(arg && arg.read, from);
  return compose(arg, from);
}

const tb = (ic, label, fn, o = {}) => h("button", { type: "button", class: "tbtn", onclick: fn, ...o }, icon(ic, { size: 16, scale: 1, still: true }), label);
const when = (t) => { const d = new Date(t); return d.toDateString() === new Date().toDateString() ? fmtTime(d) : d.toLocaleDateString([], { month: "short", day: "numeric" }); };

function openInbox(readId, from) {
  let sel = readId || null;
  const w = openWindow({
    id: "inbox", title: "Inbox - Mail Rohan", icon: "mail", app: "mail", arg: "inbox", w: 760, h: 500, minW: 320, minH: 300, from, bodyClass: "mailbox",
    onReopen: () => { if (readId) pickMail(readId); },
    menubar: [
      { label: "File", items: () => [
        { label: "New message", kbd: "Ctrl+N", bold: true, action: () => compose(null) },
        { label: "Reply", disabled: !sel, action: reply },
        { label: "Delete", kbd: "Del", disabled: !sel, action: del },
        { sep: true },
        { label: "Close", kbd: "Alt+F4", action: () => w.close() },
      ] },
      { label: "View", items: () => [
        { label: "Mark as unread", disabled: !sel, action: () => { markRead(sel, false); } },
        { label: "Mark all as read", action: () => messages().forEach((m) => markRead(m.id)) },
      ] },
      { label: "Elsewhere", items: () => [
        { label: "GitHub", icon: "web", action: () => ext(LINKS.github) },
        { label: "LinkedIn", icon: "web", action: () => ext(LINKS.linkedin) },
      ] },
    ],
  });
  if (w.body.childElementCount) { if (readId) w._pick?.(readId); return w; }

  const list = h("ul", { class: "mb-list", role: "listbox", "aria-label": "Messages", tabindex: "0" });
  const pane = h("div", { class: "mb-read", tabindex: "-1" });
  const replyB = tb("mail", "Reply", () => reply()), delB = tb("recycle", "Delete", () => del());
  const sMsg = h("span"), sCount = h("span", { class: "fit" });
  w.body.append(
    h("div", { class: "toolbar mb-tools" }, tb("note", "New", () => compose(null)), replyB, delB, h("span", { class: "tsep" }),
      tb("txt", "Copy address", () => navigator.clipboard?.writeText(EMAIL).then(() => { sMsg.textContent = "Address copied."; announce("Email address copied."); })),
      tb("web", "GitHub", () => ext(LINKS.github)), tb("web", "LinkedIn", () => ext(LINKS.linkedin))),
    h("div", { class: "mb-split" }, list, pane));
  w.el.append(w.statusbar(sMsg, sCount));

  function render() {
    const ms = messages();
    if (sel && !getMail(sel)) sel = null;
    list.replaceChildren(...ms.map((m) => {
      const li = h("li", { class: "mb-item" + (m.read ? "" : " unread"), role: "option", id: "mb-" + m.id, "aria-selected": String(m.id === sel) },
        icon(m.read ? "txt" : "mail", { size: 16, scale: 1, still: true }), h("b", {}, m.from), h("time", {}, when(m.time)), h("span", { class: "s" }, m.subject));
      li.addEventListener("click", () => pickMail(m.id));
      return li;
    }));
    if (!ms.length) list.append(h("li", { class: "mb-none" }, "No mail yet."));
    if (sel) list.setAttribute("aria-activedescendant", "mb-" + sel); else list.removeAttribute("aria-activedescendant");
    replyB.disabled = delB.disabled = !sel;
    const n = unread();
    sCount.textContent = `${ms.length} message${ms.length === 1 ? "" : "s"}, ${n} unread`;
    w.setTitle?.(n ? `Inbox (${n}) - Mail Rohan` : "Inbox - Mail Rohan");
    show();
  }
  function show() {
    const m = sel && getMail(sel);
    w.body.classList.toggle("reading", !!m);
    if (!m) {
      pane.replaceChildren(h("div", { class: "mb-empty" }, icon("mail", { size: 32, scale: 2 }),
        h("p", {}, messages().length ? "Pick a message to read it." : "No mail yet. Stick around and look at a few things. I'll write."),
        h("button", { type: "button", class: "btn", onclick: () => compose(null) }, "Write to Rohan")));
      return;
    }
    const acts = [...(m.actions || [])];
    if (!acts.some(([, a]) => a === "reply")) acts.push(["Reply", "reply"]);
    pane.replaceChildren(
      small() ? h("button", { type: "button", class: "btn sm mb-back", onclick: () => { sel = null; render(); list.focus(); } }, "‹ Inbox") : null,
      h("div", { class: "mb-head" }, h("h2", {}, m.subject),
        h("div", { class: "mb-meta" }, `From: ${m.from} <${EMAIL}>`), h("div", { class: "mb-meta" }, `Received: ${new Date(m.time).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}`)),
      h("p", { class: "mb-body sel-text" }, m.body),
      h("div", { class: "btnrow mb-acts" }, ...acts.map(([label, a], i) => h("button", { type: "button", class: "btn" + (i === 0 ? " def" : ""), onclick: () => runAction(a, m) }, label))));
  }
  function pickMail(id) {
    if (!getMail(id)) return;
    sel = id; markRead(id); render();
    document.getElementById("mb-" + id)?.scrollIntoView({ block: "nearest" });
    sfx("click");
  }
  function reply() { const m = sel && getMail(sel); if (m) compose({ subject: "Re: " + m.subject }); }
  function del() {
    if (!sel) return;
    const ms = messages(), i = ms.findIndex((m) => m.id === sel);
    removeMail(sel); sfx("crumple");
    const next = messages()[Math.min(i, messages().length - 1)];
    sel = next && !small() ? next.id : null;
    render();
  }
  list.addEventListener("keydown", (e) => {
    const ms = messages(), i = ms.findIndex((m) => m.id === sel);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); const n = ms[Math.max(0, Math.min(ms.length - 1, i + (e.key === "ArrowDown" ? 1 : -1)))]; if (n) pickMail(n.id); }
    else if (e.key === "Home" || e.key === "End") { e.preventDefault(); const n = e.key === "Home" ? ms[0] : ms[ms.length - 1]; if (n) pickMail(n.id); }
    else if (e.key === "Delete") { e.preventDefault(); del(); }
    else if (e.key === "Enter" && sel) { e.preventDefault(); pane.focus(); }
  });
  w.el.addEventListener("keydown", (e) => { if ((e.ctrlKey || e.metaKey) && (e.key === "n" || e.key === "N")) { e.preventDefault(); compose(null); } });
  const off = bus.on("mail:changed", render);
  w.on?.(off);
  w._pick = pickMail;
  if (!sel && !small()) sel = messages().find((m) => !m.read)?.id || messages()[0]?.id || null;
  if (sel) markRead(sel);
  render();
  setTimeout(() => list.focus(), 0);
  return w;
}

function compose(arg, from) {
  const subjectIn = arg && typeof arg === "object" ? arg.subject : null;
  let draft = {};
  try { draft = JSON.parse(sessionStorage.getItem(DRAFT) || "{}"); } catch (e) {}
  const subj = h("input", { class: "field", id: "mail-subj", value: subjectIn || draft.subject || "Hello via rohanahire.com" });
  const body = h("textarea", { class: "field", id: "mail-body", rows: "8", placeholder: "Say hi, pitch an idea, or ask about a project." });
  body.value = draft.body || "";
  const keep = () => { try { sessionStorage.setItem(DRAFT, JSON.stringify({ subject: subj.value, body: body.value })); } catch (e) {} };
  subj.addEventListener("input", keep); body.addEventListener("input", keep);

  const copy = () => navigator.clipboard?.writeText(EMAIL).then(() => { sMsg.textContent = "Address copied."; announce("Email address copied."); sfx("click"); })
    .catch(() => msgbox({ title: "Mail", icon: "info", text: EMAIL, parent: w }));
  const send = () => {
    const href = `mailto:${EMAIL}?subject=${encodeURIComponent(subj.value || "Hello via rohanahire.com")}&body=${encodeURIComponent(body.value)}`;
    location.href = href;
    sfx("ding");
    sMsg.textContent = "Handed to your email app.";
    bus.emit("me:react", "mailsent");
    bus.emit("notify", { title: "Message ready", text: "Your email app should open with the message filled in. If nothing happened, copy the address instead: " + EMAIL, icon: "mail", timeout: 10000 });
  };

  const w = openWindow({
    id: "mail", title: "New Message - Mail Rohan", icon: "mail", app: "mail", w: 560, h: 500, minW: 320, minH: 320, from, bodyClass: "pad mail",
    onReopen: (w) => { if (subjectIn) { subj.value = subjectIn; } },
    menubar: [
      { label: "File", items: () => [
        { label: "Send", kbd: "Ctrl+Enter", bold: true, action: send },
        { label: "Copy address", action: copy },
        { sep: true },
        { label: "Discard draft", action: () => { body.value = ""; subj.value = "Hello via rohanahire.com"; keep(); } },
        { label: "Close", kbd: "Alt+F4", action: () => w.close() },
      ] },
      { label: "Elsewhere", items: () => [
        { label: "GitHub", icon: "web", action: () => ext(LINKS.github) },
        { label: "LinkedIn", icon: "web", action: () => ext(LINKS.linkedin) },
      ] },
    ],
  });
  if (w.body.childElementCount) { if (subjectIn) { const s = w.body.querySelector("#mail-subj"); if (s) s.value = subjectIn; } return w; }
  const sMsg = h("span");
  const inboxL = h("span", {}, "Inbox"), inboxB = tb("mail", inboxL, () => openInbox(null));
  const inboxN = () => { const n = unread(); inboxL.textContent = n ? `Inbox (${n})` : "Inbox"; };
  inboxN();
  w.on?.(bus.on("mail:changed", inboxN));
  w.body.append(
    h("div", { class: "toolbar", style: { marginTop: 0, borderTop: 0, boxShadow: "none", padding: "0 0 6px" } },
      h("button", { type: "button", class: "tbtn", onclick: send }, icon("mail", { size: 16, scale: 1, still: true }), "Send"),
      h("button", { type: "button", class: "tbtn", onclick: copy }, icon("txt", { size: 16, scale: 1, still: true }), "Copy"),
      h("span", { class: "tsep" }),
      h("button", { type: "button", class: "tbtn", onclick: () => ext(LINKS.github) }, icon("web", { size: 16, scale: 1, still: true }), "GitHub"),
      h("button", { type: "button", class: "tbtn", onclick: () => ext(LINKS.linkedin) }, icon("web", { size: 16, scale: 1, still: true }), "LinkedIn"),
      h("span", { class: "tsep" }), inboxB),
    h("div", { class: "mail-card" }, icon("mail", { size: 32, scale: 1 }),
      h("div", { class: "who" }, h("b", {}, "Rohan Ahire"), h("span", {}, EMAIL)),
      h("span", { style: { fontFamily: "var(--mono)", fontSize: "12.5px", color: "var(--muted)" } }, "Usually replies within a day.")),
    h("div", { class: "mfields" }, h("label", { for: "mail-to" }, "To:"), h("input", { class: "field", id: "mail-to", value: EMAIL, readonly: true }), h("label", { for: "mail-subj" }, "Subject:"), subj),
    body,
  );
  w.el.append(w.statusbar(sMsg, h("span", { class: "fit" }, "Opens in your email app")));
  w.el.addEventListener("keydown", (e) => { if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); send(); } });
  setTimeout(() => (subjectIn ? body : body).focus(), 0);
  return w;
}
