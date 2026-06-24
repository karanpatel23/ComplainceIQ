const API_BASE = window.localStorage.getItem("ciq_api_base") || "http://localhost:4000";

const state = {
  user: null,
  organization: null,
  facilities: [],
  selectedFacilityId: null,
  evidence: [],
  evidenceTypes: ["other"],
  aiStatus: { enabled: false, provider: "disabled", model: null },
  aiAnalyses: [],
  processingJobs: [],
  reviewQueue: [],
  reviewQueueFilters: { status: "", priority: "" },
  applicableRules: [],
  latestReview: null,
  gapRows: [],
  actionItems: [],
  packets: [],
  error: ""
};

const root = document.querySelector("#app");

function render() {
  root.innerHTML = state.user ? appView() : loginView();
  bindEvents();
}

function loginView() {
  return `
    <main class="login-shell">
      <section class="login-panel">
        <p class="eyebrow">ComplianceIQ</p>
        <h1>Industrial Audit Readiness</h1>
        <p class="copy">Organize facility evidence, identify jurisdiction-specific gaps, and export audit-readiness packets for manufacturers across the US, Canada, and Mexico.</p>
        <form id="login-form" class="form-grid">
          <label>Email <input name="email" type="email" value="admin@complianceiq.local" required /></label>
          <label>Password <input name="password" type="password" required /></label>
          <button type="submit">Log in</button>
        </form>
        <p class="notice">Audit-preparation support only. Not legal advice. Starter rules are demo/unverified unless expert-reviewed.</p>
        ${errorHtml()}
      </section>
    </main>
  `;
}

function appView() {
  const facility = currentFacility();
  return `
    <div class="app-shell">
      <aside class="sidebar">
        <div class="brand">
          <strong>ComplianceIQ</strong>
          <span>Industrial Audit Readiness</span>
        </div>
        <nav>
          <a class="active">Audit Packet Builder</a>
          <a>Facilities</a>
          <a>Evidence</a>
          ${canReview() ? "<a>Evidence Review Queue</a>" : ""}
          <a>Gap Matrix</a>
          <a>Action Plan</a>
          <a>Audit Packets</a>
          <a>Expert Review</a>
          <a>Admin</a>
        </nav>
        <button id="logout" class="secondary">Log out</button>
      </aside>
      <main class="workspace">
        <header class="topbar">
          <div>
            <p class="eyebrow">Audit Packet Builder</p>
            <h1>Build an Industrial Audit Readiness Packet</h1>
          </div>
          <div class="user-pill">${html(state.user.email)}</div>
        </header>
        ${errorHtml()}
        <section class="builder-band ai-band">
          <div>
            <h2>AI Evidence Intelligence</h2>
            <p>${state.aiStatus.enabled
              ? `AI-assisted classification is enabled through ${html(state.aiStatus.provider)}. Suggestions remain subject to deterministic rules and human review.`
              : "AI analysis is disabled. Manual evidence logging, deterministic gap analysis, review, and packet export remain available."}</p>
          </div>
          <span class="status ${state.aiStatus.enabled ? "accepted" : "partial"}">${state.aiStatus.enabled ? "AI enabled" : "AI disabled"}</span>
        </section>
        <section class="summary-grid">
          <div class="metric"><span>Selected facility</span><strong>${facility ? html(facility.name) : "None"}</strong></div>
          <div class="metric"><span>Jurisdiction</span><strong>${facility ? `${html(facility.country)} / ${html(facility.region)}` : "Select facility"}</strong></div>
          <div class="metric"><span>Readiness score</span><strong>${state.latestReview ? `${state.latestReview.readinessScore}/100` : "Not generated"}</strong></div>
          <div class="metric critical"><span>Critical gaps</span><strong>${state.latestReview?.summary?.criticalGapsCount ?? 0}</strong></div>
        </section>
        <section class="two-column">
          ${facilityPanel()}
          ${evidencePanel()}
        </section>
        ${reviewQueuePanel()}
        <section class="builder-band">
          <div>
            <h2>Jurisdiction-specific rules pack</h2>
            <p>${facility ? `Backend-selected pack: ${html(facility.selectedRulesPackId || "selection pending")}. Rules use country, region, industry, facility type, employee count, and hazard profile.` : "Create or select a facility to view rules pack context."}</p>
          </div>
          <button id="generate-review" ${facility ? "" : "disabled"}>Generate Gap Matrix</button>
        </section>
        ${scorePanel()}
        ${gapMatrix()}
        ${actionPlan()}
        ${packetPanel()}
      </main>
    </div>
  `;
}

function facilityPanel() {
  const options = state.facilities.map((facility) => `<option value="${html(facility.id)}" ${facility.id === state.selectedFacilityId ? "selected" : ""}>${html(facility.name)} (${html(facility.country)}/${html(facility.region)})</option>`).join("");
  return `
    <section class="panel">
      <h2>Facility Setup</h2>
      <label>Active facility
        <select id="facility-select">
          <option value="">Choose facility</option>
          ${options}
        </select>
      </label>
      <form id="facility-form" class="form-grid compact">
        <input name="name" placeholder="Facility name" required />
        <select name="country" required>
          <option value="US">United States</option>
          <option value="CA">Canada</option>
          <option value="MX">Mexico</option>
        </select>
        <input name="stateProvince" placeholder="State / province / territory" required />
        <input name="region" placeholder="Region code, e.g. OH, ON, NL" required />
        <input name="jurisdictionCode" placeholder="Jurisdiction code, e.g. US-OH" />
        <input name="industry" value="industrial_manufacturing" required />
        <input name="facilityType" value="metal_fabrication" required />
        <input name="employeeCount" type="number" value="75" min="0" />
        <div class="checks">
          ${hazardCheckbox("machinery", "Machinery")}
          ${hazardCheckbox("hazardousChemicals", "Hazardous chemicals")}
          ${hazardCheckbox("forklifts", "Forklifts")}
          ${hazardCheckbox("lockoutTagout", "Lockout/Tagout")}
          ${hazardCheckbox("ppe", "PPE")}
          ${hazardCheckbox("respiratoryHazards", "Respiratory")}
          ${hazardCheckbox("hearingNoise", "Noise")}
          ${hazardCheckbox("hazardousWaste", "Hazardous waste")}
          ${hazardCheckbox("oilFuelStorage", "Oil/fuel storage")}
        </div>
        <button type="submit">Create Facility</button>
      </form>
    </section>
  `;
}

function evidencePanel() {
  const facility = currentFacility();
  return `
    <section class="panel">
      <h2>Evidence Upload and Intelligence</h2>
      <form id="evidence-form" class="form-grid compact">
        <input name="title" placeholder="Evidence title" required ${facility ? "" : "disabled"} />
        <select name="evidenceType" required ${facility ? "" : "disabled"}>
          ${state.evidenceTypes.map((type) => `<option value="${html(type)}">${html(label(type))}</option>`).join("")}
        </select>
        <select name="status">
          <option value="pending">Pending</option>
          <option value="needs_review">Needs review</option>
          <option value="expired">Expired</option>
        </select>
        <input name="expirationDate" type="date" />
        <label>Private file (optional)<input name="file" type="file" ${facility ? "" : "disabled"} /></label>
        <textarea name="description" placeholder="Notes"></textarea>
        <button type="submit" ${facility ? "" : "disabled"}>Upload or Log Evidence</button>
      </form>
      <div class="evidence-list">
        ${state.evidence.length ? state.evidence.map(evidenceCard).join("") : "<p>No evidence logged for this facility.</p>"}
      </div>
    </section>
  `;
}

function evidenceCard(item) {
  const analysis = state.aiAnalyses.find((entry) => entry.evidenceId === item.id);
  const job = state.processingJobs.find((entry) => entry.evidenceId === item.id);
  const active = ["queued", "processing"].includes(job?.status);
  const blocked = ["scan_suspicious", "scan_pending"].includes(item.scanStatus);
  return `
    <article class="evidence-card">
      <div class="evidence-heading">
        <div><strong>${html(item.title)}</strong><span>${html(label(item.evidenceType))} · ${html(item.status)}${item.fileName ? ` · ${html(item.fileName)}` : ""}</span></div>
        <div class="review-actions">
          <button class="secondary" data-process-ai="${html(item.id)}" ${state.aiStatus.enabled && !active && !blocked ? "" : "disabled"}>${active ? "Processing…" : analysis ? "Queue reprocessing" : "Queue AI processing"}</button>
          ${canReview() ? `<button class="danger-button" data-archive-evidence="${html(item.id)}">Archive evidence</button>` : ""}
        </div>
      </div>
      ${processingBadges(item, job, analysis)}
      ${analysis ? aiAnalysisDetails(analysis) : `<p class="muted">No AI analysis yet. ${state.aiStatus.enabled ? "Processing begins after the private scan and queue claim." : "AI is disabled; manual review remains available."}</p>`}
      ${analysis && canReview() ? aiReviewForm(item, analysis) : ""}
    </article>
  `;
}

function processingBadges(item, job, analysis) {
  const lifecycle = processingLabel(item, job, analysis);
  return `
    <div class="badge-row processing-row">
      <span class="status ${statusTone(item.scanStatus)}">${html(label(item.scanStatus || "scan_unavailable"))}</span>
      <span class="status ${statusTone(lifecycle.code)}">${html(lifecycle.text)}</span>
      ${job ? `<span class="status">Attempt ${job.processingAttempts}/${job.maxAttempts}</span>` : ""}
    </div>
    ${(job?.lastProcessingError || item.scanError) ? `<p class="processing-error">${html(job?.lastProcessingError || item.scanError)}</p>` : ""}
  `;
}

function processingLabel(item, job, analysis) {
  if (item.scanStatus === "scan_suspicious") return { code: "blocked", text: "Suspicious / blocked" };
  if (item.scanStatus === "scan_pending") return { code: "queued", text: "Scan pending" };
  if (analysis?.textExtractionStatus === "ocr_required") return { code: "ocr_required", text: "OCR / manual review required" };
  if (job?.status === "queued") return { code: "queued", text: "Processing queued" };
  if (job?.status === "processing") return { code: "processing", text: "Extracting text / AI analyzing" };
  if (["failed", "dead_letter"].includes(job?.status) || analysis?.processingStatus === "failed") return { code: "failed", text: job?.status === "dead_letter" ? "Dead letter / operator review" : "Processing failed" };
  if (analysis?.processingStatus === "needs_review") return { code: "needs_review", text: "Needs review" };
  if (analysis?.processingStatus === "processed") return { code: "processed", text: "Processed" };
  return { code: "uploaded", text: "Uploaded" };
}

function aiAnalysisDetails(analysis) {
  const confidence = analysis.confidence === null || analysis.confidence === undefined ? "N/A" : `${Math.round(analysis.confidence * 100)}%`;
  return `
    <div class="ai-analysis">
      <div class="badge-row">
        <span class="status ${analysis.processingStatus === "processed" ? "accepted" : "partial"}">${html(label(analysis.processingStatus))}</span>
        <span class="status">Confidence ${html(confidence)}</span>
        <span class="status ${analysis.humanReviewed ? "accepted" : analysis.needsHumanReview ? "partial" : ""}">${analysis.humanReviewed ? "Human reviewed" : analysis.needsHumanReview ? "Needs review" : "AI matched"}</span>
      </div>
      <p><strong>Analysis version:</strong> ${html(analysis.analysisVersion || 1)} · <strong>Extraction:</strong> ${html(label(analysis.textExtractionStatus || "not_started"))}</p>
      <p><strong>Likely type:</strong> ${html(label(analysis.detectedEvidenceType || "other"))}</p>
      <p>${html(analysis.summary || analysis.error || "No summary available.")}</p>
      <p><strong>Suggested obligation:</strong> ${html(analysis.suggestedObligationTitle || "No suggestion")}<br><strong>Reason:</strong> ${html(analysis.matchReason || "No AI match reason")}</p>
      <p><strong>Extracted dates:</strong> ${html(analysis.extractedDocumentDate || "unknown")} / expires ${html(analysis.extractedExpirationDate || "unknown")}</p>
      <p><strong>Extracted fields:</strong> employees ${html((analysis.extractedEmployeeNames || []).join(", ") || "none")}; equipment ${html((analysis.extractedEquipmentNames || []).join(", ") || "none")}; chemicals ${html((analysis.extractedChemicalNames || []).join(", ") || "none")}; signature ${analysis.extractedSignaturePresent === null ? "unknown" : analysis.extractedSignaturePresent ? "present" : "not detected"}</p>
      ${(analysis.issues || []).length ? `<ul>${analysis.issues.map((issue) => `<li>${html(issue)}</li>`).join("")}</ul>` : ""}
    </div>
  `;
}

function aiReviewForm(item, analysis) {
  return `
    <form class="ai-review-form" data-ai-review="${html(item.id)}">
      <select name="evidenceType">
        <option value="">Keep current evidence type</option>
        ${state.evidenceTypes.map((type) => `<option value="${html(type)}" ${type === (analysis.humanOverrideEvidenceType || analysis.detectedEvidenceType) ? "selected" : ""}>${html(label(type))}</option>`).join("")}
      </select>
      <select name="ruleId">
        <option value="">Keep current obligation match</option>
        ${state.applicableRules.map((rule) => `<option value="${html(rule.id)}" ${rule.id === (analysis.humanOverrideRuleId || analysis.suggestedRuleId) ? "selected" : ""}>${html(rule.title)}</option>`).join("")}
      </select>
      <textarea name="notes" placeholder="Human review notes">${html(analysis.humanReviewNotes || "")}</textarea>
      <div class="review-actions">
        <button type="submit" name="action" value="accept_ai">Accept classification</button>
        <button type="submit" name="action" value="override" class="secondary">Apply override</button>
        <button type="submit" name="action" value="mark_accepted">Mark evidence accepted</button>
        <button type="submit" name="action" value="mark_rejected" class="danger-button">Reject evidence</button>
        <button type="submit" name="action" value="mark_needs_review" class="secondary">Keep in review</button>
        <button type="submit" name="action" value="request_more_evidence" class="secondary">Request more evidence</button>
      </div>
    </form>
  `;
}

function reviewQueuePanel() {
  if (!canReview()) return "";
  const statusOptions = ["", "needs_review", "low_confidence", "medium_confidence", "extraction_failed", "ocr_required", "suspicious_scan", "expired", "rejected", "unmatched", "high_priority_impact", "processing_failed"];
  const priorityOptions = ["", "critical", "high", "medium", "low"];
  return `
    <section class="panel review-queue-panel">
      <div class="queue-heading">
        <div><p class="eyebrow">Reviewer operations</p><h2>Evidence Review Queue</h2><p>Tenant-scoped evidence requiring a human decision, safer extraction, or processing recovery.</p></div>
        <form id="review-queue-filters" class="queue-filters">
          <label>Status<select name="status">${statusOptions.map((value) => `<option value="${value}" ${value === state.reviewQueueFilters.status ? "selected" : ""}>${html(value ? label(value) : "All review states")}</option>`).join("")}</select></label>
          <label>Priority impact<select name="priority">${priorityOptions.map((value) => `<option value="${value}" ${value === state.reviewQueueFilters.priority ? "selected" : ""}>${html(value ? label(value) : "All priorities")}</option>`).join("")}</select></label>
        </form>
      </div>
      <div class="review-queue-list">
        ${state.reviewQueue.length ? state.reviewQueue.map(reviewQueueCard).join("") : "<p>No evidence matches the selected review filters.</p>"}
      </div>
    </section>
  `;
}

function reviewQueueCard(item) {
  const evidence = state.evidence.find((entry) => entry.id === item.id);
  const analysis = state.aiAnalyses.find((entry) => entry.evidenceId === item.id);
  const canRetry = item.processingStatus === "failed" || item.categories.some((category) => ["processing_failed", "extraction_failed", "ocr_required"].includes(category));
  return `
    <article class="review-queue-card ${item.scanStatus === "scan_suspicious" ? "blocked-card" : ""}">
      <div class="queue-card-summary">
        <div><strong>${html(item.evidenceTitle)}</strong><span>${html(item.facilityName)} · ${html(item.fileName || "Manual evidence")}</span></div>
        <div class="badge-row">
          <span class="status ${statusTone(item.priorityImpact)}">${html(item.priorityImpact)} impact</span>
          <span class="status">${item.confidence === null ? "No confidence" : `${Math.round(item.confidence * 100)}% confidence`}</span>
          <span class="status ${statusTone(item.processingStatus)}">${html(label(item.processingStatus))}</span>
        </div>
      </div>
      <p><strong>Likely type:</strong> ${html(label(item.detectedEvidenceType || "other"))} · <strong>Suggested obligation:</strong> ${html(item.suggestedObligationTitle || "Unmatched")}</p>
      <p><strong>Review reasons:</strong> ${item.categories.map((category) => html(label(category))).join(", ")}</p>
      ${item.issueSummary.length ? `<ul>${item.issueSummary.map((issue) => `<li>${html(issue)}</li>`).join("")}</ul>` : ""}
      ${canRetry && item.scanStatus !== "scan_suspicious" ? `<button class="secondary" data-retry-processing="${html(item.id)}">Retry processing</button>` : ""}
      ${evidence && analysis ? aiReviewForm(evidence, analysis) : ""}
    </article>
  `;
}

function canReview() {
  return ["admin", "reviewer"].includes(state.user?.role);
}

function statusTone(value) {
  if (["processed", "scan_clean", "accepted"].includes(value)) return "accepted";
  if (["failed", "dead_letter", "blocked", "scan_suspicious", "critical", "rejected"].includes(value)) return "rejected";
  if (["queued", "processing", "needs_review", "ocr_required", "high", "medium", "scan_unavailable"].includes(value)) return "partial";
  return "";
}

function scorePanel() {
  if (!state.latestReview) return "";
  return `
    <section class="panel">
      <h2>Readiness Score Explanation</h2>
      <div class="score-row">
        <strong>${state.latestReview.readinessScore}/100</strong>
        <ul>${state.latestReview.scoreExplanation.map((line) => `<li>${html(line)}</li>`).join("")}</ul>
      </div>
    </section>
  `;
}

function gapMatrix() {
  return `
    <section class="panel">
      <h2>Evidence Gap Matrix</h2>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Priority</th><th>Status</th><th>Jurisdiction</th><th>Authority</th><th>Citation</th><th>Obligation</th><th>Required Evidence</th><th>AI lineage</th><th>Demo</th></tr></thead>
          <tbody>
            ${state.gapRows.length ? state.gapRows.map((row) => `
              <tr class="${html(row.priority)}">
                <td>${html(row.priority)}</td>
                <td><span class="status ${html(row.status)}">${html(row.status)}</span></td>
                <td>${html(row.country)}/${html(row.region)}</td>
                <td>${html(row.authority)}</td>
                <td>${html(row.citation)}</td>
                <td>${html(row.obligationTitle)}</td>
                <td>${row.requiredEvidence.map(html).join(", ")}</td>
                <td>${gapAiInsights(row)}</td>
                <td>${row.demoContent ? "Unverified" : "Reviewed"}</td>
              </tr>
            `).join("") : `<tr><td colspan="9">Generate a backend review to populate the matrix.</td></tr>`}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function gapAiInsights(row) {
  if (!row.aiInsights?.length) return "No AI suggestion";
  return row.aiInsights.map((insight) => `
    <div class="matrix-ai">
      <strong>${html(label(insight.detectedEvidenceType || "other"))}</strong>
      <span>${html(insight.matchSource)} · ${insight.confidence === null || insight.confidence === undefined ? "N/A" : `${Math.round(insight.confidence * 100)}%`}</span>
      <span>v${html(insight.analysisVersion || 1)} · ${html(label(insight.textExtractionStatus || "not_started"))}</span>
      <span>${insight.humanReviewed ? "Human reviewed" : insight.needsHumanReview ? "Needs review" : "AI matched"}</span>
    </div>
  `).join("");
}

function actionPlan() {
  const groups = ["urgent_7_days", "30_days", "90_days"];
  return `
    <section class="panel">
      <h2>Action Plan</h2>
      <div class="action-grid">
        ${groups.map((bucket) => `
          <div>
            <h3>${bucket.replace("_", " / ").replace("_", " ")}</h3>
            ${(state.actionItems.filter((item) => item.bucket === bucket).map((item) => `<article><strong>${html(item.title)}</strong><span>${html(item.ownerRole)} · ${html(item.dueDate)}</span><p>${html(item.recommendedNextStep)}</p></article>`).join("")) || "<p>No actions in this bucket.</p>"}
          </div>
        `).join("")}
      </div>
    </section>
  `;
}

function packetPanel() {
  return `
    <section class="builder-band">
      <div>
        <h2>Audit Packet Export</h2>
        <p>Exports are generated from backend-stored facility, evidence, gap matrix, findings, action plan, and ${state.aiAnalyses.length ? "AI audit-lineage" : "available lineage"} data.</p>
      </div>
      <button id="export-packet" ${state.latestReview ? "" : "disabled"}>Export Packet PDF</button>
    </section>
    <section class="panel">
      <h2>Generated Packets</h2>
      <div class="mini-list">${state.packets.length ? state.packets.map((packet) => `<div><strong>${html(packet.title)}</strong><span>${html(packet.generatedAt)}</span><button class="secondary" data-packet-download="${html(packet.id)}">Download</button>${canReview() ? `<button class="danger-button" data-archive-packet="${html(packet.id)}">Archive</button>` : ""}</div>`).join("") : "<p>No packets exported yet.</p>"}</div>
    </section>
  `;
}

function hazardCheckbox(name, label) {
  return `<label><input type="checkbox" name="${name}" /> ${label}</label>`;
}

function errorHtml() {
  return state.error ? `<div class="error">${html(state.error)}</div>` : "";
}

function currentFacility() {
  return state.facilities.find((facility) => facility.id === state.selectedFacilityId) || state.facilities[0] || null;
}

function bindEvents() {
  const login = document.querySelector("#login-form");
  if (login) login.addEventListener("submit", onLogin);
  document.querySelector("#logout")?.addEventListener("click", onLogout);
  document.querySelector("#facility-form")?.addEventListener("submit", onCreateFacility);
  document.querySelector("#facility-select")?.addEventListener("change", async (event) => {
    state.selectedFacilityId = event.target.value;
    await refreshFacilityData();
  });
  document.querySelector("#evidence-form")?.addEventListener("submit", onCreateEvidence);
  document.querySelector("#generate-review")?.addEventListener("click", onGenerateReview);
  document.querySelector("#export-packet")?.addEventListener("click", onExportPacket);
  document.querySelectorAll("[data-process-ai]").forEach((button) => button.addEventListener("click", () => onProcessAi(button.dataset.processAi)));
  document.querySelectorAll("[data-retry-processing]").forEach((button) => button.addEventListener("click", () => onRetryProcessing(button.dataset.retryProcessing)));
  document.querySelectorAll("[data-ai-review]").forEach((form) => form.addEventListener("submit", onReviewAi));
  document.querySelectorAll("[data-packet-download]").forEach((button) => button.addEventListener("click", () => onDownloadPacket(button.dataset.packetDownload)));
  document.querySelectorAll("[data-archive-evidence]").forEach((button) => button.addEventListener("click", () => onArchiveEvidence(button.dataset.archiveEvidence)));
  document.querySelectorAll("[data-archive-packet]").forEach((button) => button.addEventListener("click", () => onArchivePacket(button.dataset.archivePacket)));
  document.querySelector("#review-queue-filters")?.addEventListener("change", onReviewQueueFilter);
}

async function onLogin(event) {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.target));
  await run(async () => {
    const result = await api("/api/auth/login", { method: "POST", body: data });
    state.user = result.user;
    await bootstrap();
  });
}

async function onLogout() {
  await run(async () => {
    await api("/api/auth/logout", { method: "POST", body: {} });
    Object.assign(state, { user: null, organization: null, facilities: [], selectedFacilityId: null, evidence: [], aiAnalyses: [], processingJobs: [], reviewQueue: [], applicableRules: [], latestReview: null, gapRows: [], actionItems: [], packets: [] });
    render();
  });
}

async function bootstrap() {
  [state.organization, state.facilities, state.aiStatus, state.evidenceTypes] = await Promise.all([
    api("/api/organization"),
    api("/api/facilities"),
    api("/api/ai/status"),
    api("/api/evidence-taxonomy")
  ]);
  state.selectedFacilityId = state.facilities[0]?.id || null;
  await refreshFacilityData();
}

async function refreshFacilityData() {
  const facility = currentFacility();
  if (!facility) {
    state.evidence = [];
    state.aiAnalyses = [];
    state.processingJobs = [];
    state.reviewQueue = [];
    state.applicableRules = [];
    state.packets = [];
    state.latestReview = null;
    state.gapRows = [];
    state.actionItems = [];
    render();
    return;
  }
  const facilityId = encodeURIComponent(facility.id);
  const [evidence, packets, reviews, aiAnalyses, applicable, processingJobs] = await Promise.all([
    api(`/api/evidence?facilityId=${facilityId}`),
    api(`/api/audit-packets?facilityId=${facilityId}`),
    api(`/api/audit-readiness/reviews?facilityId=${facilityId}`),
    api(`/api/evidence-ai-analyses?facilityId=${facilityId}`),
    api(`/api/facilities/${facilityId}/applicable-rules`),
    api(`/api/evidence-processing-jobs?facilityId=${facilityId}`)
  ]);
  state.evidence = evidence;
  state.packets = packets;
  state.aiAnalyses = aiAnalyses;
  state.processingJobs = processingJobs;
  state.applicableRules = applicable.rules || [];
  state.latestReview = reviews[0] || null;
  if (state.latestReview) {
    const reviewId = encodeURIComponent(state.latestReview.id);
    [state.gapRows, state.actionItems] = await Promise.all([
      api(`/api/audit-readiness/reviews/${reviewId}/gap-matrix`),
      api(`/api/audit-readiness/reviews/${reviewId}/action-plan`)
    ]);
  } else {
    state.gapRows = [];
    state.actionItems = [];
  }
  if (canReview()) await refreshReviewQueue(false);
  render();
}

async function onCreateFacility(event) {
  event.preventDefault();
  const form = new FormData(event.target);
  const country = String(form.get("country") || "");
  const region = String(form.get("region") || "");
  const body = {
    name: form.get("name"),
    country,
    stateProvince: form.get("stateProvince"),
    region,
    jurisdictionCode: String(form.get("jurisdictionCode") || "").trim() || `${country}-${region}`,
    industry: form.get("industry"),
    facilityType: form.get("facilityType"),
    employeeCount: Number(form.get("employeeCount")),
    hazardProfile: Object.fromEntries(["machinery", "hazardousChemicals", "forklifts", "lockoutTagout", "ppe", "respiratoryHazards", "hearingNoise", "hazardousWaste", "oilFuelStorage"].map((key) => [key, form.get(key) === "on"]))
  };
  await run(async () => {
    const facility = await api("/api/facilities", { method: "POST", body });
    state.facilities.unshift(facility);
    state.selectedFacilityId = facility.id;
    await refreshFacilityData();
  });
}

async function onCreateEvidence(event) {
  event.preventDefault();
  const facility = currentFacility();
  const form = new FormData(event.target);
  const file = form.get("file");
  const body = Object.fromEntries([...form.entries()].filter(([key]) => key !== "file"));
  body.facilityId = facility.id;
  await run(async () => {
    if (file instanceof File && file.size > 0) {
      body.fileName = file.name;
      body.contentType = file.type || "application/octet-stream";
      body.contentBase64 = await fileToBase64(file);
      await api("/api/evidence/upload", { method: "POST", body });
    } else {
      await api("/api/evidence", { method: "POST", body });
    }
    await refreshFacilityData();
  });
}

async function onProcessAi(evidenceId) {
  await run(async () => {
    await api(`/api/evidence/${encodeURIComponent(evidenceId)}/process-ai`, { method: "POST", body: {} });
    await refreshFacilityData();
  });
}

async function onRetryProcessing(evidenceId) {
  await run(async () => {
    await api(`/api/evidence/${encodeURIComponent(evidenceId)}/retry-processing`, { method: "POST", body: {} });
    await refreshFacilityData();
  });
}

async function onReviewQueueFilter(event) {
  const form = new FormData(event.currentTarget);
  state.reviewQueueFilters = { status: String(form.get("status") || ""), priority: String(form.get("priority") || "") };
  await run(async () => refreshReviewQueue());
}

async function refreshReviewQueue(shouldRender = true) {
  const facility = currentFacility();
  if (!canReview() || !facility) {
    state.reviewQueue = [];
    return;
  }
  const params = new URLSearchParams({ facilityId: facility.id });
  if (state.reviewQueueFilters.status) params.set("status", state.reviewQueueFilters.status);
  if (state.reviewQueueFilters.priority) params.set("priority", state.reviewQueueFilters.priority);
  state.reviewQueue = await api(`/api/evidence-review-queue?${params}`);
  if (shouldRender) render();
}

async function onReviewAi(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const action = event.submitter?.value;
  await run(async () => {
    await api(`/api/evidence/${encodeURIComponent(event.currentTarget.dataset.aiReview)}/ai-review`, {
      method: "PATCH",
      body: { action, evidenceType: form.get("evidenceType"), ruleId: form.get("ruleId"), notes: form.get("notes") }
    });
    await refreshFacilityData();
  });
}

async function onGenerateReview() {
  const facility = currentFacility();
  await run(async () => {
    const result = await api("/api/audit-readiness/reviews", { method: "POST", body: { facilityId: facility.id } });
    state.latestReview = result.review;
    state.gapRows = result.gapRows;
    state.actionItems = result.actionPlan;
    render();
  });
}

async function onExportPacket() {
  await run(async () => {
    const result = await api("/api/audit-packets/export", { method: "POST", body: { reviewId: state.latestReview.id } });
    state.packets.unshift(result.packet);
    render();
  });
}

async function onDownloadPacket(packetId) {
  await run(async () => {
    const response = await fetch(`${API_BASE}/api/audit-packets/${encodeURIComponent(packetId)}/download`, { credentials: "include" });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || `Packet download failed: ${response.status}`);
    }
    const url = URL.createObjectURL(await response.blob());
    const link = document.createElement("a");
    link.href = url;
    link.download = `industrial-audit-readiness-packet-${packetId}.pdf`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  });
}

async function onArchiveEvidence(evidenceId) {
  if (!window.confirm("Archive this evidence record and delete its private file? Audit history will remain.")) return;
  await run(async () => {
    await api(`/api/evidence/${encodeURIComponent(evidenceId)}?reason=${encodeURIComponent("Archived from Audit Packet Builder")}`, { method: "DELETE" });
    await refreshFacilityData();
  });
}

async function onArchivePacket(packetId) {
  if (!window.confirm("Archive this packet and delete its generated private PDF? Audit history will remain.")) return;
  await run(async () => {
    await api(`/api/audit-packets/${encodeURIComponent(packetId)}?reason=${encodeURIComponent("Archived from Audit Packet Builder")}`, { method: "DELETE" });
    await refreshFacilityData();
  });
}

async function run(work) {
  state.error = "";
  try {
    await work();
  } catch (error) {
    state.error = error.message;
    render();
  }
}

async function api(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    method: options.method || "GET",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || `API request failed: ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return data;
}

function html(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function label(value) {
  return String(value || "").replaceAll("_", " ");
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read the selected file"));
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.readAsDataURL(file);
  });
}

async function initialize() {
  try {
    state.user = await api("/api/auth/me");
    await bootstrap();
  } catch (error) {
    state.user = null;
    if (error.status !== 401) state.error = error.message;
    render();
  }
}

initialize();

let polling = false;
window.setInterval(async () => {
  if (!state.user || polling || !state.processingJobs.some((job) => ["queued", "processing"].includes(job.status))) return;
  polling = true;
  try {
    await refreshFacilityData();
  } catch (error) {
    state.error = error.message;
    render();
  } finally {
    polling = false;
  }
}, 2_500);
