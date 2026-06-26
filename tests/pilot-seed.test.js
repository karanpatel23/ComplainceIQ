import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { FileRepository } from "../packages/db/src/file-repository.js";
import { assertPilotSeedAllowed, seedSyntheticPilot } from "../packages/db/src/pilot-seed.js";
import { createPrivateStorage } from "../apps/api/src/storage.js";
import { createReviewQueueService } from "../apps/api/src/review-queue-service.js";

test("synthetic pilot seed is local-only, idempotent, multi-jurisdictional, and exercises AI review lineage", async () => {
  assert.throws(() => assertPilotSeedAllowed({ isProduction: true, deploymentProfile: "closed-pilot", enableDemoData: true, adminPassword: "secret" }), /local/);
  assert.throws(() => assertPilotSeedAllowed({ isProduction: false, deploymentProfile: "local", enableDemoData: false, adminPassword: "secret" }), /ENABLE_DEMO_DATA/);

  const dir = await mkdtemp(path.join(os.tmpdir(), "ciq-pilot-seed-"));
  const repo = new FileRepository(path.join(dir, "db.json"));
  await repo.init();
  const config = {
    isProduction: false,
    deploymentProfile: "local",
    enableDemoData: true,
    adminEmail: "admin@complianceiq.local",
    adminPassword: "SyntheticPassword#2026",
    aiMaxFileTextChars: 12_000,
    maxUploadMb: 5,
    storageBackend: "local",
    uploadStorageBackend: "local",
    uploadDir: path.join(dir, "storage")
  };
  const storage = createPrivateStorage(config);
  const first = await seedSyntheticPilot({ config, repo, storage });
  const second = await seedSyntheticPilot({ config, repo, storage });
  assert.equal(first.organization.id, second.organization.id);
  assert.deepEqual(first.facilities.map((facility) => facility.country).sort(), ["CA", "MX", "US"]);
  assert.equal((await repo.listFacilities(first.organization.id)).length, 3);

  const analyses = [];
  for (const facility of first.facilities) {
    const evidence = await repo.listEvidence(first.organization.id, facility.id);
    assert.ok(evidence.every((item) => item.title.startsWith("Synthetic") && item.description.includes("Synthetic")));
    analyses.push(...await repo.listAiAnalyses(first.organization.id, facility.id));
    assert.equal((await repo.listReviews(first.organization.id, facility.id)).length, 1);
    assert.equal((await repo.listAuditPackets(first.organization.id, facility.id)).length, 1);
  }
  assert.equal(analyses.length, 4);
  assert.ok(analyses.every((analysis) => analysis.provider === "mock"));
  assert.ok(analyses.some((analysis) => analysis.needsHumanReview));
  const queue = await createReviewQueueService({ repo }).list({ organizationId: first.organization.id });
  assert.ok(queue.some((item) => item.categories.includes("unmatched")));
  assert.ok((await repo.listAuditLogs(first.organization.id)).some((entry) => entry.action === "synthetic_pilot_dataset_loaded"));
});
