import { mkdir, writeFile } from "node:fs/promises";
import { generateAuditPacketPdf } from "../packages/pdf/src/index.js";

const evidence = [{ id: "evidence-1", title: "Forklift Operator Training Certificate", evidenceType: "forklift_training_records", status: "accepted" }];
const gapRows = Array.from({ length: 24 }, (_, index) => ({
  priority: index === 0 ? "high" : "medium",
  status: index === 0 ? "accepted" : "missing",
  authority: "OSHA",
  citation: `29 CFR 1910.${100 + index}`,
  obligationTitle: `Industrial evidence obligation ${index + 1}`,
  requiredEvidence: [index === 0 ? "forklift_training_records" : "supporting_record"],
  matchedEvidence: index === 0 ? [{ id: "evidence-1", matchSource: "human_reviewed" }] : []
}));

const pdf = generateAuditPacketPdf({
  facility: { name: "Example Components Plant", country: "US", region: "OH", industry: "industrial_manufacturing", facilityType: "metal_fabrication", employeeCount: 84, hazardProfile: { machinery: true, forklifts: true } },
  review: { readinessScore: 54, scoreExplanation: ["-15 pts: 1 high-priority obligation missing required evidence"], summary: { totalApplicableObligations: 24, missingEvidenceCount: 23, criticalGapsCount: 0, demoRulesCount: 24 } },
  gapRows,
  actionItems: [{ bucket: "30_days", title: "Review forklift training evidence", ownerRole: "Operations Manager", dueDate: "2026-07-19" }],
  evidence,
  rulesPack: { name: "United States Industrial Manufacturing Starter Pack", rulesPackId: "us-industrial-manufacturing-starter" },
  findings: [{ severity: "high", title: "Training evidence requires review" }],
  aiAnalyses: [{
    evidenceId: "evidence-1", detectedEvidenceType: "forklift_training_records", confidence: 0.92,
    processingStatus: "processed", extractedDocumentDate: "2025-03-14", extractedExpirationDate: "2028-03-14",
    extractedEmployeeNames: ["Sample Operator"], extractedEquipmentNames: ["Forklift"], extractedChemicalNames: [], extractedSignaturePresent: true,
    suggestedObligationTitle: "Powered industrial truck training", matchReason: "Detected type agrees with deterministic evidence taxonomy.",
    humanReviewed: true, needsHumanReview: false, issues: []
  }]
});

await mkdir("tmp/pdfs", { recursive: true });
await writeFile("tmp/pdfs/ai-lineage-packet.pdf", pdf);
process.stderr.write("Generated tmp/pdfs/ai-lineage-packet.pdf\n");
