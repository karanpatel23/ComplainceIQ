import { readConfig } from "../../config/src/index.js";
import { createRepository } from "./repository.js";
import { hashPassword } from "../../../apps/api/src/security.js";
import { parseEvidenceInput, parseFacilityInput } from "../../shared/src/index.js";
import { generateReview, getApplicableRules } from "../../rules/src/index.js";

const config = readConfig(process.env);

if (config.isProduction) {
  throw new Error("Demo seed is disabled in production");
}
if (!config.enableDemoData) {
  throw new Error("Set ENABLE_DEMO_DATA=true to seed development data");
}
if (!config.adminPassword) {
  throw new Error("ADMIN_PASSWORD must be set before seeding demo data");
}

const repo = await createRepository(config);

let org = await repo.findOrganizationByName("Demo Manufacturing Co.");
if (!org) {
  org = await repo.createOrganization({ name: "Demo Manufacturing Co." });
}

let admin = await repo.findUserByEmail(config.adminEmail);
if (!admin) {
  admin = await repo.createUser({
    organizationId: org.id,
    email: config.adminEmail.toLowerCase(),
    passwordHash: await hashPassword(config.adminPassword),
    name: "Demo Admin",
    role: "admin",
    isActive: true
  });
}

let [facility] = await repo.listFacilities(org.id);
if (!facility) {
  facility = await repo.createFacility(parseFacilityInput({
    name: "Demo Metal Components Plant",
    country: "US",
    stateProvince: "OH",
    region: "OH",
    jurisdictionCode: "US-OH",
    industry: "industrial_manufacturing",
    facilityType: "metal_fabrication",
    employeeCount: 86,
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
    }
  }, org.id));
}

const applicable = getApplicableRules(facility);
await repo.saveApplicableRules(org.id, facility.id, applicable.rulesPack.rulesPackId, applicable.rules);
facility = await repo.getFacility(org.id, facility.id);

let evidence = await repo.listEvidence(org.id, facility.id);
if (evidence.length === 0) {
  const demoEvidence = await repo.createEvidence(parseEvidenceInput({
    facilityId: facility.id,
    title: "Demo LOTO procedure log",
    description: "Explicit development demo evidence. Replace before any real assessment.",
    evidenceType: "loto_procedures",
    status: "accepted",
    confidence: "medium",
    documentDate: "2026-01-15"
  }, org.id, admin.id));
  evidence = [demoEvidence];
}

const existingReviews = await repo.listReviews(org.id, facility.id);
if (existingReviews.length === 0) {
  const generated = generateReview({ facility, evidence });
  await repo.createReview({
    organizationId: org.id,
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

console.error(`Seed complete. Admin email: ${admin.email}`);
await repo.close?.();
