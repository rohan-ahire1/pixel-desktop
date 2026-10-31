// Drives the boot, the reel and the project clips in a real browser. Screenshots land in .factory/evidence/film/.
import { createServer } from "node:http";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { homedir } from "node:os";
import { extname, join, normalize } from "node:path";

const root = join(import.meta.dirname, ".."), out = join(root, ".factory/evidence/film");
const kit = process.env.FACTORY_PLAYWRIGHT_DIR || join(homedir(), ".cache/factory-kit/playwright");
const { chromium } = createRequire(join(kit, "package.json"))("playwright");
mkdirSync(out, { recursive: true });

const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".pdf": "application/pdf", ".json": "application/json", ".ico": "image/x-icon", ".webmanifest": "application/manifest+json" };
const server = createServer((req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)), file = join(root, path === "/" ? "index.html" : path);
  if (!file.startsWith(root) || !existsSync(file)) { res.writeHead(404); return res.end("not found"); }
  res.writeHead(200, { "content-type": MIME[extname(file)] || "application/octet-stream" });
  res.end(readFileSync(file));
});
// the one local port the live projects allow to frame them, so the iframe check loads the real thing
await new Promise((r) => server.listen(3104, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch();
const DESKTOP = { viewport: { width: 1440, height: 900 } };
const results = [], errors = [];
let context = null;

// a page in a fresh browser session; __films records every film that ever appears, however briefly
async function open(opts = DESKTOP) {
  context = await browser.newContext(opts);
  await context.route(/cloudflareinsights/, (r) => r.fulfill({ status: 200, contentType: "text/javascript", body: "" }));
  await context.addInitScript(() => {
    window.__films = [];
    new MutationObserver((list) => list.forEach((m) => m.addedNodes.forEach((n) => { if (n.classList?.contains("overlay")) setTimeout(() => n.dataset.film && window.__films.push(n.dataset.film)); }))).observe(document, { childList: true, subtree: true });
  });
  const page = await context.newPage();
  page.on("console", (m) => { if (m.type() === "error" && !/fonts\.g|ERR_|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(String(e)));
  return page;
}
const film = (page, kind) => page.locator(kind ? `.film[data-film="${kind}"]` : ".film");
const card = (page) => page.locator(".film-card");
const shot = (page, name) => page.screenshot({ path: join(out, name + ".png") });
const inked = (page) => page.evaluate(() => { const c = document.querySelector(".film canvas"), d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data, seen = new Set(); for (let i = 0; i < d.length; i += 4004) seen.add(d[i] + "," + d[i + 1] + "," + d[i + 2]); return seen.size; });
const usable = async (page) => {
  await page.locator(".taskbar").waitFor({ timeout: 5000 });
  await page.locator('.win h1[aria-label="Rohan Ahire"]').waitFor({ timeout: 5000 });
  if (await film(page).count()) throw new Error("film is still up");
  await page.locator(".startbtn").click();
  await page.locator(".start").waitFor({ timeout: 2000 });
  await page.keyboard.press("Escape");
};
const past = async (page, opts) => { await page.goto(base + "/"); await film(page, "boot").waitFor(opts); await page.keyboard.press("x"); await film(page).waitFor({ state: "detached", timeout: 2000 }); };
const expect = (ok, msg) => { if (!ok) throw new Error(msg); };

async function test(name, fn) {
  const t0 = Date.now();
  try { await fn(); results.push(`PASS ${name} (${((Date.now() - t0) / 1000).toFixed(1)}s)`); }
  catch (e) { results.push(`FAIL ${name}: ${e.message.split("\n")[0]}`); }
  await context?.close(); context = null;
  console.log(results.at(-1));
}

await test("first visit plays the boot and reaches a usable desktop", async () => {
  const page = await open();
  await page.goto(base + "/");
  await film(page, "boot").waitFor({ timeout: 3000 });
  await page.waitForTimeout(1300);
  expect((await inked(page)) > 2, "boot canvas is blank");
  await shot(page, "boot-1-panic");
  await page.waitForTimeout(3300);
  await shot(page, "boot-2-flood");
  await page.waitForTimeout(1500);
  await shot(page, "boot-3-coffee");
  await film(page).waitFor({ state: "detached", timeout: 6000 });
  await usable(page);
  await shot(page, "boot-4-desktop");
});
/* the film ends on the real desktop: stop the page's clock and compare the frames either side of each hand-over */
const pixels = await browser.newPage();
async function diff(a, b, name, box) {
  const { share, changed, area, png } = await pixels.evaluate(async ([a, b, box]) => {
    const load = async (s) => createImageBitmap(await (await fetch("data:image/png;base64," + s)).blob());
    const read = (bmp) => { const c = new OffscreenCanvas(bmp.width, bmp.height).getContext("2d", { willReadFrequently: true }); c.drawImage(bmp, 0, 0); return c; };
    const [x, y] = await Promise.all([load(a), load(b)]), A = read(x), B = read(y), { width: w, height: h } = x, r = box || { x: 0, y: 0, w, h };
    const pa = A.getImageData(r.x, r.y, r.w, r.h), pb = B.getImageData(r.x, r.y, r.w, r.h), L = [1e9, 1e9, -1, -1];
    let changed = 0;
    for (let i = 0; i < pa.data.length; i += 4) {
      const hit = Math.abs(pa.data[i] - pb.data[i]) > 16 || Math.abs(pa.data[i + 1] - pb.data[i + 1]) > 16 || Math.abs(pa.data[i + 2] - pb.data[i + 2]) > 16;
      pb.data[i] = hit ? 255 : pb.data[i] * 0.3; pb.data[i + 1] = hit ? 0 : pb.data[i + 1] * 0.3; pb.data[i + 2] = hit ? 0 : pb.data[i + 2] * 0.3;
      if (hit) { const px = (i / 4) % r.w, py = Math.floor(i / 4 / r.w); changed++; L[0] = Math.min(L[0], px + r.x); L[1] = Math.min(L[1], py + r.y); L[2] = Math.max(L[2], px + r.x); L[3] = Math.max(L[3], py + r.y); }
    }
    const out = new OffscreenCanvas(r.w, r.h), oc = out.getContext("2d");
    oc.putImageData(pb, 0, 0);
    const bytes = new Uint8Array(await (await out.convertToBlob()).arrayBuffer());
    let bin = "";
    for (let i = 0; i < bytes.length; i += 32768) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 32768));
    return { changed, share: changed / (r.w * r.h), area: changed ? L : null, png: btoa(bin) };
  }, [a.toString("base64"), b.toString("base64"), box]);
  writeFileSync(join(out, name + ".png"), Buffer.from(png, "base64"));
  return { share, changed, area };
}
async function seamless(name, viewport, saved, met) {
  const page = await open({ viewport });
  if (met) await context.addInitScript(() => localStorage.setItem("pxos-meMet", "true"));
  if (saved) await context.addInitScript((s) => localStorage.setItem("pxos-settings", JSON.stringify(s)), saved);
  const T0 = new Date("2026-11-02T10:00:00").getTime();
  await page.clock.install({ time: T0 });
  await page.clock.pauseAt(T0 + 1000);
  await page.goto(base + "/");
  await film(page, "boot").waitFor({ timeout: 3000 });
  const run = (ms) => page.clock.runFor(ms), still = () => page.screenshot();
  const save = (buf, part) => writeFileSync(join(out, `match-${name}-${part}.png`), buf);
  const rohan = () => page.evaluate(async () => { const m = await import("/js/me.js"); return { status: m.meStatus(), dock: m.meDock() }; });
  for (let i = 0; i < 400 && !(await film(page, "boot").locator(".film-wash").count()); i++) await run(33);
  expect(await film(page, "boot").locator(".film-wash").count(), "the wash never started");
  await run(1600);
  const { dock } = await rohan();
  if (dock) {
    let before, after;
    for (let i = 0; i < 40; i++) { before = await still(); await run(33); if ((await rohan()).status !== "on the way") { after = await still(); break; } }
    expect(after, "live Rohan never took over");
    save(before, "handover-film"); save(after, "handover-live");
    const feet = { x: dock.x, y: dock.y + 34 * dock.S, w: 36 * dock.S, h: 8 * dock.S };
    const f = await diff(before, after, `match-${name}-handover-diff`, feet);
    expect(f.changed === 0, `${name}: Rohan's feet moved ${f.changed}px at the hand-over, ${JSON.stringify(f.area)}`);
  }
  await run(1700);
  let last, clear = false;
  for (let i = 0; i < 60 && (await film(page).count()); i++) {
    last = await still();
    clear = await page.evaluate(() => { const ov = document.querySelector(".film"); return !!ov && [...ov.querySelectorAll("canvas")].every((c) => c.getContext("2d").getImageData(0, 0, c.width, c.height).data.every((v, j) => j % 4 !== 3 || v === 0)) && !ov.querySelector(".film-ui:not([hidden])")?.offsetParent; });
    await run(33);
  }
  expect(!(await film(page).count()), "the film never ended");
  expect(clear, `${name}: the last boot frame still paints over the desktop`);
  const first = await still();
  save(last, "last"); save(first, "desktop");
  const d = await diff(last, first, `match-${name}-diff`);
  expect(d.share <= 0.001, `${name}: ${d.changed}px (${(d.share * 100).toFixed(3)}%) changed at ${JSON.stringify(d.area)}`);
  return `${name} ${d.changed}px${d.area ? " at " + d.area : ""}`;
}
for (const [name, viewport, saved, met] of [
  ["1280", { width: 1280, height: 800 }],
  ["1280-returning", { width: 1280, height: 800 }, null, true],
  ["1920", { width: 1920, height: 1080 }],
  ["1366-other-scheme", { width: 1366, height: 768 }, { scheme: "plum", wallpaper: "sunset" }],
  ["1280-no-rohan", { width: 1280, height: 800 }, { me: false }],
  ["1280-no-welcome", { width: 1280, height: 800 }, { welcome: false }],
]) await test(`the last boot frame matches the live desktop at ${name}`, async () => console.log("  " + (await seamless(name, viewport, saved, met))));
await test("skipping after the landing leaves him standing on his spot", async () => {
  const page = await open();
  await page.goto(base + "/");
  await film(page, "boot").locator(".film-wash").waitFor({ timeout: 9000 });
  await page.waitForTimeout(1000);
  await page.keyboard.press("Enter");
  await film(page).waitFor({ state: "detached", timeout: 2000 });
  const s = await page.evaluate(async () => ({ status: (await import("/js/me.js")).meStatus(), bar: document.querySelector(".taskbar").style.translate, hops: document.querySelectorAll('.win[style*="translate"], .dicon[style*="translate"]').length }));
  expect(s.status !== "walking around" && !s.bar && !s.hops, JSON.stringify(s));
  await usable(page);
});
await test("a key skips the boot", async () => {
  const page = await open();
  await past(page, { timeout: 3000 });
  await usable(page);
});
await test("a click skips the boot", async () => {
  const page = await open();
  await page.goto(base + "/");
  await film(page, "boot").waitFor({ timeout: 3000 });
  await page.waitForTimeout(400);
  await page.mouse.click(300, 300);
  await film(page).waitFor({ state: "detached", timeout: 2000 });
  await usable(page);
});
await test("a click at the halt throws the mug instead of skipping", async () => {
  const page = await open();
  await page.goto(base + "/");
  await film(page, "boot").waitFor({ timeout: 3000 });
  await page.waitForTimeout(2000);
  await page.mouse.click(300, 300);
  await page.waitForTimeout(600);
  expect(await film(page).count(), "the click skipped the film");
  await film(page).waitFor({ state: "detached", timeout: 6000 });
  await usable(page);
});
await test("sound stays off until asked for", async () => {
  const page = await open();
  await page.goto(base + "/");
  await page.locator(".film-sound").waitFor({ timeout: 3000 });
  expect((await page.locator(".film-sound").textContent()) === "Sound off", "sound did not start off");
  await page.locator(".film-sound").click();
  expect((await page.locator(".film-sound").textContent()) === "Sound on", "the button did not turn sound on");
  expect(await film(page).count(), "the sound button skipped the film");
});
await test("reload plays the boot again", async () => {
  const page = await open();
  await past(page, { timeout: 3000 });
  await page.reload();
  await film(page, "boot").waitFor({ timeout: 3000 });
  await page.keyboard.press("x");
  await film(page).waitFor({ state: "detached", timeout: 2000 });
  await usable(page);
});
await test("back navigation skips the boot", async () => {
  const page = await open();
  await past(page, { timeout: 3000 });
  await page.goto(base + "/privacy.html");
  const loaded = [];
  page.on("request", (r) => { if (/js\/film\/(player|coffee-panic|one-cut)/.test(r.url())) loaded.push(r.url()); });
  await page.goBack();
  await usable(page);
  expect(!(await page.evaluate(() => window.__films.length)), "a film appeared on back navigation");
  expect(!loaded.length, "film code loaded on back navigation: " + loaded.join(" "));
});
await test("reduced motion shows a still, then goes straight in", async () => {
  const page = await open({ ...DESKTOP, reducedMotion: "reduce" });
  const t0 = Date.now();
  await page.goto(base + "/");
  await film(page, "boot").waitFor({ timeout: 3000 });
  await page.waitForTimeout(350);
  expect((await inked(page)) > 2, "the still is blank");
  await shot(page, "reduced-1-still");
  await film(page).waitFor({ state: "detached", timeout: 2500 });
  expect(Date.now() - t0 < 3500, "the still stayed too long");
  await usable(page);
  await page.getByRole("button", { name: "Watch the reel" }).click();
  await page.locator(".film-card").waitFor({ timeout: 2000 });
  expect(!(await page.locator(".film-hint:visible").count()), "skip hint on the still");
  expect((await page.locator(".film-card .film-btn").count()) === 3, "reduced motion card should have no Replay");
  await shot(page, "reduced-2-card");
  await card(page).getByRole("button", { name: "Close" }).click();
  await film(page).waitFor({ state: "detached", timeout: 1000 });
});
await test("the phone site never plays a film and offers no reel", async () => {
  const page = await open({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await page.goto(base + "/");
  await page.locator(".p-status b").waitFor({ timeout: 3000 }); // phone.js shows "/" in the address bar, so the URL can't tell
  await page.waitForTimeout(1500);
  expect(!(await page.evaluate(() => window.__films.length)), "a film appeared");
  expect(!(await film(page).count()), "film overlay on the phone");
  expect(!(await page.getByText("Watch the reel").count()), "the reel is offered on the phone");
  await shot(page, "phone");
});
await test("a phone-sized desktop window never plays the boot", async () => {
  const page = await open({ viewport: { width: 700, height: 800 } });
  await page.goto(base + "/?desktop");
  await page.locator(".taskbar").waitFor({ timeout: 5000 });
  await page.waitForTimeout(500);
  expect(!(await page.evaluate(() => window.__films.length)), "a film appeared");
});
await test("the reel runs to the end card and every card button works", async () => {
  const page = await open();
  await past(page, { timeout: 3000 });
  await usable(page);
  expect(!(await film(page, "reel").count()), "the reel started on its own");
  await page.getByRole("button", { name: "Watch the reel" }).click();
  const t0 = Date.now();
  await film(page, "reel").waitFor({ timeout: 2000 });
  for (const [at, name] of [[1600, "scoutline"], [3300, "recoup"], [5700, "pointer"], [7400, "multibagger"], [9400, "flaggo"], [11300, "coachmate"]]) {
    await page.waitForTimeout(Math.max(0, at - (Date.now() - t0)));
    await shot(page, "reel-" + name);
  }
  await page.locator(".film-card").waitFor({ timeout: 6000 });
  const secs = (Date.now() - t0) / 1000;
  expect(secs > 11 && secs < 15, `the reel took ${secs.toFixed(1)}s`);
  await page.waitForTimeout(500);
  await shot(page, "reel-end-card");
  const resume = card(page).getByRole("link", { name: "Résumé" }), email = card(page).getByRole("link", { name: "Email" });
  expect(await resume.evaluate((a) => document.activeElement === a), "focus should start on Résumé");
  expect((await email.getAttribute("href")) === "mailto:ahirerohan3.14@gmail.com", "wrong email link");
  expect((await resume.getAttribute("href")) === "resume.pdf", "wrong résumé link");
  const [tab] = await Promise.all([context.waitForEvent("page"), resume.click()]); // headless shows no PDF, so its tab has no URL to read
  expect((await context.request.get(base + "/resume.pdf")).status() === 200, "resume.pdf is missing");
  await tab.close();
  await page.keyboard.press("Tab");
  expect(await page.evaluate(() => !!document.activeElement.closest(".film-card")), "Tab left the card");
  await card(page).getByRole("button", { name: "Replay" }).click();
  await page.locator(".film-card").waitFor({ state: "detached", timeout: 1000 });
  await page.waitForTimeout(400);
  await page.keyboard.press("x");
  await page.locator(".film-card").waitFor({ timeout: 1000 });
  expect(await film(page, "reel").count(), "skipping the reel should land on the card, not close it");
  await card(page).getByRole("button", { name: "Close" }).click();
  await film(page).waitFor({ state: "detached", timeout: 1000 });
  await usable(page);
});
await test("the reel starts from its desktop icon, and Esc closes the card", async () => {
  const page = await open();
  await past(page, { timeout: 3000 });
  await page.locator(".win .def", { hasText: "Close" }).click();
  await page.locator("#di-reel").dblclick();
  await film(page, "reel").waitFor({ timeout: 2000 });
  await page.mouse.click(700, 400);
  await page.locator(".film-card").waitFor({ timeout: 1000 });
  await page.keyboard.press("Escape");
  await film(page).waitFor({ state: "detached", timeout: 1000 });
});
await test("a project plays its clip once, then its window opens", async () => {
  const page = await open();
  await past(page, { timeout: 3000 });
  await page.locator(".win .def", { hasText: "Close" }).click();
  await page.locator("#di-scoutline").dblclick();
  await film(page, "clip").waitFor({ timeout: 2000 });
  await page.waitForTimeout(700);
  await shot(page, "clip-scoutline");
  await film(page).waitFor({ state: "detached", timeout: 3000 });
  const win = page.locator(".win", { hasText: "Next: Recoup" });
  await win.waitFor({ timeout: 2000 });
  await shot(page, "clip-project-window");
  await win.locator(".tbar button").last().click();
  await win.waitFor({ state: "detached", timeout: 1000 });
  await page.evaluate(() => { window.__films.length = 0; });
  await page.locator("#di-scoutline").dblclick();
  await win.waitFor({ timeout: 2000 });
  expect(!(await page.evaluate(() => window.__films.length)), "the clip played twice");
  await win.getByRole("button", { name: "Next: Recoup" }).click();
  await film(page, "clip").waitFor({ timeout: 2000 });
  await film(page).waitFor({ state: "detached", timeout: 2000 });
  await page.locator(".win", { hasText: "Next: Pointer" }).waitFor({ timeout: 2000 });
});
await test("a live project still loads in the browser app after its clip", async () => {
  const page = await open();
  await past(page, { timeout: 3000 });
  await page.locator(".win .def", { hasText: "Close" }).click();
  await page.locator("#di-recoup").dblclick();
  await film(page, "clip").waitFor({ timeout: 2000 });
  await page.keyboard.press("x");
  await film(page).waitFor({ state: "detached", timeout: 1000 });
  await page.locator('.win iframe[title="Recoup"]').waitFor({ state: "attached", timeout: 3000 });
  await page.waitForTimeout(2500);
  await shot(page, "clip-live-project");
});

await browser.close();
server.close();
if (errors.length) results.push("FAIL console errors:\n  " + [...new Set(errors)].join("\n  "));
else results.push("PASS no console errors");
console.log(results.at(-1));
const failed = results.filter((r) => r.startsWith("FAIL"));
console.log(`${results.length - failed.length} passed, ${failed.length} failed`);
process.exit(failed.length ? 1 : 0);
