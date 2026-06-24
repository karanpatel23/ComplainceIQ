import { spawn } from "node:child_process";

const required = ["TEST_S3_BUCKET", "TEST_S3_REGION", "TEST_S3_ACCESS_KEY_ID", "TEST_S3_SECRET_ACCESS_KEY"];
const missing = required.filter((name) => !process.env[name]);
if (missing.length > 0) {
  process.stdout.write(`SKIPPED: missing S3 validation variables: ${missing.join(", ")}.\n`);
  process.exit(0);
}
if (process.env.VALIDATION_TARGET === "production" && process.env.ALLOW_PRODUCTION_VALIDATION !== "true") {
  throw new Error("Refusing production-targeted object-storage validation without ALLOW_PRODUCTION_VALIDATION=true.");
}

process.stdout.write("Validating private S3 upload, authorized retrieval, bounded signing, public denial, tenant route scoping, and cleanup...\n");
const code = await run(process.execPath, ["--test", "tests/storage.test.js", "tests/api.test.js"], { ...process.env, API_TEST_USE_S3: "true" });
if (code !== 0) process.exit(code);
process.stdout.write("PASS: live private-storage validation completed and the test object was deleted.\n");

function run(command, args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { env, stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (code) => resolve(code ?? 1));
  });
}
