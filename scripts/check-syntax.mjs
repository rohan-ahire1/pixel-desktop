// Syntax-checks every file in js/. The site has no build, so nothing else would catch a typo before a visitor does.
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";

const root = join(import.meta.dirname, ".."), tmp = mkdtempSync(join(tmpdir(), "syntax-"));
const files = readdirSync(join(root, "js"), { recursive: true }).filter((f) => f.endsWith(".js")).map((f) => join(root, "js", f));
let bad = 0;
files.forEach((file, i) => {
  const copy = join(tmp, i + ".mjs");
  copyFileSync(file, copy);
  const r = spawnSync(process.execPath, ["--check", copy], { encoding: "utf8" });
  if (r.status !== 0) { bad++; console.error(relative(root, file) + "\n" + r.stderr); }
});
rmSync(tmp, { recursive: true });
console.log(`${files.length} files checked, ${bad} with errors`);
process.exit(bad ? 1 : 0);
