import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";

const port = Number.parseInt(process.env.WEB_PORT || "5173", 10);
const host = process.env.WEB_HOST || "127.0.0.1";
const root = path.resolve("apps/web");

const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" };

http.createServer(async (req, res) => {
  const requested = req.url === "/" ? "/index.html" : req.url;
  const filePath = path.resolve(root, `.${requested}`);
  if (!filePath.startsWith(root)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  try {
    const body = await readFile(filePath);
    res.writeHead(200, { "Content-Type": types[path.extname(filePath)] || "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
}).listen(port, host, () => {
  process.stderr.write(`ComplianceIQ web listening on http://${host}:${port}\n`);
});
