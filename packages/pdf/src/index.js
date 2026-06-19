const DISCLAIMER = "This packet is intended for audit-preparation and evidence organization support only. It is not legal advice, does not guarantee compliance, and does not represent certification or approval by OSHA, EPA, Canadian federal/provincial regulators, Mexican STPS/SEMARNAT, or any other regulator. Demo or unverified rules are clearly labeled.";
const AI_DISCLAIMER = "AI-assisted evidence analysis is provided for audit-preparation support only. It may classify documents, extract fields, and suggest evidence matches, but it does not provide legal advice, guarantee compliance, or certify that evidence satisfies any regulatory requirement. Human or expert review is recommended before relying on this packet.";

export function buildAuditPacketLines({ facility, review, gapRows, actionItems, evidence, rulesPack, findings, aiAnalyses = [] }) {
  const criticalMissing = gapRows.filter((row) => row.priority === "critical" && row.status !== "accepted");
  const acceptedEvidence = evidence.filter((item) => item.status === "accepted");
  const expiredRejected = evidence.filter((item) => ["expired", "rejected"].includes(item.status));
  const lines = [
    "Industrial Audit Readiness Packet",
    `Facility: ${facility.name}`,
    `Jurisdiction: ${facility.country} / ${facility.region}`,
    `Rules Pack: ${rulesPack.name} (${rulesPack.rulesPackId})`,
    `Generated: ${new Date().toISOString()}`,
    "",
    "Disclaimer",
    DISCLAIMER,
    "",
    "Facility Profile",
    `Industry: ${facility.industry}`,
    `Facility type: ${facility.facilityType}`,
    `Employee count: ${facility.employeeCount}`,
    `Hazard profile: ${Object.entries(facility.hazardProfile || {}).filter(([, value]) => value).map(([key]) => key).join(", ") || "No hazards selected"}`,
    "",
    "Readiness Score",
    `${review.readinessScore}/100`,
    ...review.scoreExplanation,
    "",
    "Executive Summary",
    `${review.summary.totalApplicableObligations} applicable obligations`,
    `${review.summary.missingEvidenceCount} missing evidence rows`,
    `${review.summary.criticalGapsCount} critical gaps`,
    `${review.summary.demoRulesCount} demo or unverified rules`,
    "",
    "Evidence Gap Matrix",
    ...gapRows.map((row) => `${row.priority.toUpperCase()} | ${row.status} | ${row.authority} ${row.citation} | ${row.obligationTitle} | Required: ${row.requiredEvidence.join(", ")}`),
    "",
    "Critical Missing Evidence",
    ...(criticalMissing.length ? criticalMissing.map((row) => `${row.authority} ${row.citation}: ${row.requiredEvidence.join(", ")}`) : ["None"]),
    "",
    "Accepted Evidence",
    ...(acceptedEvidence.length ? acceptedEvidence.map((item) => `${item.title} (${item.evidenceType})`) : ["None"]),
    "",
    "Expired / Rejected Evidence",
    ...(expiredRejected.length ? expiredRejected.map((item) => `${item.title} (${item.status})`) : ["None"]),
    "",
    "Evidence Index",
    ...(evidence.length ? evidence.map((item) => `${item.id}: ${item.title} | ${item.evidenceType} | ${item.status}`) : ["No evidence logged"]),
    "",
    "AI Evidence Intelligence and Audit Lineage",
    AI_DISCLAIMER,
    ...(aiAnalyses.length ? aiAnalyses.flatMap((analysis) => lineageLines(analysis, evidence, gapRows)) : ["AI analysis was disabled or no AI analysis was available for this review."]),
    "",
    "7-Day / 30-Day / 90-Day Action Plan",
    ...actionItems.map((item) => `${item.bucket}: ${item.title} | Owner: ${item.ownerRole} | Due: ${item.dueDate}`),
    "",
    "Expert Review Status",
    "Expert review recommended. Starter rules are demo/unverified unless separately reviewed.",
    "",
    "Demo / Unverified Rules Notice",
    "Rules with demoContent=true or expertReviewed=false are preparation aids only and require qualified review.",
    "",
    "Findings",
    ...(findings.length ? findings.map((finding) => `${finding.severity}: ${finding.title}`) : ["None"])
  ];
  return lines;
}

export function generateAuditPacketPdf(data) {
  const lines = buildAuditPacketLines(data);
  return createSimplePdf(lines);
}

function createSimplePdf(lines) {
  const printableLines = lines.flatMap((raw) => wrap(ascii(String(raw)), 92));
  const pageChunks = [];
  for (let index = 0; index < printableLines.length; index += 47) pageChunks.push(printableLines.slice(index, index + 47));
  if (pageChunks.length === 0) pageChunks.push([""]);

  const objects = [];
  const pageIds = pageChunks.map((_, index) => 4 + index * 2);
  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  objects.push(`<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`);
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");

  pageChunks.forEach((pageLines, index) => {
    const pageId = pageIds[index];
    const contentId = pageId + 1;
    const contentLines = [
      "BT", "/F1 9 Tf", "46 806 Td", `(ComplianceIQ - Industrial Audit Readiness Packet) Tj`, "0 -18 Td"
    ];
    pageLines.forEach((line, lineIndex) => {
      if (lineIndex > 0) contentLines.push("0 -14 Td");
      contentLines.push(`(${escapePdfText(line)}) Tj`);
    });
    contentLines.push("ET", "BT", "/F1 8 Tf", "270 24 Td", `(Page ${index + 1} of ${pageChunks.length}) Tj`, "ET");
    const stream = contentLines.join("\n");
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`);
    objects.push(`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`);
  });

  const parts = ["%PDF-1.4\n"];
  const offsets = [0];
  for (let i = 0; i < objects.length; i += 1) {
    offsets.push(Buffer.byteLength(parts.join("")));
    parts.push(`${i + 1} 0 obj\n${objects[i]}\nendobj\n`);
  }
  const xrefOffset = Buffer.byteLength(parts.join(""));
  parts.push(`xref\n0 ${objects.length + 1}\n`);
  parts.push("0000000000 65535 f \n");
  for (let i = 1; i < offsets.length; i += 1) {
    parts.push(`${String(offsets[i]).padStart(10, "0")} 00000 n \n`);
  }
  parts.push(`trailer\n<< /Root 1 0 R /Size ${objects.length + 1} >>\nstartxref\n${xrefOffset}\n%%EOF`);
  return Buffer.from(parts.join(""), "utf8");
}

function escapePdfText(text) {
  return text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function wrap(text, width) {
  if (!text) return [""];
  const words = text.split(/\s+/);
  const lines = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > width) {
      if (line) lines.push(line);
      if (word.length > width) {
        for (let index = 0; index < word.length; index += width) lines.push(word.slice(index, index + width));
        line = "";
      } else {
        line = word;
      }
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function lineageLines(analysis, evidence, gapRows) {
  const evidenceItem = evidence.find((item) => item.id === analysis.evidenceId);
  const finalRows = gapRows.filter((row) => row.matchedEvidence?.some((item) => item.id === analysis.evidenceId));
  const finalMatches = finalRows.map((row) => {
    const matched = row.matchedEvidence.find((item) => item.id === analysis.evidenceId);
    return `${row.authority} ${row.citation} - ${row.obligationTitle} (${matched.matchSource})`;
  });
  return [
    `Evidence: ${evidenceItem?.title || analysis.evidenceId}`,
    `Detected type: ${analysis.detectedEvidenceType || "Not classified"} | Confidence: ${analysis.confidence ?? "N/A"} | Processing: ${analysis.processingStatus}`,
    `Extracted dates: document ${analysis.extractedDocumentDate || "unknown"}; expiration ${analysis.extractedExpirationDate || "unknown"}`,
    `Extracted fields: employees ${(analysis.extractedEmployeeNames || []).join(", ") || "none"}; equipment ${(analysis.extractedEquipmentNames || []).join(", ") || "none"}; chemicals ${(analysis.extractedChemicalNames || []).join(", ") || "none"}; signature ${analysis.extractedSignaturePresent === null || analysis.extractedSignaturePresent === undefined ? "unknown" : analysis.extractedSignaturePresent ? "present" : "not detected"}`,
    `Suggested obligation: ${analysis.suggestedObligationTitle || "None"} | Reason: ${analysis.matchReason || "No AI match reason"}`,
    `Final matched obligation: ${finalMatches.join("; ") || "No final match"}`,
    `Human review: ${analysis.humanReviewed ? "Human reviewed" : analysis.needsHumanReview ? "Needs human review" : "Not yet human reviewed"}`,
    `Issues: ${(analysis.issues || []).join("; ") || "None reported"}`,
    ""
  ];
}

function ascii(text) {
  return text.normalize("NFKD").replace(/[^\x20-\x7E]/g, "?");
}

export { DISCLAIMER as AUDIT_PACKET_DISCLAIMER, AI_DISCLAIMER as AI_EVIDENCE_DISCLAIMER };
