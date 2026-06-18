const DISCLAIMER = "This packet is intended for audit-preparation and evidence organization support only. It is not legal advice, does not guarantee compliance, and does not represent certification or approval by OSHA, EPA, Canadian federal/provincial regulators, Mexican STPS/SEMARNAT, or any other regulator. Demo or unverified rules are clearly labeled.";

export function buildAuditPacketLines({ facility, review, gapRows, actionItems, evidence, rulesPack, findings }) {
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
  const objects = [];
  const contentLines = [];
  contentLines.push("BT");
  contentLines.push("/F1 10 Tf");
  contentLines.push("50 790 Td");
  let lineCount = 0;
  for (const raw of lines) {
    const chunks = wrap(String(raw), 95);
    for (const chunk of chunks.length ? chunks : [""]) {
      if (lineCount > 0) contentLines.push("0 -14 Td");
      contentLines.push(`(${escapePdfText(chunk)}) Tj`);
      lineCount += 1;
    }
  }
  contentLines.push("ET");
  const stream = contentLines.join("\n");

  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  objects.push("<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  objects.push("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>");
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  objects.push(`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`);

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
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export { DISCLAIMER as AUDIT_PACKET_DISCLAIMER };
