import test from "node:test";
import assert from "node:assert/strict";
import { readConfig } from "../packages/config/src/index.js";

const productionEnv = {
  NODE_ENV: "production",
  PORT: "4000",
  APP_URL: "https://app.complianceiq.example",
  ALLOWED_ORIGINS: "https://app.complianceiq.example",
  DATABASE_URL: "postgresql://user:password@db.example.com:5432/complianceiq",
  REPOSITORY_BACKEND: "postgres",
  SESSION_SECRET: "replace-with-at-least-thirty-two-characters",
  UPLOAD_STORAGE_BACKEND: "local",
  UPLOAD_DIR: "data/private-storage",
  MAX_UPLOAD_MB: "25"
};

test("production config fails fast when core env vars are missing", () => {
  const { DATABASE_URL, ...missingDatabase } = productionEnv;
  assert.throws(() => readConfig(missingDatabase), /DATABASE_URL/);
});

test("production config rejects wildcard CORS and weak session secrets", () => {
  assert.throws(() => readConfig({ ...productionEnv, ALLOWED_ORIGINS: "*" }), /ALLOWED_ORIGINS/);
  assert.throws(() => readConfig({ ...productionEnv, SESSION_SECRET: "short" }), /SESSION_SECRET/);
});

test("production config accepts optional integrations as absent", () => {
  const config = readConfig(productionEnv);
  assert.equal(config.repositoryBackend, "postgres");
  assert.equal(config.databaseUrl, productionEnv.DATABASE_URL);
  assert.equal(config.enableDemoData, false);
});
