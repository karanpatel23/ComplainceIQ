import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const roots = ["apps", "packages", "tests", "scripts"];
const files = [];

async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!["node_modules", "dist", "data"].includes(entry.name)) await walk(full);
    } else if (entry.name.endsWith(".js") || entry.name.endsWith(".mjs")) {
      files.push(full);
    }
  }
}

for (const root of roots) {
  await walk(root);
}

for (const file of files) {
  const source = await readFile(file, "utf8");
  if (source.includes("\t")) {
    throw new Error(`${file}: tabs are not allowed`);
  }
  if (/\bconsole\.log\(/.test(source) && !file.endsWith("seed.js")) {
    throw new Error(`${file}: use structured responses/errors instead of console.log`);
  }
}

console.error(`Checked ${files.length} JavaScript files.`);
