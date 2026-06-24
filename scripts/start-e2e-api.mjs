import { rm } from "node:fs/promises";

const databasePath = "/tmp/complianceiq-e2e-db.json";
const storagePath = "/tmp/complianceiq-e2e-storage";
await rm(databasePath, { force: true });
await rm(storagePath, { recursive: true, force: true });

Object.assign(process.env, {
  NODE_ENV: "test",
  REPOSITORY_BACKEND: "file",
  FILE_REPOSITORY_PATH: databasePath,
  STORAGE_BACKEND: "local",
  UPLOAD_DIR: storagePath,
  MAX_UPLOAD_MB: "5",
  SESSION_SECRET: "e2e-session-secret-with-enough-length",
  APP_URL: "http://127.0.0.1:5174",
  ALLOWED_ORIGINS: "http://127.0.0.1:5174",
  AI_ENABLED: "false",
  MALWARE_SCAN_ENABLED: "false",
  QUEUE_POLL_MS: "250"
});

const [{ server, repo }, { hashPassword }] = await Promise.all([
  import("../apps/api/src/server.js"),
  import("../apps/api/src/security.js")
]);
const organization = await repo.createOrganization({ name: "Playwright Pilot Organization" });
await repo.createUser({
  organizationId: organization.id,
  email: "pilot-admin@complianceiq.local",
  passwordHash: await hashPassword("PilotPassword#2026"),
  name: "Pilot Admin",
  role: "admin",
  isActive: true
});

server.listen(4100, "127.0.0.1");

const shutdown = () => server.close(async () => {
  await repo.close?.();
  process.exit(0);
});
process.once("SIGTERM", shutdown);
process.once("SIGINT", shutdown);
