import { hashPassword } from "../../../apps/api/src/security.js";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 14;

export function parseInitialAdminInput(env = process.env) {
  const organizationName = String(env.PROVISION_ORGANIZATION_NAME || "").trim();
  const name = String(env.PROVISION_ADMIN_NAME || "").trim();
  const email = String(env.PROVISION_ADMIN_EMAIL || "").trim().toLowerCase();
  const password = String(env.PROVISION_ADMIN_PASSWORD || "");

  if (!organizationName) throw new Error("PROVISION_ORGANIZATION_NAME is required");
  if (!name) throw new Error("PROVISION_ADMIN_NAME is required");
  if (!EMAIL_PATTERN.test(email)) throw new Error("PROVISION_ADMIN_EMAIL must be a valid email address");
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`PROVISION_ADMIN_PASSWORD must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }

  return { organizationName, name, email, password };
}

export async function provisionInitialAdmin(repo, input) {
  const existingUser = await repo.findUserByEmail(input.email);
  if (existingUser) {
    throw new Error("A user with this email already exists; no changes were made");
  }

  let organization = await repo.findOrganizationByName(input.organizationName);
  if (organization) {
    const users = await repo.listUsersByOrganization(organization.id);
    if (users.length > 0) {
      throw new Error("This organization already has users; create additional users through authenticated administration");
    }
  } else {
    organization = await repo.createOrganization({ name: input.organizationName });
  }

  const admin = await repo.createUser({
    organizationId: organization.id,
    email: input.email,
    passwordHash: await hashPassword(input.password),
    name: input.name,
    role: "admin",
    isActive: true
  });

  await repo.logAudit({
    organizationId: organization.id,
    actorUserId: admin.id,
    action: "organization.initial_admin_provisioned",
    entityType: "user",
    entityId: admin.id,
    metadata: { method: "provisioning_cli" }
  });

  return {
    organization,
    admin: {
      id: admin.id,
      organizationId: admin.organizationId,
      email: admin.email,
      name: admin.name,
      role: admin.role,
      isActive: admin.isActive
    }
  };
}
