import { mkdir, copyFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "dist");
await mkdir(path.join(out, "src"), { recursive: true });
await copyFile(path.join(root, "index.html"), path.join(out, "index.html"));
await copyFile(path.join(root, "src/app.js"), path.join(out, "src/app.js"));
await copyFile(path.join(root, "src/styles.css"), path.join(out, "src/styles.css"));
process.stderr.write("Built static web app to apps/web/dist\n");
