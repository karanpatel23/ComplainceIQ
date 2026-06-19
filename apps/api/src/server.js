import http from "node:http";
import { URL } from "node:url";
import { readConfig } from "../../../packages/config/src/index.js";
import { createRepository } from "../../../packages/db/src/repository.js";
import { forbidden, parseEvidenceInput, parseFacilityInput, toPublicUser, jsonError, unauthorized, validationError } from "../../../packages/shared/src/index.js";
import { getApplicableRules, generateReview, RULES_PACKS, COMPLIANCE_RULES } from "../../../packages/rules/src/index.js";
import { generateAuditPacketPdf } from "../../../packages/pdf/src/index.js";
import { createPrivateStorage } from "./storage.js";
import { signSessionId, verifyPassword, verifySignedSession } from "./security.js";

const config = readConfig(process.env);
const repo = await createRepository(config);
const storage = createPrivateStorage(config);
const DEFAULT_JSON_LIMIT_BYTES = 1024 * 1024;
const UPLOAD_JSON_LIMIT_BYTES = Math.ceil(config.maxUploadMb * 1024 * 1024 * 4 / 3) + 256 * 1024;

const server = http.createServer(async (req, res) => {
  try {
    await handleRequest(req, res);
  } catch (error) {
    if (!error.status || error.status >= 500) {
      process.stderr.write(`[ComplianceIQ API] ${error.stack || error.message}\n`);
    }
    sendJson(res, jsonError(error));
  }
});

async function handleRequest(req, res) {
  applyCors(req, res);
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }
  enforceTrustedOrigin(req);

  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  const path = url.pathname.replace(/\/$/, "") || "/";
  const method = req.method || "GET";

  if (method === "GET" && path === "/api/health") {
    const persistence = await repo.healthCheck();
    return sendJson(res, { status: 200, body: { ok: true, service: "ComplianceIQ API", persistence } });
  }

  if (method === "POST" && path === "/api/auth/login") return login(req, res);
  if (method === "POST" && path === "/api/auth/logout") return logout(req, res);

  const user = await requireSession(req);

  if (method === "GET" && path === "/api/auth/me") return sendJson(res, { status: 200, body: toPublicUser(user) });
  if (method === "GET" && path === "/api/organization") return currentOrganization(res, user);
  if (method === "GET" && path === "/api/users") return listUsers(res, user);

  if (path === "/api/facilities" && method === "GET") return listFacilities(res, user);
  if (path === "/api/facilities" && method === "POST") return createFacility(req, res, user);
  if (match(path, "/api/facilities/:id") && method === "GET") return getFacility(res, user, params(path).id);
  if (match(path, "/api/facilities/:id") && method === "PATCH") return updateFacility(req, res, user, params(path).id);
  if (match(path, "/api/facilities/:id") && method === "DELETE") return archiveFacility(res, user, params(path).id);
  if (match(path, "/api/facilities/:id/applicable-rules") && method === "GET") return applicableRules(res, user, params(path).id);

  if (path === "/api/rules-packs" && method === "GET") return sendJson(res, { status: 200, body: await repo.listRulesPacks() });
  if (match(path, "/api/rules-packs/:id") && method === "GET") return getRulesPack(res, params(path).id);
  if (path === "/api/rules" && method === "GET") return sendJson(res, { status: 200, body: await repo.listComplianceRules(Object.fromEntries(url.searchParams)) });

  if (path === "/api/evidence" && method === "GET") return listEvidence(res, user, url.searchParams.get("facilityId"));
  if (path === "/api/evidence" && method === "POST") return createEvidence(req, res, user, false);
  if (path === "/api/evidence/upload" && method === "POST") return createEvidence(req, res, user, true);
  if (match(path, "/api/evidence/:id") && method === "GET") return getEvidence(res, user, params(path).id);
  if (match(path, "/api/evidence/:id") && method === "PATCH") return updateEvidence(req, res, user, params(path).id);
  if (match(path, "/api/evidence/:id") && method === "DELETE") return archiveEvidence(res, user, params(path).id);
  if (match(path, "/api/evidence/:id/download") && method === "GET") return downloadEvidence(res, user, params(path).id);

  if (path === "/api/audit-readiness/reviews" && method === "GET") return listReviews(res, user, url.searchParams.get("facilityId"));
  if (path === "/api/audit-readiness/reviews" && method === "POST") return createReview(req, res, user);
  if (match(path, "/api/audit-readiness/reviews/:id") && method === "GET") return getReview(res, user, params(path).id);
  if (match(path, "/api/audit-readiness/reviews/:id/gap-matrix") && method === "GET") return sendJson(res, { status: 200, body: await repo.getGapRows(user.organizationId, params(path).id) });
  if (match(path, "/api/audit-readiness/reviews/:id/score") && method === "GET") {
    const review = await requireReview(user.organizationId, params(path).id);
    return sendJson(res, { status: 200, body: { readinessScore: review.readinessScore, scoreExplanation: review.scoreExplanation } });
  }
  if (match(path, "/api/audit-readiness/reviews/:id/action-plan") && method === "GET") return sendJson(res, { status: 200, body: await repo.getActionItems(user.organizationId, params(path).id) });

  if (path === "/api/audit-packets" && method === "GET") return listPackets(res, user, url.searchParams.get("facilityId"));
  if (path === "/api/audit-packets/export" && method === "POST") return exportPacket(req, res, user);
  if (match(path, "/api/audit-packets/:id/download") && method === "GET") return downloadPacket(res, user, params(path).id);

  if (path === "/api/expert-reviews" && method === "GET") return sendJson(res, { status: 200, body: await repo.listExpertReviews(user.organizationId) });
  if (path === "/api/expert-reviews" && method === "POST") return requestExpertReview(req, res, user);
  if (match(path, "/api/expert-reviews/:id") && method === "PATCH") return updateExpertReview(req, res, user, params(path).id);

  if (path === "/api/audit-logs" && method === "GET") return listAuditLogs(res, user, url.searchParams.get("facilityId"));

  const error = new Error("Route not found");
  error.status = 404;
  throw error;
}

async function login(req, res) {
  const body = await readJson(req);
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  if (!email || !password) throw validationError("Email and password are required");
  const user = await repo.findUserByEmail(email);
  if (!user || !user.isActive || !(await verifyPassword(password, user.passwordHash))) {
    throw unauthorized("Invalid credentials");
  }
  const session = await repo.createSession({
    organizationId: user.organizationId,
    userId: user.id,
    expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString()
  });
  await repo.logAudit({ organizationId: user.organizationId, actorUserId: user.id, action: "login", entityType: "user", entityId: user.id, metadata: {}, ipAddress: req.socket.remoteAddress });
  setCookie(res, "ciq.sid", signSessionId(session.id, config.sessionSecret), { maxAge: 8 * 60 * 60, httpOnly: true, sameSite: config.isProduction ? "None" : "Lax", secure: config.isProduction });
  sendJson(res, { status: 200, body: { user: toPublicUser(user) } });
}

async function logout(req, res) {
  const sessionId = getSessionId(req);
  if (sessionId) await repo.deleteSession(sessionId);
  setCookie(res, "ciq.sid", "", { maxAge: 0, httpOnly: true, sameSite: "Lax", secure: config.isProduction });
  sendJson(res, { status: 200, body: { ok: true } });
}

async function requireSession(req) {
  const sessionId = getSessionId(req);
  if (!sessionId) throw unauthorized();
  const session = await repo.getSession(sessionId);
  if (!session) throw unauthorized();
  const user = await repo.findUserById(session.userId);
  if (!user || !user.isActive || user.organizationId !== session.organizationId) throw unauthorized();
  return user;
}

function getSessionId(req) {
  const cookie = parseCookies(req.headers.cookie || "")["ciq.sid"];
  return verifySignedSession(cookie, config.sessionSecret);
}

async function currentOrganization(res, user) {
  const organization = await repo.getOrganization(user.organizationId);
  sendJson(res, { status: 200, body: organization });
}

async function listUsers(res, user) {
  requireRole(user, ["admin"]);
  const users = await repo.listUsersByOrganization(user.organizationId);
  sendJson(res, { status: 200, body: users.map(toPublicUser) });
}

async function listFacilities(res, user) {
  sendJson(res, { status: 200, body: await repo.listFacilities(user.organizationId) });
}

async function createFacility(req, res, user) {
  const input = parseFacilityInput(await readJson(req), user.organizationId);
  const facility = await repo.createFacility(input);
  const { rulesPack, rules } = getApplicableRules(facility);
  if (rulesPack) await repo.saveApplicableRules(user.organizationId, facility.id, rulesPack.rulesPackId, rules);
  const persistedFacility = await repo.getFacility(user.organizationId, facility.id);
  await audit(user, facility.id, "facility.created", "facility", facility.id, { name: facility.name });
  sendJson(res, { status: 201, body: { ...persistedFacility, rulesPack, applicableRuleCount: rules.length } });
}

async function getFacility(res, user, id) {
  const facility = await requireFacility(user.organizationId, id);
  sendJson(res, { status: 200, body: facility });
}

async function updateFacility(req, res, user, id) {
  await requireFacility(user.organizationId, id);
  const updates = parseFacilityInput({ ...(await repo.getFacility(user.organizationId, id)), ...(await readJson(req)) }, user.organizationId);
  const facility = await repo.updateFacility(user.organizationId, id, updates);
  const { rulesPack, rules } = getApplicableRules(facility);
  if (rulesPack) await repo.saveApplicableRules(user.organizationId, facility.id, rulesPack.rulesPackId, rules);
  const persistedFacility = await repo.getFacility(user.organizationId, facility.id);
  await audit(user, facility.id, "facility.updated", "facility", facility.id, {});
  sendJson(res, { status: 200, body: { ...persistedFacility, rulesPack, applicableRuleCount: rules.length } });
}

async function getRulesPack(res, rulesPackId) {
  const rulesPack = await repo.getRulesPack(rulesPackId);
  if (!rulesPack) {
    const error = new Error("Rules pack not found");
    error.status = 404;
    throw error;
  }
  sendJson(res, { status: 200, body: rulesPack });
}

async function archiveFacility(res, user, id) {
  const facility = await repo.archiveFacility(user.organizationId, id);
  await audit(user, id, "facility.archived", "facility", id, {});
  sendJson(res, { status: 200, body: facility });
}

async function applicableRules(res, user, id) {
  const facility = await requireFacility(user.organizationId, id);
  const { rulesPack, rules } = getApplicableRules(facility);
  sendJson(res, { status: 200, body: { rulesPack, rules } });
}

async function listEvidence(res, user, facilityId) {
  if (!facilityId) throw validationError("facilityId query parameter is required");
  await requireFacility(user.organizationId, facilityId);
  sendJson(res, { status: 200, body: await repo.listEvidence(user.organizationId, facilityId) });
}

async function createEvidence(req, res, user, allowsFile) {
  const body = await readJson(req, allowsFile ? UPLOAD_JSON_LIMIT_BYTES : DEFAULT_JSON_LIMIT_BYTES);
  const facility = await requireFacility(user.organizationId, body.facilityId);
  let fileReference = null;
  if (allowsFile) {
    if (!body.contentBase64) throw validationError("contentBase64 is required for evidence upload");
    const saved = await storage.saveBuffer(decodeBase64(body.contentBase64), body.fileName || "evidence.bin");
    fileReference = saved.fileReference;
  }
  let evidence;
  try {
    evidence = await repo.createEvidence(parseEvidenceInput({ ...body, fileReference, country: facility.country, region: facility.region }, user.organizationId, user.id));
  } catch (error) {
    if (fileReference) await storage.deleteBuffer(fileReference);
    throw error;
  }
  await audit(user, facility.id, "evidence.created", "evidence", evidence.id, { evidenceType: evidence.evidenceType });
  sendJson(res, { status: 201, body: evidence });
}

async function getEvidence(res, user, id) {
  const evidence = await requireEvidence(user.organizationId, id);
  sendJson(res, { status: 200, body: evidence });
}

async function updateEvidence(req, res, user, id) {
  const existing = await requireEvidence(user.organizationId, id);
  const body = await readJson(req);
  const updates = parseEvidenceInput({ ...existing, ...body, fileReference: existing.fileReference, facilityId: existing.facilityId, country: existing.country, region: existing.region }, user.organizationId, user.id);
  const evidence = await repo.updateEvidence(user.organizationId, id, updates);
  await audit(user, evidence.facilityId, "evidence.updated", "evidence", evidence.id, { status: evidence.status });
  sendJson(res, { status: 200, body: evidence });
}

async function archiveEvidence(res, user, id) {
  const evidence = await repo.archiveEvidence(user.organizationId, id);
  await audit(user, evidence.facilityId, "evidence.archived", "evidence", evidence.id, {});
  sendJson(res, { status: 200, body: evidence });
}

async function downloadEvidence(res, user, id) {
  const evidence = await requireEvidence(user.organizationId, id);
  if (!evidence.fileReference) {
    const error = new Error("Evidence has no file attachment");
    error.status = 404;
    throw error;
  }
  const buffer = await storage.readBuffer(evidence.fileReference);
  await audit(user, evidence.facilityId, "evidence.downloaded", "evidence", evidence.id, {});
  sendBuffer(res, buffer, "application/octet-stream", `${safeDownloadName(evidence.title)}.bin`);
}

async function createReview(req, res, user) {
  const body = await readJson(req);
  const facility = await requireFacility(user.organizationId, body.facilityId);
  const evidence = await repo.listEvidence(user.organizationId, facility.id);
  const generated = generateReview({ facility, evidence });
  await repo.saveApplicableRules(user.organizationId, facility.id, generated.rulesPack.rulesPackId, generated.applicableRules);
  const review = await repo.createReview({
    organizationId: user.organizationId,
    facilityId: facility.id,
    rulesPackId: generated.rulesPack.rulesPackId,
    country: facility.country,
    region: facility.region,
    readinessScore: generated.readinessScore,
    scoreExplanation: generated.scoreExplanation,
    summary: generated.summary,
    generatedByUserId: user.id,
    evidenceMatches: generated.evidenceMatches,
    gapRows: generated.gapRows,
    findings: generated.findings,
    actionPlan: generated.actionPlan
  });
  await audit(user, facility.id, "review.generated", "audit_readiness_review", review.id, { readinessScore: review.readinessScore });
  sendJson(res, { status: 201, body: { review, gapRows: generated.gapRows, actionPlan: generated.actionPlan, rulesPack: generated.rulesPack } });
}

async function listReviews(res, user, facilityId) {
  if (facilityId) await requireFacility(user.organizationId, facilityId);
  sendJson(res, { status: 200, body: await repo.listReviews(user.organizationId, facilityId) });
}

async function getReview(res, user, id) {
  const review = await requireReview(user.organizationId, id);
  sendJson(res, { status: 200, body: review });
}

async function exportPacket(req, res, user) {
  const body = await readJson(req);
  const review = await requireReview(user.organizationId, body.reviewId);
  const facility = await requireFacility(user.organizationId, review.facilityId);
  const evidence = await repo.listEvidence(user.organizationId, facility.id);
  const gapRows = await repo.getGapRows(user.organizationId, review.id);
  const actionItems = await repo.getActionItems(user.organizationId, review.id);
  const findings = await repo.getFindings(user.organizationId, review.id);
  const rulesPack = await repo.getRulesPack(review.rulesPackId) || RULES_PACKS.find((pack) => pack.rulesPackId === review.rulesPackId);
  const pdf = generateAuditPacketPdf({ facility, review, gapRows, actionItems, evidence, rulesPack, findings });
  const title = "Industrial Audit Readiness Packet";
  const saved = await storage.saveBuffer(pdf, `audit-packet-${facility.name}.pdf`);
  let packet;
  try {
    packet = await repo.createAuditPacket({
      organizationId: user.organizationId,
      facilityId: facility.id,
      reviewId: review.id,
      title,
      fileReference: saved.fileReference,
      generatedByUserId: user.id,
      country: facility.country,
      region: facility.region,
      rulesPackId: review.rulesPackId,
      status: "generated"
    });
  } catch (error) {
    await storage.deleteBuffer(saved.fileReference);
    throw error;
  }
  await audit(user, facility.id, "packet.exported", "audit_packet", packet.id, { reviewId: review.id });
  sendJson(res, { status: 201, body: { packet, downloadUrl: `/api/audit-packets/${packet.id}/download` } });
}

async function listPackets(res, user, facilityId) {
  if (facilityId) await requireFacility(user.organizationId, facilityId);
  sendJson(res, { status: 200, body: await repo.listAuditPackets(user.organizationId, facilityId) });
}

async function downloadPacket(res, user, id) {
  const packet = await repo.getAuditPacket(user.organizationId, id);
  if (!packet) {
    const error = new Error("Audit packet not found");
    error.status = 404;
    throw error;
  }
  const buffer = await storage.readBuffer(packet.fileReference);
  await audit(user, packet.facilityId, "packet.downloaded", "audit_packet", packet.id, {});
  sendBuffer(res, buffer, "application/pdf", `industrial-audit-readiness-packet-${packet.id}.pdf`);
}

async function requestExpertReview(req, res, user) {
  const body = await readJson(req);
  const facility = body.facilityId ? await requireFacility(user.organizationId, body.facilityId) : null;
  const review = body.reviewId ? await requireReview(user.organizationId, body.reviewId) : null;
  if (facility && review && review.facilityId !== facility.id) {
    throw validationError("reviewId must belong to the requested facility");
  }
  const item = await repo.createExpertReview({
    organizationId: user.organizationId,
    facilityId: facility?.id || review?.facilityId || null,
    reviewId: review?.id || null,
    requestedByUserId: user.id,
    status: "requested",
    expertNotes: body.expertNotes || null
  });
  await audit(user, item.facilityId || null, "expert_review.requested", "expert_review", item.id, {});
  sendJson(res, { status: 201, body: item });
}

async function updateExpertReview(req, res, user, id) {
  requireRole(user, ["admin", "reviewer"]);
  const body = await readJson(req);
  const item = await repo.updateExpertReview(user.organizationId, id, { status: body.status || "in_review", expertNotes: body.expertNotes || null });
  await audit(user, item.facilityId || null, "expert_review.updated", "expert_review", item.id, { status: item.status });
  sendJson(res, { status: 200, body: item });
}

async function listAuditLogs(res, user, facilityId) {
  if (facilityId) await requireFacility(user.organizationId, facilityId);
  sendJson(res, { status: 200, body: await repo.listAuditLogs(user.organizationId, facilityId) });
}

async function requireFacility(organizationId, id) {
  const facility = await repo.getFacility(organizationId, id);
  if (!facility) {
    const error = new Error("Facility not found");
    error.status = 404;
    throw error;
  }
  return facility;
}

async function requireEvidence(organizationId, id) {
  const evidence = await repo.getEvidence(organizationId, id);
  if (!evidence) {
    const error = new Error("Evidence not found");
    error.status = 404;
    throw error;
  }
  return evidence;
}

async function requireReview(organizationId, id) {
  const review = await repo.getReview(organizationId, id);
  if (!review) {
    const error = new Error("Review not found");
    error.status = 404;
    throw error;
  }
  return review;
}

function requireRole(user, roles) {
  if (!roles.includes(user.role)) {
    const error = new Error("Role is not authorized for this action");
    error.status = 403;
    throw error;
  }
}

async function audit(user, facilityId, action, entityType, entityId, metadata) {
  await repo.logAudit({ organizationId: user.organizationId, facilityId, actorUserId: user.id, action, entityType, entityId, metadata });
}

async function readJson(req, maxBytes = DEFAULT_JSON_LIMIT_BYTES) {
  const chunks = [];
  let totalBytes = 0;
  for await (const chunk of req) {
    totalBytes += chunk.byteLength;
    if (totalBytes > maxBytes) {
      const error = new Error("Request body is too large");
      error.status = 413;
      error.code = "PAYLOAD_TOO_LARGE";
      throw error;
    }
    chunks.push(chunk);
  }
  if (chunks.length === 0) return {};
  if (!String(req.headers["content-type"] || "").toLowerCase().startsWith("application/json")) {
    throw validationError("Content-Type must be application/json");
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw validationError("Invalid JSON request body");
  }
}

function sendJson(res, { status, body }) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

function sendBuffer(res, buffer, contentType, fileName) {
  res.writeHead(200, {
    "Content-Type": contentType,
    "Content-Length": buffer.byteLength,
    "Content-Disposition": `attachment; filename="${fileName}"`
  });
  res.end(buffer);
}

function parseCookies(header) {
  return Object.fromEntries(header.split(";").filter(Boolean).map((part) => {
    const index = part.indexOf("=");
    return [part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1).trim())];
  }));
}

function setCookie(res, name, value, options) {
  const parts = [`${name}=${encodeURIComponent(value)}`, "Path=/"];
  if (options.httpOnly) parts.push("HttpOnly");
  if (options.secure) parts.push("Secure");
  if (options.sameSite) parts.push(`SameSite=${options.sameSite}`);
  if (options.maxAge !== undefined) parts.push(`Max-Age=${options.maxAge}`);
  res.setHeader("Set-Cookie", parts.join("; "));
}

function applyCors(req, res) {
  const origin = req.headers.origin;
  if (origin && config.allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
  }
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
}

function enforceTrustedOrigin(req) {
  if (!["POST", "PATCH", "DELETE"].includes(req.method || "GET")) return;
  const origin = req.headers.origin;
  if (origin && !config.allowedOrigins.includes(origin)) throw forbidden("Origin is not allowed");
}

function match(path, pattern) {
  const a = path.split("/").filter(Boolean);
  const b = pattern.split("/").filter(Boolean);
  return a.length === b.length && b.every((part, i) => part.startsWith(":") || part === a[i]);
}

function params(path) {
  const parts = path.split("/").filter(Boolean);
  const id = parts[parts.length - 1] === "download" || parts[parts.length - 1] === "gap-matrix" || parts[parts.length - 1] === "score" || parts[parts.length - 1] === "action-plan" || parts[parts.length - 1] === "applicable-rules"
    ? parts[parts.length - 2]
    : parts[parts.length - 1];
  return { id };
}

function safeDownloadName(name) {
  return String(name || "download").replace(/[^a-z0-9_-]+/gi, "-").slice(0, 80);
}

function decodeBase64(value) {
  const encoded = String(value || "");
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)) {
    throw validationError("contentBase64 must be valid base64");
  }
  return Buffer.from(encoded, "base64");
}

if (process.env.NODE_ENV !== "test") {
  server.listen(config.port, config.apiHost, () => {
    process.stderr.write(`ComplianceIQ API listening on http://${config.apiHost}:${config.port}\n`);
  });
  const shutdown = () => server.close(async () => {
    await repo.close?.();
    process.exit(0);
  });
  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);
}

export { server, repo };
