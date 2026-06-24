import { test, expect } from "@playwright/test";

test("pilot workflow creates facility, logs evidence, generates gaps, and exports a packet", async ({ page }) => {
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
  await page.locator('#facility-form input[name="stateProvince"]').fill("Ontario");
  await page.locator('#facility-form input[name="region"]').fill("ON");
  await page.locator('#facility-form select[name="country"]').selectOption("CA");
  await page.locator('#facility-form input[name="machinery"]').check();
  await page.getByRole("button", { name: "Create Facility" }).click();
  await expect(page.locator("#facility-select")).toContainText("Pilot Fabrication Plant");

  await page.locator('#evidence-form input[name="title"]').fill("Machine guarding inspection log");
  await page.locator('#evidence-form select[name="evidenceType"]').selectOption("machine_guarding_inspections");
  await page.locator('#evidence-form textarea[name="description"]').fill("Manual pilot evidence entry.");
  await page.getByRole("button", { name: "Upload or Log Evidence" }).click();
  await expect(page.locator(".evidence-list").getByText("Machine guarding inspection log", { exact: true }).first()).toBeVisible();

  await page.getByRole("button", { name: "Generate Gap Matrix" }).click();
  await expect(page.getByRole("heading", { name: "Readiness Score Explanation" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Evidence Gap Matrix" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Evidence Review Queue" })).toBeVisible();

  await page.getByRole("button", { name: "Export Packet PDF" }).click();
  await expect(page.getByRole("heading", { name: "Generated Packets" }).locator(".." )).toContainText("Industrial Audit Readiness Packet");
  await page.screenshot({ path: "/tmp/complianceiq-pilot-smoke.png", fullPage: false });
  expect(browserErrors).toEqual([]);
  expect(networkErrors).toEqual([]);
});
