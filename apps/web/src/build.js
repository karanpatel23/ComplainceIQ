import { mkdir, copyFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "dist");
const apiBase = process.env.WEB_API_ORIGIN || "http://localhost:4000";
const isProductionBuild = process.env.NODE_ENV === "production" || process.env.VERCEL === "1";

if (isProductionBuild) {
  let parsed;
  try {
    parsed = new URL(apiBase);
  } catch {
    throw new Error("WEB_API_ORIGIN must be an absolute HTTPS URL for production frontend builds.");
  }
  if (parsed.protocol !== "https:" || ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname)) {
    throw new Error("WEB_API_ORIGIN must be a deployed HTTPS API origin for production frontend builds; localhost is only for local development.");
  }
}

await mkdir(path.join(out, "src"), { recursive: true });
await copyFile(path.join(root, "index.html"), path.join(out, "index.html"));
await copyFile(path.join(root, "src/app.js"), path.join(out, "src/app.js"));
await copyFile(path.join(root, "src/styles.css"), path.join(out, "src/styles.css"));
await writeFile(path.join(out, "config.js"), `window.COMPLIANCEIQ_CONFIG = ${JSON.stringify({ apiBase })};\n`);
process.stderr.write(`Built static web app to apps/web/dist with API ${apiBase}\n`);
