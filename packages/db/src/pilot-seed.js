import { createRepository } from "./repository.js";
import { hashPassword } from "../../../apps/api/src/security.js";
import { createEvidenceAiService } from "../../../apps/api/src/evidence-ai-service.js";
import { createPrivateStorage } from "../../../apps/api/src/storage.js";
import { MockEvidenceAiProvider } from "../../ai/src/index.js";
import { generateAuditPacketPdf } from "../../pdf/src/index.js";
import { parseEvidenceInput, parseFacilityInput } from "../../shared/src/index.js";
import { generateReview, getApplicableRules } from "../../rules/src/index.js";

const ORGANIZATION_NAME = "ComplianceIQ Synthetic Pilot Organization";
const FACILITIES = [
  {
    name: "Synthetic Ohio Fabrication Plant",
    country: "US",
    stateProvince: "Ohio",
    region: "OH",
    jurisdictionCode: "US-OH",
    facilityType: "metal_fabrication",
    employeeCount: 72,
    hazardProfile: { machinery: true, forklifts: true, lockoutTagout: true, ppe: true, emergencyActionPlan: true, fireExtinguishers: true },
    evidence: [
      { title: "Synthetic forklift training record 2026-02-01", description: "Synthetic powered industrial truck training metadata for pilot demonstration only." },
      { title: "Synthetic annual readiness notes", description: "Synthetic ambiguous metadata intentionally routed to the human reviewer queue." }
    ]
  },
  {
    name: "Synthetic Ontario Components Plant",
    country: "CA",
    stateProvince: "Ontario",
    region: "ON",
    jurisdictionCode: "CA-ON",
    facilityType: "component_manufacturing",
    employeeCount: 54,
    hazardProfile: { machinery: true, hazardousChemicals: true, sdsRequired: true, ppe: true, emergencyActionPlan: true },
    evidence: [{ title: "Synthetic SDS index 2026-02-02", description: "Synthetic safety data sheet inventory metadata for pilot demonstration only." }]
  },
  {
    name: "Synthetic Nuevo Leon Assembly Plant",
    country: "MX",
    stateProvince: "Nuevo Leon",
    region: "NL",
    jurisdictionCode: "MX-NL",
    facilityType: "industrial_assembly",
    employeeCount: 61,
    hazardProfile: { machinery: true, ppe: true, emergencyActionPlan: true, fireExtinguishers: true },
    evidence: [{ title: "Synthetic emergency action drill 2026-02-03", description: "Synthetic evacuation and emergency action evidence metadata for pilot demonstration only." }]
  }
];

export function assertPilotSeedAllowed(config) {
  if (config.isProduction || config.deploymentProfile !== "local") throw new Error("Synthetic pilot seed is limited to the local deployment profile");
  if (!config.enableDemoData) throw new Error("Set ENABLE_DEMO_DATA=true to load the synthetic pilot dataset");
  if (!config.adminPassword) throw new Error("ADMIN_PASSWORD must be set before loading the synthetic pilot dataset");
}

export async function seedSyntheticPilot({ config, repo: providedRepo = null, storage: providedStorage = null } = {}) {
  assertPilotSeedAllowed(config);
  const ownsRepository = !providedRepo;
  const repo = providedRepo || await createRepository(config);
  const storage = providedStorage || createPrivateStorage(config);
  try {
    let organization = await repo.findOrganizationByName(ORGANIZATION_NAME);
    if (!organization) organization = await repo.createOrganization({ name: ORGANIZATION_NAME });
    const seedAdminEmail = syntheticAdminEmail(config.adminEmail);
    let admin = await repo.findUserByEmail(seedAdminEmail);
    if (!admin) {
      admin = await repo.createUser({
        organizationId: organization.id,
        email: seedAdminEmail,
        passwordHash: await hashPassword(config.adminPassword),
        name: "Synthetic Pilot Administrator",
        role: "admin",
        isActive: true
      });
    }

    const aiConfig = { ...config, aiEnabled: true, aiProvider: "mock", aiMaxFileTextChars: config.aiMaxFileTextChars || 12_000, aiConfidenceThreshold: 0.8, aiReviewRequiredThreshold: 0.7 };
    const aiService = createEvidenceAiService({ config: aiConfig, repo, storage, provider: new MockEvidenceAiProvider(aiConfig) });
    const seededFacilities = [];

    for (const definition of FACILITIES) {
      let facility = (await repo.listFacilities(organization.id)).find((item) => item.name === definition.name);
      if (!facility) facility = await repo.createFacility(parseFacilityInput({ ...definition, industry: "industrial_manufacturing" }, organization.id));
      const applicable = getApplicableRules(facility);
      await repo.saveApplicableRules(organization.id, facility.id, applicable.rulesPack.rulesPackId, applicable.rules);
      facility = await repo.getFacility(organization.id, facility.id);

      const existingEvidence = await repo.listEvidence(organization.id, facility.id);
      for (const sample of definition.evidence) {
        let evidence = existingEvidence.find((item) => item.title === sample.title);
        if (!evidence) {
          evidence = await repo.createEvidence(parseEvidenceInput({
            facilityId: facility.id,
            title: sample.title,
            description: sample.description,
            evidenceType: "other",
            status: "pending",
            confidence: "low",
            country: facility.country,
            region: facility.region
          }, organization.id, admin.id));
        }
        if (!await repo.getAiAnalysis(organization.id, evidence.id)) {
          await aiService.processEvidence({ organizationId: organization.id, evidenceId: evidence.id, userId: admin.id, createdByType: "system" });
        }
      }

      const evidence = await repo.listEvidence(organization.id, facility.id);
      const aiAnalyses = await repo.listAiAnalyses(organization.id, facility.id);
      let review = (await repo.listReviews(organization.id, facility.id))[0];
      if (!review) {
        const generated = generateReview({ facility, evidence, aiAnalyses, now: new Date("2026-06-24T12:00:00Z") });
        review = await repo.createReview({
          organizationId: organization.id,
          facilityId: facility.id,
          rulesPackId: generated.rulesPack.rulesPackId,
          country: generated.country,
          region: generated.region,
          readinessScore: generated.readinessScore,
          scoreExplanation: generated.scoreExplanation,
          summary: generated.summary,
          generatedByUserId: admin.id,
          evidenceMatches: generated.evidenceMatches,
          gapRows: generated.gapRows,
          findings: generated.findings,
          actionPlan: generated.actionPlan
        });
      }

      if ((await repo.listAuditPackets(organization.id, facility.id)).length === 0) {
        const [gapRows, actionItems, findings] = await Promise.all([
          repo.getGapRows(organization.id, review.id),
          repo.getActionItems(organization.id, review.id),
          repo.getFindings(organization.id, review.id)
        ]);
        const rulesPack = await repo.getRulesPack(review.rulesPackId);
        const pdf = generateAuditPacketPdf({ facility, review, gapRows, actionItems, evidence, rulesPack, findings, aiAnalyses });
        const saved = await storage.saveBuffer(pdf, `synthetic-pilot-${facility.country}-${facility.region}.pdf`);
        await repo.createAuditPacket({
          organizationId: organization.id,
          facilityId: facility.id,
          reviewId: review.id,
          title: `Synthetic Industrial Audit Readiness Packet - ${facility.country}/${facility.region}`,
          fileReference: saved.fileReference,
          generatedByUserId: admin.id,
          country: facility.country,
          region: facility.region,
          rulesPackId: review.rulesPackId,
          status: "generated"
        });
      }
      seededFacilities.push(facility);
    }

    await repo.logAudit({
      organizationId: organization.id,
      actorUserId: admin.id,
      action: "synthetic_pilot_dataset_loaded",
      entityType: "organization",
      entityId: organization.id,
      metadata: { synthetic: true, countries: seededFacilities.map((facility) => facility.country) }
    });
    return { organization, admin, facilities: seededFacilities };
  } finally {
    if (ownsRepository) await repo.close?.();
  }
}

export { FACILITIES as SYNTHETIC_PILOT_FACILITIES, ORGANIZATION_NAME as SYNTHETIC_PILOT_ORGANIZATION_NAME };

function syntheticAdminEmail(configuredEmail) {
  const [local, domain = "complianceiq.local"] = String(configuredEmail || "admin@complianceiq.local").toLowerCase().split("@");
  return `pilot-${local}@${domain}`;
}
