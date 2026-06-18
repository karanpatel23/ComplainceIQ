import { readConfig } from "../../config/src/index.js";
import { createRepository } from "./repository.js";
import { hashPassword } from "../../../apps/api/src/security.js";
import { parseFacilityInput } from "../../shared/src/index.js";

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

const existingFacilities = await repo.listFacilities(org.id);
if (existingFacilities.length === 0) {
  await repo.createFacility(parseFacilityInput({
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

console.error(`Seed complete. Admin email: ${admin.email}`);
