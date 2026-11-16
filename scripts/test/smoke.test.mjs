import "./env.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { freshFs } from "./env.mjs";

test("file tree has the computer and project paths", async () => {
  const fs = await freshFs();
  assert.ok(fs.node("computer"));
  assert.equal(fs.pathOf("projects"), "C:\\Projects");
});

test("projects list is not empty", async () => {
  const { PROJECTS } = await import("../../js/data.js");
  assert.ok(PROJECTS.length > 0);
});
