import test from "node:test";
import assert from "node:assert/strict";
import { AI_EVIDENCE_DISCLAIMER, generateAuditPacketPdf } from "../packages/pdf/src/index.js";

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
  assert.ok(buffer.toString("utf8").includes("AI analysis was disabled"));
});

test("audit packet includes AI lineage and paginates long content", () => {
  const evidence = [{ id: "e1", title: "Forklift certificate", evidenceType: "forklift_training_records", status: "accepted", scanStatus: "scan_clean", reviewerNotes: "Verified against training roster." }];
  const gapRows = Array.from({ length: 55 }, (_, index) => ({
    priority: index === 0 ? "high" : "medium",
    status: index === 0 ? "accepted" : "missing",
    authority: "OSHA",
    citation: `29 CFR 1910.${index}`,
    obligationTitle: `Evidence obligation ${index}`,
    requiredEvidence: ["forklift_training_records"],
    matchedEvidence: index === 0 ? [{ id: "e1", matchSource: "human_reviewed" }] : []
  }));
  const buffer = generateAuditPacketPdf({
    facility: { name: "Plant", country: "US", region: "OH", industry: "industrial_manufacturing", facilityType: "fabrication", employeeCount: 10, hazardProfile: {} },
    review: { readinessScore: 85, scoreExplanation: ["-15 pts: 1 high-priority obligation missing required evidence"], summary: { totalApplicableObligations: 55, missingEvidenceCount: 54, criticalGapsCount: 0, demoRulesCount: 55 } },
    gapRows,
    actionItems: [],
    evidence,
    rulesPack: { name: "United States Industrial Manufacturing Starter Pack", rulesPackId: "us-industrial-manufacturing-starter" },
    findings: [],
    aiAnalyses: [{
      evidenceId: "e1", detectedEvidenceType: "forklift_training_records", confidence: 0.92,
      processingStatus: "processed", textExtractionStatus: "extracted", analysisVersion: 2, processingJobId: "job-2",
      extractedDocumentDate: "2025-03-14", extractedExpirationDate: "2028-03-14",
      suggestedObligationTitle: "Powered industrial truck training", matchReason: "Type agreement", humanReviewed: true,
      needsHumanReview: false, issues: []
    }]
  });
  const text = buffer.toString("utf8");
  assert.ok(text.includes("AI Evidence Intelligence and Audit Lineage"));
  assert.ok(text.includes(AI_EVIDENCE_DISCLAIMER.slice(0, 70)));
  assert.ok(text.includes("human_reviewed"));
  assert.ok(text.includes("Analysis version: 2"));
  assert.ok(text.includes("Scan: scan_clean"));
  assert.ok(text.includes("Processing and Review Summary"));
  assert.match(text, /\/Count [2-9]/);
});
