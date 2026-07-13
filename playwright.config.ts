/**
 * Playwright end-to-end test configuration.
 *
 * Phase 1: scaffolding only. Tests are stubbed out — the real E2E suite
 * is built in Phase 2 alongside the CI pipeline.
 *
 * Run: `bunx playwright test`
 */

import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: "http://localhost:3001",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "mobile-safari",
      use: { ...devices["iPhone 14"] },
    },
  ],
  webServer: {
    command: "bun run dev",
    url: "http://localhost:3001",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
