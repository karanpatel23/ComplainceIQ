import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  workers: 1,
  fullyParallel: false,
  reporter: "line",
  outputDir: "/tmp/complianceiq-playwright-results",
  use: {
    baseURL: "http://127.0.0.1:5174",
    trace: "retain-on-failure",
    screenshot: "only-on-failure"
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } }
  ],
  webServer: [
    {
      command: "node scripts/start-e2e-api.mjs",
      url: "http://127.0.0.1:4100/health/ready",
      reuseExistingServer: false,
      timeout: 20_000
    },
    {
      command: "node scripts/start-e2e-web.mjs",
      url: "http://127.0.0.1:5174",
      reuseExistingServer: false,
      timeout: 20_000
    }
  ]
});
