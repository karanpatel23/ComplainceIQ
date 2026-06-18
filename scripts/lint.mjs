import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const roots = ["apps", "packages", "tests"];
const files = [];
const forbiddenProductClaims = [
  "guaranteed compliance",
  "certified compliant",
  "OSHA approved",
  "EPA approved",
  "all regulations covered"
];

async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!["node_modules", "dist", "data"].includes(entry.name)) await walk(full);
    } else if (/\.(js|mjs|html|css|md)$/.test(entry.name)) {
      files.push(full);
    }
  }
}

for (const root of roots) {
  await walk(root);
}

for (const file of files) {
  const source = await readFile(file, "utf8");
  const lower = source.toLowerCase();
  if (source.includes(["Math", "random"].join("."))) {
    throw new Error(`${file}: Math.random is forbidden in ComplianceIQ scoring/product logic`);
  }
  for (const claim of forbiddenProductClaims) {
    if (lower.includes(claim.toLowerCase())) {
      throw new Error(`${file}: forbidden product claim "${claim}"`);
    }
  }
}

console.error(`Linted ${files.length} files.`);
