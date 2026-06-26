import { spawn } from "node:child_process";

const databaseUrl = process.env.TEST_DATABASE_URL || process.env.STAGING_DATABASE_URL || "";
if (!databaseUrl) {
  process.stdout.write("SKIPPED: set TEST_DATABASE_URL or STAGING_DATABASE_URL to validate PostgreSQL.\n");
  process.exit(0);
}
if (process.env.VALIDATION_TARGET === "production" && process.env.ALLOW_PRODUCTION_VALIDATION !== "true") {
  throw new Error("Refusing production-targeted PostgreSQL validation without ALLOW_PRODUCTION_VALIDATION=true. An isolated schema is still used.");
}

process.stdout.write("Validating migrations, persistence, queue processing, tenant isolation, and cleanup in an isolated PostgreSQL schema...\n");
const code = await run(process.execPath, ["--test", "tests/postgres-repository.test.js"], {
  ...process.env,
  TEST_DATABASE_URL: databaseUrl
});
if (code !== 0) process.exit(code);
process.stdout.write("PASS: live PostgreSQL validation completed and the isolated schema was removed.\n");

function run(command, args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { env, stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (code) => resolve(code ?? 1));
  });
}
