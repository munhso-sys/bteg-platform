import { defineConfig, devices } from "@playwright/test";

const portal = process.env.E2E_PORTAL_URL || "http://127.0.0.1:3000";
const inspection = process.env.E2E_INSPECTION_URL || "http://127.0.0.1:3001";
const development = process.env.E2E_DEVELOPMENT_URL || "http://127.0.0.1:3003";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  use: {
    trace: "on-first-retry",
    ...devices["Desktop Chrome"],
  },
  projects: [
    { name: "portal", use: { baseURL: portal } },
    { name: "inspection", use: { baseURL: inspection } },
    { name: "development", use: { baseURL: development } },
  ],
});
