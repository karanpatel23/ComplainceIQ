import { test, expect } from "@playwright/test";

test("closed pilot workflow validates evidence processing, review, packet, deletion, and health", async ({ page, request }) => {
  const browserErrors = [];
  const networkErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error" && !/Failed to load resource:.*401 \(Unauthorized\)/.test(message.text())) browserErrors.push(message.text());
  });
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("response", (response) => {
    if (response.status() >= 400 && !(response.status() === 401 && response.url().endsWith("/api/auth/me"))) {
      networkErrors.push(`${response.status()} ${response.url()}`);
    }
  });
  await page.addInitScript(() => window.localStorage.setItem("ciq_api_base", "http://127.0.0.1:4100"));
  await page.goto("/");
  await expect(page).toHaveTitle(/ComplianceIQ/);
  await expect(page.locator("body")).not.toContainText("Internal Server Error");
  await page.getByLabel("Email").fill("pilot-admin@complianceiq.local");
  await page.getByLabel("Password").fill("PilotPassword#2026");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByRole("heading", { name: "Build an Industrial Audit Readiness Packet" })).toBeVisible();

  await page.locator('#facility-form input[name="name"]').fill("Pilot Fabrication Plant");
  await page.locator('#facility-form input[name="stateProvince"]').fill("Ohio");
  await page.locator('#facility-form input[name="region"]').fill("OH");
  await page.locator('#facility-form select[name="country"]').selectOption("US");
  await page.locator('#facility-form input[name="machinery"]').check();
  await page.locator('#facility-form input[name="lockoutTagout"]').check();
  await page.getByRole("button", { name: "Create Facility" }).click();
  await expect(page.locator("#facility-select")).toContainText("Pilot Fabrication Plant");

  await page.locator('#evidence-form input[name="title"]').fill("Pilot LOTO procedure");
  await page.locator('#evidence-form select[name="evidenceType"]').selectOption("other");
  await page.locator('#evidence-form textarea[name="description"]').fill("Synthetic lockout tagout procedure dated 2026-04-15.");
  await page.locator('#evidence-form input[name="file"]').setInputFiles({
    name: "pilot-loto.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("Synthetic lockout tagout procedure dated 2026-04-15. LOTO energy control steps.")
  });
  await page.getByRole("button", { name: "Upload or Log Evidence" }).click();
  const evidenceCard = page.locator(".evidence-card").filter({ hasText: "Pilot LOTO procedure" });
  await expect(evidenceCard).toBeVisible();
  await expect(evidenceCard).toContainText(/Processed|Needs review/, { timeout: 10_000 });
  await expect(page.locator(".review-queue-list")).toContainText("Pilot LOTO procedure");

  await page.getByRole("button", { name: "Generate Gap Matrix" }).click();
  await expect(page.getByRole("heading", { name: "Readiness Score Explanation" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Evidence Gap Matrix" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Evidence Review Queue" })).toBeVisible();
  const actionsBeforeReview = await page.locator(".action-grid article").count();
  const reviewForm = evidenceCard.locator("form.ai-review-form");
  await reviewForm.locator('select[name="evidenceType"]').selectOption("loto_procedures");
  await reviewForm.locator('select[name="ruleId"]').selectOption("us-loto-procedures");
  await reviewForm.locator('textarea[name="notes"]').fill("Closed-pilot human review override.");
  await reviewForm.getByRole("button", { name: "Apply override" }).click();
  await expect(evidenceCard).toContainText("Human reviewed");
  await evidenceCard.locator("form.ai-review-form").getByRole("button", { name: "Mark evidence accepted" }).click();
  await expect(evidenceCard).toContainText("accepted");
  const actionsAfterReview = await page.locator(".action-grid article").count();
  expect(actionsAfterReview).toBeLessThan(actionsBeforeReview);

  await page.getByRole("button", { name: "Export Packet PDF" }).click();
  await expect(page.getByRole("heading", { name: "Generated Packets" }).locator(".." )).toContainText("Industrial Audit Readiness Packet");
  const downloadPromise = page.waitForEvent("download");
  await page.locator("[data-packet-download]").click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/industrial-audit-readiness-packet/);
  await page.screenshot({ path: "/tmp/complianceiq-pilot-smoke.png", fullPage: false });

  page.once("dialog", (dialog) => dialog.accept());
  await page.locator("[data-archive-packet]").click();
  await expect(page.locator(".mini-list")).toContainText("No packets exported yet");
  page.once("dialog", (dialog) => dialog.accept());
  await evidenceCard.locator("[data-archive-evidence]").click();
  await expect(page.locator(".evidence-list")).not.toContainText("Pilot LOTO procedure");

  expect((await request.get("http://127.0.0.1:4100/health/live")).status()).toBe(200);
  expect((await request.get("http://127.0.0.1:4100/health/ready")).status()).toBe(200);
  expect(browserErrors).toEqual([]);
  expect(networkErrors).toEqual([]);
});
