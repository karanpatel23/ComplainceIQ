import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { FileRepository } from "../packages/db/src/file-repository.js";
import { parseFacilityInput, parseEvidenceInput } from "../packages/shared/src/index.js";
import { generateReview } from "../packages/rules/src/index.js";

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
  const generated = generateReview({ facility, evidence: [evidence], now: new Date("2026-06-18T12:00:00Z") });
  const review = await repo.createReview({
    organizationId: org.id,
    facilityId: facility.id,
    rulesPackId: generated.rulesPack.rulesPackId,
    country: generated.country,
    region: generated.region,
    readinessScore: generated.readinessScore,
    scoreExplanation: generated.scoreExplanation,
    summary: generated.summary,
    generatedByUserId: user.id,
    evidenceMatches: generated.evidenceMatches,
    gapRows: generated.gapRows,
    findings: generated.findings,
    actionPlan: generated.actionPlan
  });
  const packet = await repo.createAuditPacket({
    organizationId: org.id,
    facilityId: facility.id,
    reviewId: review.id,
    title: "Industrial Audit Readiness Packet",
    fileReference: "packet.pdf",
    generatedByUserId: user.id,
    country: facility.country,
    region: facility.region,
    rulesPackId: generated.rulesPack.rulesPackId,
    status: "generated"
  });

  const restarted = await repoAt(file);
  assert.equal((await restarted.listFacilities(org.id))[0].id, facility.id);
  assert.equal((await restarted.listEvidence(org.id, facility.id))[0].id, evidence.id);
  assert.equal((await restarted.getReview(org.id, review.id)).readinessScore, generated.readinessScore);
  assert.equal((await restarted.getGapRows(org.id, review.id)).length, generated.gapRows.length);
  assert.ok((await restarted.getActionItems(org.id, review.id)).length > 0);
  assert.ok((await restarted.getEvidenceMatches(org.id, facility.id)).some((match) => match.evidenceId === evidence.id));
  assert.equal((await restarted.listAuditPackets(org.id, facility.id))[0].id, packet.id);
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
