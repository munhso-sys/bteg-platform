import { defineConfig, devices } from "@playwright/test";

/**
 * Production-mode gate. URLs must be set by the gate runner.
 * Specs fail (not skip) when required URLs are missing under E2E_STRICT=1.
 */
const portal = process.env.E2E_PORTAL_URL || "";
const inspection = process.env.E2E_INSPECTION_URL || "";
const development = process.env.E2E_DEVELOPMENT_URL || "";

export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  use: {
    trace: "on-first-retry",
    ...devices["Desktop Chrome"],
    baseURL: portal || "http://127.0.0.1:3000",
  },
  metadata: { portal, inspection, development },
});
