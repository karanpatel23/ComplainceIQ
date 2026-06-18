import test from "node:test";
import assert from "node:assert/strict";
import { generateAuditPacketPdf } from "../packages/pdf/src/index.js";

test("audit packet generator returns a PDF buffer with required title", () => {
  const buffer = generateAuditPacketPdf({
    facility: { name: "Plant", country: "US", region: "OH", industry: "industrial_manufacturing", facilityType: "fabrication", employeeCount: 10, hazardProfile: {} },
    review: { readinessScore: 70, scoreExplanation: ["-15 pts: 1 high-priority obligation missing required evidence"], summary: { totalApplicableObligations: 1, missingEvidenceCount: 1, criticalGapsCount: 0, demoRulesCount: 1 } },
    gapRows: [],
    actionItems: [],
    evidence: [],
    rulesPack: { name: "United States Industrial Manufacturing Starter Pack", rulesPackId: "us-industrial-manufacturing-starter" },
    findings: []
  });
  assert.ok(buffer.subarray(0, 4).toString() === "%PDF");
  assert.ok(buffer.toString("utf8").includes("Industrial Audit Readiness Packet"));
});
