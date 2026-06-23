import test from "node:test";
import assert from "node:assert/strict";
import { generateReview, getApplicableRules, computeReadinessScore } from "../packages/rules/src/index.js";

function facility(overrides = {}) {
  return {
    id: "facility_1",
    organizationId: "org_1",
    name: "Demo Plant",
    country: "US",
    stateProvince: "OH",
    region: "OH",
    jurisdictionCode: "US-OH",
    industry: "industrial_manufacturing",
    facilityType: "metal_fabrication",
    employeeCount: 80,
    hazardProfile: {
      machinery: true,
      hazardousChemicals: true,
      sdsRequired: true,
      forklifts: true,
      lockoutTagout: true,
      ppe: true,
      respiratoryHazards: true,
      hearingNoise: true,
      hazardousWaste: true,
      oilFuelStorage: true,
      emergencyActionPlan: true,
      fireExtinguishers: true
    },
    ...overrides
  };
}

test("rules pack selection is jurisdiction-specific", () => {
  const us = getApplicableRules(facility({ country: "US", region: "OH" }));
  const ca = getApplicableRules(facility({ country: "CA", region: "ON", stateProvince: "ON", jurisdictionCode: "CA-ON" }));
  const mx = getApplicableRules(facility({ country: "MX", region: "NL", stateProvince: "NL", jurisdictionCode: "MX-NL" }));

  assert.equal(us.rulesPack.country, "US");
  assert.equal(ca.rulesPack.country, "CA");
  assert.equal(mx.rulesPack.country, "MX");
  assert.ok(us.rules.some((rule) => rule.authority === "OSHA" || rule.authority === "EPA"));
  assert.ok(ca.rules.every((rule) => rule.authority !== "OSHA" && rule.authority !== "EPA"));
  assert.ok(mx.rules.every((rule) => rule.authority !== "OSHA" && rule.authority !== "EPA"));
});

test("readiness scoring is deterministic and explainable", () => {
  const inputFacility = facility();
  const evidence = [
    { id: "e1", title: "Current SDS binder", evidenceType: "sds_library", status: "accepted", confidence: "high", expirationDate: "2030-01-01" },
    { id: "e2", title: "Old LOTO procedure", evidenceType: "loto_procedures", status: "expired", confidence: "medium", expirationDate: "2020-01-01" },
    { id: "e3", title: "Rejected manifest", evidenceType: "hazardous_waste_manifests", status: "rejected", confidence: "low" }
  ];
  const now = new Date("2026-06-18T12:00:00Z");
  const first = generateReview({ facility: inputFacility, evidence, now });
  const second = generateReview({ facility: inputFacility, evidence, now });

  assert.equal(first.readinessScore, second.readinessScore);
  assert.deepEqual(first.scoreExplanation, second.scoreExplanation);
  assert.ok(first.scoreExplanation.some((line) => line.includes("critical obligation")));
  assert.ok(first.scoreExplanation.some((line) => line.includes("expired evidence item")));
  assert.ok(first.scoreExplanation.some((line) => line.includes("rejected evidence item")));
});

test("score formula clamps to zero", () => {
  const rows = Array.from({ length: 10 }, (_, i) => ({
    id: `row_${i}`,
    priority: "critical",
    status: "missing",
    expiredEvidenceCount: 1,
    rejectedEvidenceCount: 1
  }));
  const score = computeReadinessScore(rows);
  assert.equal(score.readinessScore, 0);
});

test("suspicious evidence never counts as accepted", () => {
  const result = generateReview({
    facility: facility(),
    evidence: [{ id: "blocked", title: "Blocked LOTO", evidenceType: "loto_procedures", status: "accepted", scanStatus: "scan_suspicious", confidence: "high" }],
    now: new Date("2026-06-18T12:00:00Z")
  });
  const loto = result.gapRows.find((row) => row.ruleId === "us-loto-procedures");
  assert.notEqual(loto.status, "accepted");
});
