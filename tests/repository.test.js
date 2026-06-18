import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { FileRepository } from "../packages/db/src/file-repository.js";
import { parseFacilityInput, parseEvidenceInput } from "../packages/shared/src/index.js";

async function repoAt(file) {
  const repo = new FileRepository(file);
  await repo.init();
  return repo;
}

test("file repository persists facilities, evidence, and reviews after reinitialization", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "ciq-repo-"));
  const file = path.join(dir, "db.json");
  const repo = await repoAt(file);
  const org = await repo.createOrganization({ name: "Tenant A" });
  const user = await repo.createUser({ organizationId: org.id, email: "a@example.com", passwordHash: "hash", name: "A", role: "admin", isActive: true });
  const facility = await repo.createFacility(parseFacilityInput({
    name: "Plant A",
    country: "US",
    stateProvince: "MI",
    region: "MI",
    industry: "industrial_manufacturing",
    facilityType: "fabrication",
    employeeCount: 55,
    hazardProfile: { machinery: true, lockoutTagout: true }
  }, org.id));
  const evidence = await repo.createEvidence(parseEvidenceInput({
    facilityId: facility.id,
    title: "LOTO procedure",
    evidenceType: "loto_procedures",
    status: "accepted"
  }, org.id, user.id));
  const review = await repo.createReview({
    organizationId: org.id,
    facilityId: facility.id,
    rulesPackId: "us-industrial-manufacturing-starter",
    country: "US",
    region: "MI",
    readinessScore: 80,
    scoreExplanation: ["No scoring deductions: applicable obligations have current accepted evidence."],
    summary: { totalApplicableObligations: 1, missingEvidenceCount: 0, criticalGapsCount: 0, demoRulesCount: 1, expertReviewedRulesCount: 0 },
    generatedByUserId: user.id,
    gapRows: [{ id: "row", organizationId: org.id, facilityId: facility.id, ruleId: "us-loto-procedures", status: "accepted", priority: "critical" }],
    findings: [],
    actionPlan: []
  });

  const restarted = await repoAt(file);
  assert.equal((await restarted.listFacilities(org.id))[0].id, facility.id);
  assert.equal((await restarted.listEvidence(org.id, facility.id))[0].id, evidence.id);
  assert.equal((await restarted.getReview(org.id, review.id)).readinessScore, 80);
  assert.equal((await restarted.getGapRows(org.id, review.id)).length, 1);
});

test("repository blocks cross-organization access", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "ciq-scope-"));
  const repo = await repoAt(path.join(dir, "db.json"));
  const orgA = await repo.createOrganization({ name: "Tenant A" });
  const orgB = await repo.createOrganization({ name: "Tenant B" });
  const facility = await repo.createFacility(parseFacilityInput({
    name: "Plant A",
    country: "US",
    stateProvince: "OH",
    region: "OH",
    industry: "industrial_manufacturing",
    facilityType: "fabrication",
    employeeCount: 20,
    hazardProfile: { machinery: true }
  }, orgA.id));

  await assert.rejects(() => repo.getFacility(orgB.id, facility.id), /another organization/);
});
