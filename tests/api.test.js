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
  process.env.UPLOAD_DIR = path.join(dir, "private-storage");
  process.env.STORAGE_BACKEND = "local";
  process.env.MAX_UPLOAD_MB = "5";
  process.env.SESSION_SECRET = "test-session-secret-with-enough-length";
  process.env.AI_ENABLED = "true";
  process.env.AI_PROVIDER = "mock";
  process.env.AI_CONFIDENCE_THRESHOLD = "0.8";
  process.env.AI_REVIEW_REQUIRED_THRESHOLD = "0.7";
  process.env.MALWARE_SCAN_ENABLED = "true";
  process.env.MALWARE_SCANNER_PROVIDER = "mock";
  process.env.QUEUE_MAX_RETRIES = "2";

  const { server, repo, processingQueue } = await import("../apps/api/src/server.js");
  const { hashPassword } = await import("../apps/api/src/security.js");
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  const base = `http://127.0.0.1:${port}`;

  try {
    const orgA = await repo.createOrganization({ name: "Tenant A" });
    const orgB = await repo.createOrganization({ name: "Tenant B" });
    const user = await repo.createUser({ organizationId: orgA.id, email: "admin@example.com", passwordHash: await hashPassword("Password#2026"), name: "Admin", role: "admin", isActive: true });
    const viewer = await repo.createUser({ organizationId: orgA.id, email: "viewer@example.com", passwordHash: await hashPassword("Password#2026"), name: "Viewer", role: "compliance_manager", isActive: true });
    const userB = await repo.createUser({ organizationId: orgB.id, email: "other@example.com", passwordHash: await hashPassword("Password#2026"), name: "Other Admin", role: "admin", isActive: true });
    const facility = await repo.createFacility({
      organizationId: orgA.id,
      name: "Plant A",
      country: "US",
      stateProvince: "OH",
      region: "OH",
      jurisdictionCode: "US-OH",
      industry: "industrial_manufacturing",
      facilityType: "fabrication",
      employeeCount: 50,
      hazardProfile: { machinery: true, lockoutTagout: true },
      archived: false
    });
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

    const health = await fetch(`${base}/api/health`);
    assert.equal(health.status, 200);
    assert.equal((await health.json()).persistence.backend, "file");

    const unauth = await fetch(`${base}/api/facilities`);
    assert.equal(unauth.status, 401);

    const rejectedOrigin = await fetch(`${base}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "https://attacker.example" },
      body: JSON.stringify({ email: user.email, password: "Password#2026" })
    });
    assert.equal(rejectedOrigin.status, 403);

    const login = await fetch(`${base}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: user.email, password: "Password#2026" })
    });
    assert.equal(login.status, 200);
    const cookie = login.headers.get("set-cookie").split(";")[0];

    const rulesPack = await fetch(`${base}/api/rules-packs/us-industrial-manufacturing-starter`, { headers: { cookie } });
    assert.equal(rulesPack.status, 200);

    const oversized = await fetch(`${base}/api/evidence`, {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({ facilityId: facility.id, title: "Oversized", evidenceType: "loto_procedures", description: "x".repeat(1024 * 1024) })
    });
    assert.equal(oversized.status, 413);

    const invalidUpload = await fetch(`${base}/api/evidence/upload`, {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({ facilityId: facility.id, title: "Invalid upload", evidenceType: "loto_procedures", contentBase64: "not base64" })
    });
    assert.equal(invalidUpload.status, 400);

    const denied = await fetch(`${base}/api/facilities/${otherFacility.id}`, { headers: { cookie } });
    assert.equal(denied.status, 403);

    const upload = await fetch(`${base}/api/evidence/upload`, {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({
        facilityId: facility.id,
        title: "LOTO procedure",
        evidenceType: "loto_procedures",
        status: "pending",
        contentBase64: Buffer.from("loto procedure").toString("base64"),
        fileName: "loto.txt"
      })
    });
    assert.equal(upload.status, 201);
    const evidence = await upload.json();
    assert.equal(evidence.scanStatus, "scan_clean");
    assert.equal(evidence.processingJob.status, "queued");
    assert.equal(evidence.aiAnalysis, undefined);

    await processingQueue.drain();

    assert.equal((await fetch(`${base}/api/evidence/${evidence.id}/process-ai`, { method: "POST" })).status, 401);
    const analysisResponse = await fetch(`${base}/api/evidence/${evidence.id}/ai-analysis`, { headers: { cookie } });
    assert.equal(analysisResponse.status, 200);
    const initialAnalysis = await analysisResponse.json();
    assert.equal(initialAnalysis.needsHumanReview, false);
    assert.equal(initialAnalysis.provider, "mock");
    assert.equal(initialAnalysis.analysisVersion, 1);
    assert.match(initialAnalysis.contentHash, /^[a-f0-9]{64}$/);
    assert.match(initialAnalysis.outputHash, /^[a-f0-9]{64}$/);

    const reprocess = await fetch(`${base}/api/evidence/${evidence.id}/process-ai`, { method: "POST", headers: { "Content-Type": "application/json", cookie }, body: "{}" });
    assert.equal(reprocess.status, 202);
    await processingQueue.drain();
    const history = await fetch(`${base}/api/evidence/${evidence.id}/ai-analyses`, { headers: { cookie } });
    assert.equal(history.status, 200);
    assert.deepEqual((await history.json()).map((item) => item.analysisVersion), [2, 1]);

    const acceptClassification = await fetch(`${base}/api/evidence/${evidence.id}/ai-review`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({ action: "accept_ai", notes: "Classification reviewed." })
    });
    assert.equal(acceptClassification.status, 200);
    const markAccepted = await fetch(`${base}/api/evidence/${evidence.id}/ai-review`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({ action: "mark_accepted", notes: "Evidence reviewed and accepted for this packet." })
    });
    assert.equal(markAccepted.status, 200);

    const evidenceDownload = await fetch(`${base}/api/evidence/${evidence.id}/download`, { headers: { cookie } });
    assert.equal(evidenceDownload.status, 200);
    assert.equal(await evidenceDownload.text(), "loto procedure");

    const generated = await fetch(`${base}/api/audit-readiness/reviews`, {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({ facilityId: facility.id })
    });
    assert.equal(generated.status, 201);
    const generatedBody = await generated.json();
    assert.ok(generatedBody.review.scoreExplanation.length > 0);
    assert.equal((await repo.getFacility(orgA.id, facility.id)).selectedRulesPackId, "us-industrial-manufacturing-starter");
    assert.ok((await repo.getEvidenceMatches(orgA.id, facility.id)).some((match) => match.evidenceId === evidence.id));

    const packetExport = await fetch(`${base}/api/audit-packets/export`, {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({ reviewId: generatedBody.review.id })
    });
    assert.equal(packetExport.status, 201);
    const { packet } = await packetExport.json();

    const packetDownload = await fetch(`${base}/api/audit-packets/${packet.id}/download`, { headers: { cookie } });
    assert.equal(packetDownload.status, 200);
    const packetBuffer = Buffer.from(await packetDownload.arrayBuffer());
    assert.equal(packetBuffer.byteLength > 4, true);
    assert.match(packetBuffer.toString("utf8"), /AI-assisted evidence analysis/);

    assert.equal((await fetch(`${base}/api/evidence/${evidence.id}/download`)).status, 401);
    assert.equal((await fetch(`${base}/api/audit-packets/${packet.id}/download`)).status, 401);

    const loginB = await fetch(`${base}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: userB.email, password: "Password#2026" })
    });
    assert.equal(loginB.status, 200);
    const cookieB = loginB.headers.get("set-cookie").split(";")[0];

    const loginViewer = await fetch(`${base}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: viewer.email, password: "Password#2026" })
    });
    const viewerCookie = loginViewer.headers.get("set-cookie").split(";")[0];
    const deniedReview = await fetch(`${base}/api/evidence/${evidence.id}/ai-review`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", cookie: viewerCookie },
      body: JSON.stringify({ action: "mark_rejected" })
    });
    assert.equal(deniedReview.status, 403);
    assert.equal((await fetch(`${base}/api/evidence-review-queue?facilityId=${facility.id}`, { headers: { cookie: viewerCookie } })).status, 403);

    const deniedEvidence = await fetch(`${base}/api/evidence/${evidence.id}/download`, { headers: { cookie: cookieB } });
    assert.equal(deniedEvidence.status, 403);
    const deniedPacket = await fetch(`${base}/api/audit-packets/${packet.id}/download`, { headers: { cookie: cookieB } });
    assert.equal(deniedPacket.status, 403);
    const deniedGapMatrix = await fetch(`${base}/api/audit-readiness/reviews/${generatedBody.review.id}/gap-matrix`, { headers: { cookie: cookieB } });
    assert.equal(deniedGapMatrix.status, 403);
    const deniedAuditLogs = await fetch(`${base}/api/audit-logs?facilityId=${facility.id}`, { headers: { cookie: cookieB } });
    assert.equal(deniedAuditLogs.status, 403);
    const deniedAnalysis = await fetch(`${base}/api/evidence/${evidence.id}/ai-analysis`, { headers: { cookie: cookieB } });
    assert.equal(deniedAnalysis.status, 403);
    const auditLogs = await repo.listAuditLogs(orgA.id, facility.id);
    assert.ok(auditLogs.some((entry) => entry.action === "evidence_processing_queued"));
    assert.ok(auditLogs.some((entry) => entry.action === "file_scan_clean"));
    assert.ok(auditLogs.some((entry) => entry.action === "ai_classification_generated"));
    assert.ok(auditLogs.some((entry) => entry.action === "human_accepted_ai_result"));
    assert.ok(auditLogs.some((entry) => entry.action === "packet_exported_with_ai_lineage"));
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
