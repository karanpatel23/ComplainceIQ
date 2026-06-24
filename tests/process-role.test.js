import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomInt, randomUUID } from "node:crypto";
import os from "node:os";
import path from "node:path";

test("API-only and worker-only processes expose role-correct readiness", async () => {
  const apiPort = randomInt(46_000, 48_000);
  const workerPort = randomInt(48_001, 50_000);
  const api = startRole("api", { PORT: String(apiPort), WORKER_HEALTH_PORT: String(workerPort + 1) });
  try {
    const ready = await waitForJson(`http://127.0.0.1:${apiPort}/health/ready`, api);
    assert.equal(ready.processRole, "api");
    assert.equal(ready.queue.ok, true);
    assert.equal(ready.queue.workerRunning, false);
  } finally {
    await stop(api);
  }

  const worker = startRole("worker", { PORT: String(apiPort + 1), WORKER_HEALTH_PORT: String(workerPort) });
  try {
    const ready = await waitForJson(`http://127.0.0.1:${workerPort}/health/ready`, worker);
    assert.equal(ready.processRole, "worker");
    assert.equal(ready.queue.ok, true);
    assert.equal(ready.queue.workerRunning, true);
    const metrics = await (await fetch(`http://127.0.0.1:${workerPort}/metrics`)).json();
    assert.equal(metrics.queue.workerRunning, true);
  } finally {
    await stop(worker);
  }
});

function startRole(role, overrides) {
  const suffix = randomUUID();
  return spawn(process.execPath, ["apps/api/src/server.js"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NODE_ENV: "development",
      DEPLOYMENT_PROFILE: "local",
      PROCESS_ROLE: role,
      REPOSITORY_BACKEND: "file",
      DATABASE_URL: "",
      FILE_REPOSITORY_PATH: path.join(os.tmpdir(), `ciq-role-${role}-${suffix}.json`),
      STORAGE_BACKEND: "local",
      UPLOAD_DIR: path.join(os.tmpdir(), `ciq-role-storage-${role}-${suffix}`),
      SESSION_SECRET: "process-role-test-secret-with-enough-length",
      AI_ENABLED: "false",
      MALWARE_SCAN_ENABLED: "false",
      LOG_LEVEL: "error",
      ...overrides
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
}

async function waitForJson(url, child) {
  let stderr = "";
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (child.exitCode !== null) throw new Error(`Role process exited early: ${stderr}`);
    try {
      const response = await fetch(url);
      if (response.ok) return response.json();
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Timed out waiting for ${url}: ${stderr}`);
}

async function stop(child) {
  if (child.exitCode !== null) return;
  child.kill("SIGTERM");
  await new Promise((resolve) => child.once("exit", resolve));
}
