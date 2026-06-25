import { spawn } from "node:child_process";

const apiPort = process.env.PORT || "4000";
const webPort = process.env.WEB_PORT || "5173";
const webHost = process.env.WEB_HOST || "127.0.0.1";
const apiOrigin = process.env.WEB_API_ORIGIN || `http://localhost:${apiPort}`;
const allowedOrigins = process.env.ALLOWED_ORIGINS || [
  `http://localhost:${webPort}`,
  `http://127.0.0.1:${webPort}`,
  `http://localhost:${apiPort}`,
  `http://127.0.0.1:${apiPort}`
].join(",");

const commonEnv = {
  ...process.env,
  DEPLOYMENT_PROFILE: process.env.DEPLOYMENT_PROFILE || "local",
  PROCESS_ROLE: "api-and-worker",
  PORT: apiPort,
  ALLOWED_ORIGINS: allowedOrigins,
  WEB_PORT: webPort,
  WEB_HOST: webHost,
  WEB_API_ORIGIN: apiOrigin
};

const children = [
  start("api", ["--env-file-if-exists=.env", "scripts/start-runtime.mjs", "api-and-worker"], commonEnv),
  start("web", ["apps/web/src/static-server.js"], commonEnv)
];

process.stderr.write("\nComplianceIQ local dev is starting:\n");
process.stderr.write(`  Web UI: ${localWebUrl()}\n`);
process.stderr.write(`  API:    http://localhost:${apiPort}\n`);
process.stderr.write("Press Ctrl+C to stop both processes.\n\n");

let shuttingDown = false;
let exitCode = 0;

for (const child of children) {
  child.once("exit", (code, signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    exitCode = code ?? (signal ? 1 : 0);
    process.stderr.write(`\n${child.spawnargs.at(-1)} stopped; shutting down ComplianceIQ local dev.\n`);
    stopChildren();
  });
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
process.once("exit", stopChildren);

function start(name, args, env) {
  const child = spawn(process.execPath, args, {
    cwd: process.cwd(),
    env,
    stdio: ["ignore", "pipe", "pipe"]
  });
  pipeWithPrefix(child.stdout, name);
  pipeWithPrefix(child.stderr, name);
  child.once("error", (error) => {
    process.stderr.write(`[${name}] ${error.stack || error.message}\n`);
  });
  return child;
}

function pipeWithPrefix(stream, name) {
  let buffered = "";
  stream.setEncoding("utf8");
  stream.on("data", (chunk) => {
    buffered += chunk;
    const lines = buffered.split(/\r?\n/);
    buffered = lines.pop() || "";
    for (const line of lines) {
      if (line.trim().length > 0) process.stderr.write(`[${name}] ${line}\n`);
    }
  });
  stream.on("end", () => {
    if (buffered.trim().length > 0) process.stderr.write(`[${name}] ${buffered}\n`);
  });
}

function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  stopChildren();
}

function stopChildren() {
  for (const child of children) {
    if (!child.killed && child.exitCode === null) child.kill("SIGTERM");
  }
  setTimeout(() => process.exit(exitCode), 250).unref();
}

function localWebUrl() {
  const printableHost = webHost === "127.0.0.1" ? "localhost" : webHost;
  return `http://${printableHost}:${webPort}`;
}
