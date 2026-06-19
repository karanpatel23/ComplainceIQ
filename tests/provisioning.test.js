import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { verifyPassword } from "../apps/api/src/security.js";
import { FileRepository } from "../packages/db/src/file-repository.js";
import { parseInitialAdminInput, provisionInitialAdmin } from "../packages/db/src/provisioning.js";

test("initial admin input requires explicit identity and a strong password", () => {
  assert.throws(() => parseInitialAdminInput({}), /PROVISION_ORGANIZATION_NAME/);
  assert.throws(() => parseInitialAdminInput({
    PROVISION_ORGANIZATION_NAME: "Plant Group",
    PROVISION_ADMIN_NAME: "Admin",
    PROVISION_ADMIN_EMAIL: "admin@example.com",
    PROVISION_ADMIN_PASSWORD: "too-short"
  }), /at least 14 characters/);
});

test("initial admin provisioning creates one audited administrator and refuses overwrite", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "ciq-provision-"));
  const repo = new FileRepository(path.join(dir, "db.json"));
  await repo.init();
  const input = parseInitialAdminInput({
    PROVISION_ORGANIZATION_NAME: "Plant Group",
    PROVISION_ADMIN_NAME: "Operations Admin",
    PROVISION_ADMIN_EMAIL: "ADMIN@example.com",
    PROVISION_ADMIN_PASSWORD: "strong-admin-password"
  });

  const result = await provisionInitialAdmin(repo, input);
  const stored = await repo.findUserByEmail("admin@example.com");
  const auditLogs = await repo.listAuditLogs(result.organization.id);

  assert.equal(result.admin.email, "admin@example.com");
  assert.equal(result.admin.role, "admin");
  assert.equal("passwordHash" in result.admin, false);
  assert.equal(await verifyPassword(input.password, stored.passwordHash), true);
  assert.equal(auditLogs[0].action, "organization.initial_admin_provisioned");
  assert.deepEqual(auditLogs[0].metadata, { method: "provisioning_cli" });
  await assert.rejects(() => provisionInitialAdmin(repo, input), /already exists/);
});
