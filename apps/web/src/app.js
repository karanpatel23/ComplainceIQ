const API_BASE = window.localStorage.getItem("ciq_api_base") || "http://localhost:4000";

const state = {
  user: null,
  organization: null,
  facilities: [],
  selectedFacilityId: null,
  evidence: [],
  latestReview: null,
  gapRows: [],
  actionItems: [],
  packets: [],
  error: ""
};

const evidenceTypes = [
  "chemical_inventory",
  "sds_library",
  "written_hazcom_program",
  "hazcom_training_records",
  "loto_procedures",
  "loto_training_records",
  "machine_guarding_inspections",
  "ppe_hazard_assessment",
  "ppe_training_records",
  "respiratory_program",
  "fit_test_records",
  "noise_monitoring_records",
  "osha_300_log",
  "emergency_action_plan",
  "fire_extinguisher_inspections",
  "forklift_training_records",
  "hazardous_waste_determination",
  "hazardous_waste_manifests",
  "spcc_threshold_review",
  "whmis_training_records",
  "safety_training_records"
];

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
      <h2>Evidence Upload / Logging</h2>
      <form id="evidence-form" class="form-grid compact">
        <input name="title" placeholder="Evidence title" required ${facility ? "" : "disabled"} />
        <select name="evidenceType" required ${facility ? "" : "disabled"}>
          ${evidenceTypes.map((type) => `<option value="${type}">${type.replaceAll("_", " ")}</option>`).join("")}
        </select>
        <select name="status">
          <option value="pending">Pending</option>
          <option value="accepted">Accepted</option>
          <option value="needs_review">Needs review</option>
          <option value="rejected">Rejected</option>
          <option value="expired">Expired</option>
        </select>
        <input name="expirationDate" type="date" />
        <textarea name="description" placeholder="Notes"></textarea>
        <button type="submit" ${facility ? "" : "disabled"}>Log Evidence</button>
      </form>
      <div class="mini-list">
        ${state.evidence.length ? state.evidence.map((item) => `<div><strong>${html(item.title)}</strong><span>${html(item.evidenceType)} · ${html(item.status)}</span></div>`).join("") : "<p>No evidence logged for this facility.</p>"}
      </div>
    </section>
  `;
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
          <thead><tr><th>Priority</th><th>Status</th><th>Jurisdiction</th><th>Authority</th><th>Citation</th><th>Obligation</th><th>Required Evidence</th><th>Demo</th></tr></thead>
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
                <td>${row.demoContent ? "Unverified" : "Reviewed"}</td>
              </tr>
            `).join("") : `<tr><td colspan="8">Generate a backend review to populate the matrix.</td></tr>`}
          </tbody>
        </table>
      </div>
    </section>
  `;
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
        <p>Exports are generated from backend-stored facility, evidence, gap matrix, findings, and action plan data.</p>
      </div>
      <button id="export-packet" ${state.latestReview ? "" : "disabled"}>Export Packet PDF</button>
    </section>
    <section class="panel">
      <h2>Generated Packets</h2>
      <div class="mini-list">${state.packets.length ? state.packets.map((packet) => `<div><strong>${html(packet.title)}</strong><span>${html(packet.generatedAt)}</span><button class="secondary" data-packet-download="${html(packet.id)}">Download</button></div>`).join("") : "<p>No packets exported yet.</p>"}</div>
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
  document.querySelectorAll("[data-packet-download]").forEach((button) => button.addEventListener("click", () => onDownloadPacket(button.dataset.packetDownload)));
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
    Object.assign(state, { user: null, organization: null, facilities: [], selectedFacilityId: null, evidence: [], latestReview: null, gapRows: [], actionItems: [], packets: [] });
    render();
  });
}

async function bootstrap() {
  state.organization = await api("/api/organization");
  state.facilities = await api("/api/facilities");
  state.selectedFacilityId = state.facilities[0]?.id || null;
  await refreshFacilityData();
}

async function refreshFacilityData() {
  const facility = currentFacility();
  if (!facility) {
    state.evidence = [];
    state.packets = [];
    state.latestReview = null;
    state.gapRows = [];
    state.actionItems = [];
    render();
    return;
  }
  const facilityId = encodeURIComponent(facility.id);
  const [evidence, packets, reviews] = await Promise.all([
    api(`/api/evidence?facilityId=${facilityId}`),
    api(`/api/audit-packets?facilityId=${facilityId}`),
    api(`/api/audit-readiness/reviews?facilityId=${facilityId}`)
  ]);
  state.evidence = evidence;
  state.packets = packets;
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
  render();
}

async function onCreateFacility(event) {
  event.preventDefault();
  const form = new FormData(event.target);
  const body = {
    name: form.get("name"),
    country: form.get("country"),
    stateProvince: form.get("stateProvince"),
    region: form.get("region"),
    jurisdictionCode: form.get("jurisdictionCode"),
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
  const body = Object.fromEntries(new FormData(event.target));
  body.facilityId = facility.id;
  await run(async () => {
    await api("/api/evidence", { method: "POST", body });
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
