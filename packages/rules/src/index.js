import { clamp, isExpired } from "../../shared/src/index.js";

export const RULES_PACKS = [
  {
    rulesPackId: "us-industrial-manufacturing-starter",
    name: "United States Industrial Manufacturing Starter Pack",
    country: "US",
    region: "federal",
    industry: "industrial_manufacturing",
    authorityScope: "OSHA and EPA starter audit-readiness obligations",
    version: "2026.1-demo",
    expertReviewed: false,
    demoContent: true,
    lastUpdatedAt: "2026-06-18",
    description: "Starter OSHA/EPA evidence-readiness rules for US industrial manufacturing facilities."
  },
  {
    rulesPackId: "ca-industrial-manufacturing-starter",
    name: "Canada Industrial Manufacturing Starter Pack",
    country: "CA",
    region: "federal-provincial-demo",
    industry: "industrial_manufacturing",
    authorityScope: "Canadian federal and provincial/territorial starter audit-readiness obligations",
    version: "2026.1-demo",
    expertReviewed: false,
    demoContent: true,
    lastUpdatedAt: "2026-06-18",
    description: "Demo starter architecture for Canadian OHS, WHMIS, training, and environmental evidence readiness. Province/territory review is required."
  },
  {
    rulesPackId: "mx-industrial-manufacturing-starter",
    name: "Mexico Industrial Manufacturing Starter Pack",
    country: "MX",
    region: "federal-state-demo",
    industry: "industrial_manufacturing",
    authorityScope: "Mexican STPS and SEMARNAT starter audit-readiness obligations",
    version: "2026.1-demo",
    expertReviewed: false,
    demoContent: true,
    lastUpdatedAt: "2026-06-18",
    description: "Demo starter architecture for Mexico workplace safety, training, hazardous materials, and environmental records. Local review is required."
  }
];

export const COMPLIANCE_RULES = [
  rule("us-hazcom-sds-inventory", "us-industrial-manufacturing-starter", "US", "federal", "OSHA", "29 CFR 1910.1200", "Hazard Communication: SDS and chemical inventory", "Maintain an SDS library and current hazardous chemical inventory for chemicals present at the facility.", ["chemical_inventory", "sds_library"], "critical", "EHS Manager", 7, { hazardousChemicals: true, sdsRequired: true }, "https://www.osha.gov/hazcom"),
  rule("us-hazcom-written-program", "us-industrial-manufacturing-starter", "US", "federal", "OSHA", "29 CFR 1910.1200", "Written Hazard Communication program", "Maintain a written HazCom program that describes labels, SDS access, training, and non-routine task communication.", ["written_hazcom_program"], "critical", "EHS Manager", 7, { hazardousChemicals: true }, "https://www.osha.gov/hazcom"),
  rule("us-hazcom-training", "us-industrial-manufacturing-starter", "US", "federal", "OSHA", "29 CFR 1910.1200", "HazCom training records", "Keep training evidence for employees exposed to hazardous chemicals.", ["hazcom_training_records"], "high", "EHS Manager", 30, { hazardousChemicals: true }, "https://www.osha.gov/hazcom"),
  rule("us-loto-procedures", "us-industrial-manufacturing-starter", "US", "federal", "OSHA", "29 CFR 1910.147", "Lockout/Tagout written procedures", "Maintain equipment-specific energy control procedures when servicing or maintenance exposes workers to hazardous energy.", ["loto_procedures"], "critical", "Maintenance Supervisor", 7, { lockoutTagout: true, machinery: true }, "https://www.osha.gov/control-hazardous-energy"),
  rule("us-loto-training", "us-industrial-manufacturing-starter", "US", "federal", "OSHA", "29 CFR 1910.147", "Lockout/Tagout training records", "Maintain authorized and affected employee training records for hazardous energy control.", ["loto_training_records"], "critical", "Maintenance Supervisor", 7, { lockoutTagout: true }, "https://www.osha.gov/control-hazardous-energy"),
  rule("us-machine-guarding", "us-industrial-manufacturing-starter", "US", "federal", "OSHA", "29 CFR 1910.212", "Machine guarding inspection records", "Document guard inspections and corrective actions for machines with moving parts.", ["machine_guarding_inspections"], "high", "Plant Manager", 30, { machinery: true }, "https://www.osha.gov/laws-regs/regulations/standardnumber/1910/1910.212"),
  rule("us-ppe-assessment", "us-industrial-manufacturing-starter", "US", "federal", "OSHA", "29 CFR 1910.132", "PPE hazard assessment", "Document PPE hazard assessments and selected PPE controls for exposed job tasks.", ["ppe_hazard_assessment"], "high", "EHS Manager", 30, { ppe: true }, "https://www.osha.gov/personal-protective-equipment"),
  rule("us-ppe-training", "us-industrial-manufacturing-starter", "US", "federal", "OSHA", "29 CFR 1910.132", "PPE training records", "Maintain PPE training evidence for affected employees.", ["ppe_training_records"], "medium", "EHS Manager", 90, { ppe: true }, "https://www.osha.gov/personal-protective-equipment"),
  rule("us-respiratory-program", "us-industrial-manufacturing-starter", "US", "federal", "OSHA", "29 CFR 1910.134", "Respiratory protection program", "Maintain written respiratory protection program evidence, fit testing, medical evaluation, and training records when respirators are required.", ["respiratory_program", "fit_test_records", "respiratory_training_records"], "high", "EHS Manager", 30, { respiratoryHazards: true }, "https://www.osha.gov/respiratory-protection"),
  rule("us-hearing-conservation", "us-industrial-manufacturing-starter", "US", "federal", "OSHA", "29 CFR 1910.95", "Hearing conservation records", "Maintain monitoring, audiometric testing, training, and hearing protector evidence when occupational noise exposure triggers apply.", ["noise_monitoring_records", "hearing_training_records"], "high", "EHS Manager", 30, { hearingNoise: true }, "https://www.osha.gov/noise"),
  rule("us-injury-recordkeeping", "us-industrial-manufacturing-starter", "US", "federal", "OSHA", "29 CFR Part 1904", "Injury and illness recordkeeping", "Maintain OSHA 300, 300A, and 301 records where recordkeeping requirements apply.", ["osha_300_log", "osha_300a_summary"], "medium", "HR / EHS Manager", 90, { always: true }, "https://www.osha.gov/recordkeeping"),
  rule("us-emergency-action-plan", "us-industrial-manufacturing-starter", "US", "federal", "OSHA", "29 CFR 1910.38", "Emergency Action Plan", "Maintain a written emergency action plan and evidence of employee communication or drills.", ["emergency_action_plan", "emergency_training_records"], "medium", "Plant Manager", 90, { emergencyActionPlan: true }, "https://www.osha.gov/emergency-action-plans"),
  rule("us-fire-extinguishers", "us-industrial-manufacturing-starter", "US", "federal", "OSHA", "29 CFR 1910.157", "Fire extinguisher inspection records", "Maintain inspection, maintenance, and employee training evidence for portable fire extinguishers.", ["fire_extinguisher_inspections"], "medium", "Facilities Manager", 90, { fireExtinguishers: true }, "https://www.osha.gov/laws-regs/regulations/standardnumber/1910/1910.157"),
  rule("us-forklift-training", "us-industrial-manufacturing-starter", "US", "federal", "OSHA", "29 CFR 1910.178", "Powered industrial truck training", "Maintain operator training and evaluation evidence for forklifts or powered industrial trucks.", ["forklift_training_records"], "high", "Operations Manager", 30, { forklifts: true }, "https://www.osha.gov/powered-industrial-trucks"),
  rule("us-rcra-waste", "us-industrial-manufacturing-starter", "US", "federal", "EPA", "40 CFR Parts 260-270", "Hazardous waste determination and manifests", "Maintain hazardous waste determinations, manifests, and storage-area inspection evidence when hazardous waste is generated.", ["hazardous_waste_determination", "hazardous_waste_manifests", "waste_area_inspections"], "critical", "Environmental Manager", 7, { hazardousWaste: true }, "https://www.epa.gov/rcra"),
  rule("us-spcc-flag", "us-industrial-manufacturing-starter", "US", "federal", "EPA", "40 CFR Part 112", "Oil storage / SPCC trigger review", "Maintain evidence of oil storage threshold review and SPCC plan or documented non-applicability where relevant.", ["spcc_threshold_review", "spcc_plan"], "high", "Environmental Manager", 30, { oilFuelStorage: true }, "https://www.epa.gov/oil-spills-prevention-and-preparedness-regulations"),

  rule("ca-whmis-sds", "ca-industrial-manufacturing-starter", "CA", "federal-provincial-demo", "WHMIS / Provincial OHS", "WHMIS demo starter", "WHMIS hazardous product communication evidence", "Maintain hazardous product inventory, SDS access, labels, and worker education evidence. Province/territory requirements must be reviewed.", ["chemical_inventory", "sds_library", "whmis_training_records"], "critical", "EHS Manager", 7, { hazardousChemicals: true }, "https://www.ccohs.ca/oshanswers/chemicals/whmis_ghs/"),
  rule("ca-lockout", "ca-industrial-manufacturing-starter", "CA", "federal-provincial-demo", "Provincial/Territorial OHS", "Control of hazardous energy demo starter", "Control of hazardous energy documentation", "Maintain written lockout or hazardous-energy-control procedures and training records according to the applicable province or territory.", ["loto_procedures", "loto_training_records"], "critical", "Maintenance Supervisor", 7, { lockoutTagout: true, machinery: true }, null),
  rule("ca-machine-guarding", "ca-industrial-manufacturing-starter", "CA", "federal-provincial-demo", "Provincial/Territorial OHS", "Machine guarding demo starter", "Machine guarding inspections", "Maintain machine guarding inspection and corrective action records according to provincial or territorial OHS rules.", ["machine_guarding_inspections"], "high", "Plant Manager", 30, { machinery: true }, null),
  rule("ca-ppe-training", "ca-industrial-manufacturing-starter", "CA", "federal-provincial-demo", "Provincial/Territorial OHS", "PPE demo starter", "PPE hazard assessment and training", "Maintain task-based PPE assessment and worker training evidence.", ["ppe_hazard_assessment", "ppe_training_records"], "medium", "EHS Manager", 90, { ppe: true }, null),
  rule("ca-incident-recordkeeping", "ca-industrial-manufacturing-starter", "CA", "federal-provincial-demo", "Provincial/Territorial OHS", "Incident recordkeeping demo starter", "Incident and injury recordkeeping", "Maintain incident, investigation, and corrective action records for the applicable province or territory.", ["incident_log", "corrective_action_records"], "medium", "EHS Manager", 90, { always: true }, null),
  rule("ca-hazardous-waste", "ca-industrial-manufacturing-starter", "CA", "provincial-environment-demo", "Provincial environmental agency / ECCC where applicable", "Environmental records demo starter", "Hazardous waste and environmental records", "Maintain generator, manifest, storage, and shipment evidence where hazardous waste rules apply.", ["hazardous_waste_determination", "hazardous_waste_manifests"], "high", "Environmental Manager", 30, { hazardousWaste: true }, null),

  rule("mx-stps-training", "mx-industrial-manufacturing-starter", "MX", "federal-state-demo", "STPS", "STPS training demo starter", "Workplace safety training records", "Maintain worker safety and health training records for hazards present at the facility.", ["safety_training_records"], "high", "EHS Manager", 30, { always: true }, null),
  rule("mx-chemical-safety", "mx-industrial-manufacturing-starter", "MX", "federal-state-demo", "STPS", "Chemical handling demo starter", "Chemical handling documentation", "Maintain chemical inventory, SDS or equivalent hazard communication records, and worker training evidence.", ["chemical_inventory", "sds_library", "chemical_training_records"], "critical", "EHS Manager", 7, { hazardousChemicals: true }, null),
  rule("mx-machine-safety", "mx-industrial-manufacturing-starter", "MX", "federal-state-demo", "STPS", "Machine safety demo starter", "Machine safety and guarding evidence", "Maintain machine guarding, inspection, maintenance, and training records for hazardous machinery.", ["machine_guarding_inspections", "maintenance_logs"], "high", "Plant Manager", 30, { machinery: true }, null),
  rule("mx-ppe", "mx-industrial-manufacturing-starter", "MX", "federal-state-demo", "STPS", "PPE demo starter", "PPE assessment and training", "Maintain PPE determination and worker training records for identified hazards.", ["ppe_hazard_assessment", "ppe_training_records"], "medium", "EHS Manager", 90, { ppe: true }, null),
  rule("mx-emergency-response", "mx-industrial-manufacturing-starter", "MX", "federal-state-demo", "STPS / Civil Protection", "Emergency response demo starter", "Emergency response records", "Maintain emergency response plan, drills, and employee communication evidence.", ["emergency_action_plan", "emergency_drill_records"], "medium", "Plant Manager", 90, { emergencyActionPlan: true }, null),
  rule("mx-semarnat-waste", "mx-industrial-manufacturing-starter", "MX", "federal-state-demo", "SEMARNAT", "Hazardous waste demo starter", "Hazardous waste records", "Maintain hazardous waste generation, storage, shipment, and disposal records where applicable.", ["hazardous_waste_determination", "hazardous_waste_manifests"], "high", "Environmental Manager", 30, { hazardousWaste: true }, null)
];

function rule(id, rulesPackId, country, region, authority, citation, title, description, requiredEvidenceTypes, priority, ownerRole, dueWindowDays, triggers, sourceUrl) {
  return {
    id,
    rulesPackId,
    country,
    region,
    authority,
    citation,
    title,
    description,
    applicabilityTrigger: triggers,
    requiredEvidenceTypes,
    priority,
    ownerRole,
    dueWindowDays,
    sourceUrl,
    expertReviewed: false,
    demoContent: true,
    lastReviewedAt: null,
    version: "2026.1-demo"
  };
}

export function selectRulesPack(facility) {
  const country = String(facility.country || "").toUpperCase();
  return RULES_PACKS.find((pack) => pack.country === country && pack.industry === facility.industry)
    || RULES_PACKS.find((pack) => pack.country === country)
    || null;
}

export function ruleApplies(ruleItem, facility) {
  if (ruleItem.country !== facility.country) return false;
  const trigger = ruleItem.applicabilityTrigger || {};
  const hazard = facility.hazardProfile || {};
  if (trigger.always) return true;
  return Object.entries(trigger).some(([key, value]) => value === true && hazard[key] === true);
}

export function getApplicableRules(facility) {
  const pack = selectRulesPack(facility);
  if (!pack) return { rulesPack: null, rules: [] };
  const rules = COMPLIANCE_RULES
    .filter((ruleItem) => ruleItem.rulesPackId === pack.rulesPackId)
    .filter((ruleItem) => ruleApplies(ruleItem, facility));
  return { rulesPack: pack, rules };
}

export function buildEvidenceMatches(rules, evidence, now = new Date(), aiAnalyses = []) {
  const matches = [];
  for (const ruleItem of rules) {
    for (const evidenceItem of evidence.filter((item) => !item.archived)) {
      const analysis = aiAnalyses.find((item) => item.evidenceId === evidenceItem.id) || null;
      const effectiveEvidenceType = analysis?.humanOverrideEvidenceType || evidenceItem.evidenceType;
      const humanRuleId = analysis?.humanOverrideRuleId || null;
      const manualRuleId = evidenceItem.relatedObligationId || null;
      const deterministicMatch = ruleItem.requiredEvidenceTypes.includes(effectiveEvidenceType);
      const reviewedAiMatch = Boolean(analysis?.humanReviewed && analysis?.suggestedRuleId === ruleItem.id);
      let matchType = null;

      if (humanRuleId) {
        if (humanRuleId === ruleItem.id) matchType = "human_reviewed";
      } else if (manualRuleId) {
        if (manualRuleId === ruleItem.id) matchType = "manual";
      } else if (deterministicMatch) {
        const aiAgrees = analysis?.detectedEvidenceType === effectiveEvidenceType && analysis?.suggestedRuleId === ruleItem.id;
        matchType = aiAgrees ? "ai_assisted_deterministic" : "deterministic";
      } else if (reviewedAiMatch) {
        matchType = "human_reviewed";
      }

      if (matchType) {
        matches.push({
          ruleId: ruleItem.id,
          evidenceId: evidenceItem.id,
          matchType,
          confidence: analysis?.confidence === undefined || analysis?.confidence === null
            ? evidenceItem.confidence || "medium"
            : confidenceLabel(analysis.confidence),
          expired: isExpired(evidenceItem, now)
        });
      }
    }
  }
  return matches;
}

export function buildGapMatrix(facility, rules, evidence, rulesPack, now = new Date(), evidenceMatches = null, aiAnalyses = []) {
  const resolvedMatches = evidenceMatches || buildEvidenceMatches(rules, evidence, now, aiAnalyses);
  return rules.map((ruleItem) => {
    const relatedMatches = resolvedMatches.filter((match) => match.ruleId === ruleItem.id);
    const matchedEvidence = relatedMatches
      .map((match) => evidence.find((item) => item.id === match.evidenceId))
      .filter(Boolean);

    const acceptedTypes = new Set(
      matchedEvidence
        .filter((item) => item.status === "accepted" && !isExpired(item, now))
        .map((item) => effectiveEvidenceType(item, aiAnalyses))
    );
    const expiredCount = matchedEvidence.filter((item) => isExpired(item, now)).length;
    const rejectedCount = matchedEvidence.filter((item) => item.status === "rejected").length;
    const missingTypes = ruleItem.requiredEvidenceTypes.filter((type) => !acceptedTypes.has(type));

    let status = "missing";
    if (ruleItem.requiredEvidenceTypes.length === 0) {
      status = "not_applicable";
    } else if (missingTypes.length === 0) {
      status = "accepted";
    } else if (expiredCount > 0 && acceptedTypes.size === 0) {
      status = "expired";
    } else if (rejectedCount > 0 && acceptedTypes.size === 0) {
      status = "rejected";
    } else if (matchedEvidence.length > 0 || acceptedTypes.size > 0) {
      status = "partial";
    }

    const dueDate = new Date(now.getTime() + ruleItem.dueWindowDays * 24 * 60 * 60 * 1000);
    return {
      id: `${facility.id}:${ruleItem.id}`,
      organizationId: facility.organizationId,
      facilityId: facility.id,
      ruleId: ruleItem.id,
      country: ruleItem.country,
      region: facility.region,
      stateProvince: facility.stateProvince,
      rulesPackId: rulesPack.rulesPackId,
      rulesPackName: rulesPack.name,
      obligationTitle: ruleItem.title,
      authority: ruleItem.authority,
      citation: ruleItem.citation,
      requiredEvidence: ruleItem.requiredEvidenceTypes,
      matchedEvidence: matchedEvidence.map((item) => ({
        id: item.id,
        title: item.title,
        evidenceType: effectiveEvidenceType(item, aiAnalyses),
        status: isExpired(item, now) ? "expired" : item.status,
        matchSource: relatedMatches.find((match) => match.evidenceId === item.id)?.matchType || "deterministic"
      })),
      aiInsights: buildAiInsights(ruleItem, relatedMatches, aiAnalyses),
      status,
      priority: ruleItem.priority,
      confidence: confidenceForRow(ruleItem, matchedEvidence),
      ownerRole: ruleItem.ownerRole,
      dueDate: dueDate.toISOString().slice(0, 10),
      recommendedAction: recommendedAction(ruleItem, missingTypes, status),
      expertReviewed: ruleItem.expertReviewed,
      demoContent: ruleItem.demoContent,
      expiredEvidenceCount: expiredCount,
      rejectedEvidenceCount: rejectedCount
    };
  });
}

function buildAiInsights(ruleItem, relatedMatches, aiAnalyses) {
  const matchedIds = new Set(relatedMatches.map((match) => match.evidenceId));
  return aiAnalyses
    .filter((analysis) => matchedIds.has(analysis.evidenceId) || analysis.suggestedRuleId === ruleItem.id || analysis.humanOverrideRuleId === ruleItem.id)
    .map((analysis) => ({
      evidenceId: analysis.evidenceId,
      processingStatus: analysis.processingStatus,
      detectedEvidenceType: analysis.detectedEvidenceType,
      confidence: analysis.confidence,
      needsHumanReview: analysis.needsHumanReview,
      humanReviewed: analysis.humanReviewed,
      matchReason: analysis.matchReason,
      issues: analysis.issues || [],
      extractedDocumentDate: analysis.extractedDocumentDate,
      extractedExpirationDate: analysis.extractedExpirationDate,
      matchSource: relatedMatches.find((match) => match.evidenceId === analysis.evidenceId)?.matchType || "ai_suggestion"
    }));
}

function effectiveEvidenceType(evidenceItem, aiAnalyses) {
  return aiAnalyses.find((analysis) => analysis.evidenceId === evidenceItem.id)?.humanOverrideEvidenceType || evidenceItem.evidenceType;
}

function confidenceLabel(confidence) {
  if (confidence >= 0.8) return "high";
  if (confidence >= 0.7) return "medium";
  return "low";
}

function confidenceForRow(ruleItem, matchedEvidence) {
  if (!ruleItem.expertReviewed) return "low";
  if (matchedEvidence.some((item) => item.confidence === "low")) return "low";
  if (matchedEvidence.some((item) => item.confidence === "medium")) return "medium";
  return "high";
}

function recommendedAction(ruleItem, missingTypes, status) {
  if (status === "accepted") return "Keep evidence current and ready for packet export.";
  if (status === "expired") return `Replace expired evidence for ${ruleItem.title}.`;
  if (status === "rejected") return `Resolve reviewer comments and resubmit evidence for ${ruleItem.title}.`;
  return `Collect or log evidence for: ${missingTypes.join(", ")}.`;
}

export function computeReadinessScore(gapRows) {
  const criticalMissing = gapRows.filter((row) => row.priority === "critical" && ["missing", "partial"].includes(row.status)).length;
  const highMissing = gapRows.filter((row) => row.priority === "high" && ["missing", "partial"].includes(row.status)).length;
  const mediumMissing = gapRows.filter((row) => row.priority === "medium" && ["missing", "partial"].includes(row.status)).length;
  const expiredEvidence = gapRows.reduce((sum, row) => sum + (row.expiredEvidenceCount || 0), 0);
  const rejectedEvidence = gapRows.reduce((sum, row) => sum + (row.rejectedEvidenceCount || 0), 0);

  const deductions = [
    ["critical", criticalMissing, 25, "critical obligation missing required evidence"],
    ["high", highMissing, 15, "high-priority obligation missing required evidence"],
    ["medium", mediumMissing, 8, "medium-priority obligation missing required evidence"],
    ["expired", expiredEvidence, 10, "expired evidence item"],
    ["rejected", rejectedEvidence, 5, "rejected evidence item"]
  ];

  const score = clamp(
    100
      - 25 * criticalMissing
      - 15 * highMissing
      - 8 * mediumMissing
      - 10 * expiredEvidence
      - 5 * rejectedEvidence,
    0,
    100
  );

  const scoreExplanation = deductions
    .filter(([, count]) => count > 0)
    .map(([, count, points, label]) => `-${points * count} pts: ${count} ${label}${count === 1 ? "" : "s"}`);

  if (scoreExplanation.length === 0) {
    scoreExplanation.push("No scoring deductions: applicable obligations have current accepted evidence.");
  }

  return {
    readinessScore: score,
    scoreExplanation,
    counts: { criticalMissing, highMissing, mediumMissing, expiredEvidence, rejectedEvidence }
  };
}

export function generateActionPlan(gapRows) {
  return gapRows
    .filter((row) => ["missing", "partial", "expired", "rejected"].includes(row.status))
    .map((row) => {
      const bucket = row.priority === "critical" ? "urgent_7_days" : row.priority === "high" ? "30_days" : "90_days";
      return {
        id: `${row.id}:action`,
        organizationId: row.organizationId,
        facilityId: row.facilityId,
        relatedObligationId: row.ruleId,
        title: row.status === "expired" ? `Replace expired evidence: ${row.obligationTitle}` : `Close evidence gap: ${row.obligationTitle}`,
        authority: row.authority,
        citation: row.citation,
        country: row.country,
        region: row.region,
        priority: row.priority,
        bucket,
        reason: `${row.status} evidence for ${row.authority} ${row.citation}`,
        ownerRole: row.ownerRole,
        dueDate: row.dueDate,
        requiredEvidence: row.requiredEvidence,
        recommendedNextStep: row.recommendedAction,
        status: "open"
      };
    });
}

export function generateReview({ facility, evidence, aiAnalyses = [], now = new Date() }) {
  const { rulesPack, rules } = getApplicableRules(facility);
  if (!rulesPack) {
    throw new Error(`No rules pack available for country ${facility.country}`);
  }
  const evidenceMatches = buildEvidenceMatches(rules, evidence, now, aiAnalyses);
  const gapRows = buildGapMatrix(facility, rules, evidence, rulesPack, now, evidenceMatches, aiAnalyses);
  const score = computeReadinessScore(gapRows);
  const actionPlan = generateActionPlan(gapRows);
  const acceptedEvidenceCount = evidence.filter((item) => item.status === "accepted" && !isExpired(item, now)).length;
  const missingCount = gapRows.filter((row) => row.status === "missing").length;
  const criticalGaps = gapRows.filter((row) => row.priority === "critical" && row.status !== "accepted").length;

  return {
    facilityId: facility.id,
    organizationId: facility.organizationId,
    country: facility.country,
    region: facility.region,
    rulesPack,
    applicableRules: rules,
    evidenceMatches,
    gapRows,
    actionPlan,
    findings: gapRows
      .filter((row) => row.status !== "accepted")
      .map((row) => ({
        id: `${row.id}:finding`,
        organizationId: row.organizationId,
        facilityId: row.facilityId,
        ruleId: row.ruleId,
        severity: row.priority,
        title: `${row.obligationTitle} evidence is ${row.status}`,
        description: row.recommendedAction,
        authority: row.authority,
        citation: row.citation
      })),
    readinessScore: score.readinessScore,
    scoreExplanation: score.scoreExplanation,
    summary: {
      missingEvidenceCount: missingCount,
      criticalGapsCount: criticalGaps,
      acceptedEvidenceCount,
      totalApplicableObligations: gapRows.length,
      demoRulesCount: gapRows.filter((row) => row.demoContent).length,
      expertReviewedRulesCount: gapRows.filter((row) => row.expertReviewed).length,
      aiNeedsReviewCount: aiAnalyses.filter((analysis) => analysis.needsHumanReview && !analysis.humanReviewed).length
    }
  };
}
