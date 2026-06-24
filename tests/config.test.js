import test from "node:test";
import assert from "node:assert/strict";
import { readConfig, readRepositoryConfig } from "../packages/config/src/index.js";

const productionEnv = {
  NODE_ENV: "production",
  PORT: "4000",
  APP_URL: "https://app.complianceiq.example",
  ALLOWED_ORIGINS: "https://app.complianceiq.example",
  DATABASE_URL: "postgresql://user:password@db.example.com:5432/complianceiq",
  REPOSITORY_BACKEND: "postgres",
  SESSION_SECRET: "replace-with-at-least-thirty-two-characters",
  STORAGE_BACKEND: "s3",
  S3_BUCKET: "complianceiq-private",
  S3_REGION: "ca-central-1",
  MAX_UPLOAD_MB: "25"
};

test("production config fails fast when core env vars are missing", () => {
  const { DATABASE_URL, ...missingDatabase } = productionEnv;
  assert.throws(() => readConfig(missingDatabase), /DATABASE_URL/);
});

test("production config rejects wildcard CORS and weak session secrets", () => {
  assert.throws(() => readConfig({ ...productionEnv, ALLOWED_ORIGINS: "*" }), /ALLOWED_ORIGINS/);
  assert.throws(() => readConfig({ ...productionEnv, SESSION_SECRET: "short" }), /SESSION_SECRET/);
  assert.throws(() => readConfig({ ...productionEnv, ENABLE_DEMO_DATA: "true" }), /ENABLE_DEMO_DATA/);
});

test("production config rejects invalid ports and origins", () => {
  assert.throws(() => readConfig({ ...productionEnv, PORT: "70000" }), /PORT/);
  assert.throws(() => readConfig({ ...productionEnv, ALLOWED_ORIGINS: "not-a-url" }), /valid absolute HTTPS URLs/);
  assert.throws(() => readConfig({ ...productionEnv, APP_URL: "http://app.complianceiq.example" }), /HTTPS/);
});

test("production config accepts optional integrations as absent", () => {
  const config = readConfig(productionEnv);
  assert.equal(config.repositoryBackend, "postgres");
  assert.equal(config.databaseUrl, productionEnv.DATABASE_URL);
  assert.equal(config.enableDemoData, false);
  assert.equal(config.storageBackend, "s3");
});

test("production storage and malware scanning config fail safely", () => {
  assert.throws(() => readConfig({ ...productionEnv, STORAGE_BACKEND: "local" }), /must be s3/);
  assert.throws(() => readConfig({ ...productionEnv, S3_BUCKET: "" }), /S3_BUCKET/);
  assert.throws(() => readConfig({ ...productionEnv, MALWARE_SCAN_ENABLED: "true", MALWARE_SCANNER_PROVIDER: "mock" }), /mock is not allowed/);
  const local = readConfig({ NODE_ENV: "development", REPOSITORY_BACKEND: "file", STORAGE_BACKEND: "local" });
  assert.equal(local.queueMaxRetries, 3);
  assert.equal(local.queueLeaseMs, 300000);
  assert.equal(local.malwareScanEnabled, false);
  assert.equal(local.malwareScanFailPolicy, "open");
  assert.throws(() => readConfig({ ...productionEnv, MALWARE_SCAN_ENABLED: "true", MALWARE_SCAN_REQUIRED_IN_PRODUCTION: "true", MALWARE_SCANNER_PROVIDER: "clamav", MALWARE_SCAN_FAIL_POLICY: "open" }), /non-mock scanner adapter/);
  const hardened = readConfig({ ...productionEnv, MALWARE_SCAN_ENABLED: "true", MALWARE_SCAN_REQUIRED_IN_PRODUCTION: "true", MALWARE_SCANNER_PROVIDER: "clamav", MALWARE_SCAN_FAIL_POLICY: "closed", CLAMAV_HOST: "clamav.internal" });
  assert.equal(hardened.malwareScannerProvider, "clamav");
  assert.equal(hardened.malwareScanFailPolicy, "closed");
});

test("repository config requires Postgres in production without requiring unrelated runtime settings", () => {
  assert.throws(() => readRepositoryConfig({ NODE_ENV: "production", REPOSITORY_BACKEND: "file" }), /must be postgres/);
  const config = readRepositoryConfig({ NODE_ENV: "production", REPOSITORY_BACKEND: "postgres", DATABASE_URL: productionEnv.DATABASE_URL });
  assert.equal(config.repositoryBackend, "postgres");
  assert.equal(config.databaseUrl, productionEnv.DATABASE_URL);
});

test("AI is optional and OpenAI configuration is required only when enabled", () => {
  const disabled = readConfig({ NODE_ENV: "development", REPOSITORY_BACKEND: "file", AI_ENABLED: "false" });
  assert.equal(disabled.aiEnabled, false);
  assert.throws(() => readConfig({ NODE_ENV: "development", REPOSITORY_BACKEND: "file", AI_ENABLED: "true" }), /OPENAI_API_KEY and OPENAI_MODEL/);
  const mock = readConfig({
    NODE_ENV: "development",
    REPOSITORY_BACKEND: "file",
    AI_ENABLED: "true",
    AI_PROVIDER: "mock",
    AI_CONFIDENCE_THRESHOLD: "0.8",
    AI_REVIEW_REQUIRED_THRESHOLD: "0.7"
  });
  assert.equal(mock.aiProvider, "mock");
  assert.throws(() => readConfig({ ...productionEnv, AI_ENABLED: "true", AI_PROVIDER: "mock" }), /not allowed in production/);
});
