import { test, expect } from "@playwright/test";

/**
 * E2E smoke test — verifies the app boots and the landing page renders.
 * Full E2E coverage is built in Phase 2.
 */

test("landing page renders", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Leadforge/);
  await expect(page.getByRole("heading", { name: /Lead intelligence/i })).toBeVisible();
});

test("login flow works with demo credentials", async ({ page }) => {
  await page.goto("/#/login");
  await page.getByLabel("Email").fill("admin@leadforge.local");
  await page.getByLabel("Password").fill("Leadforge123");
  await page.getByRole("button", { name: /Sign in/i }).click();
  await page.waitForURL(/#\/dashboard/);
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
});
