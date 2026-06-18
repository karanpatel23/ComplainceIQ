import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import path from "node:path";
import os from "node:os";

test("API requires auth and blocks cross-organization access", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "ciq-api-"));
  process.env.NODE_ENV = "test";
  process.env.REPOSITORY_BACKEND = "file";
  process.env.FILE_REPOSITORY_PATH = path.join(dir, "db.json");
  process.env.SESSION_SECRET = "test-session-secret-with-enough-length";

  const { server, repo } = await import("../apps/api/src/server.js");
  const { hashPassword } = await import("../apps/api/src/security.js");
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  const base = `http://127.0.0.1:${port}`;

  try {
    const orgA = await repo.createOrganization({ name: "Tenant A" });
    const orgB = await repo.createOrganization({ name: "Tenant B" });
    const user = await repo.createUser({ organizationId: orgA.id, email: "admin@example.com", passwordHash: await hashPassword("Password#2026"), name: "Admin", role: "admin", isActive: true });
    const otherFacility = await repo.createFacility({
      organizationId: orgB.id,
      name: "Other Plant",
      country: "US",
      stateProvince: "TX",
      region: "TX",
      jurisdictionCode: "US-TX",
      industry: "industrial_manufacturing",
      facilityType: "fabrication",
      employeeCount: 12,
      hazardProfile: { machinery: true },
      archived: false
    });

    const unauth = await fetch(`${base}/api/facilities`);
    assert.equal(unauth.status, 401);

    const login = await fetch(`${base}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: user.email, password: "Password#2026" })
    });
    assert.equal(login.status, 200);
    const cookie = login.headers.get("set-cookie").split(";")[0];

    const denied = await fetch(`${base}/api/facilities/${otherFacility.id}`, { headers: { cookie } });
    assert.equal(denied.status, 403);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
