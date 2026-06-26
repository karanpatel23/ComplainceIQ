import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

test("external validation commands skip clearly when infrastructure is not configured", () => {
  const cases = [
    ["scripts/validate-postgres.mjs", ["TEST_DATABASE_URL", "STAGING_DATABASE_URL"]],
    ["scripts/validate-storage.mjs", ["TEST_S3_BUCKET", "TEST_S3_REGION", "TEST_S3_ACCESS_KEY_ID", "TEST_S3_SECRET_ACCESS_KEY"]],
    ["scripts/validate-scanner.mjs", ["MALWARE_SCAN_ENABLED", "MALWARE_SCANNER_PROVIDER", "CLAMAV_HOST"]]
  ];
  for (const [script, removed] of cases) {
    const env = { ...process.env };
    for (const name of removed) delete env[name];
    const result = spawnSync(process.execPath, [script], { env, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /SKIPPED:/);
  }
});
