import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

test("scoring and product logic avoid non-deterministic score APIs", async () => {
  const files = [];
  async function walk(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (entry.name.endsWith(".js")) files.push(full);
    }
  }
  await walk("packages/rules/src");
  await walk("apps/api/src");
  for (const file of files) {
    const source = await readFile(file, "utf8");
    assert.equal(source.includes(["Math", "random"].join(".")), false, `${file} uses forbidden random scoring API`);
  }
});
