/**
 * Tests navigation, redirects, and auth guards.
 */
import { test, expect } from "@playwright/test";

test.describe("Auth guards", () => {
  test("unauthenticated user redirected from dashboard", async ({ browser }) => {
    const ctx  = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/sign-in/);
    await ctx.close();
  });

  test("unauthenticated user redirected from case page", async ({ browser }) => {
    const ctx  = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();
    await page.goto("/cases/00000000-0000-0000-0000-000000000000");
    await expect(page).toHaveURL(/sign-in/);
    await ctx.close();
  });
});

test.describe("Authenticated navigation", () => {
  test("logo navigates to dashboard", async ({ page }) => {
    await page.goto("/dashboard");
    await page.getByRole("link", { name: /vera/i }).first().click();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("pricing page accessible from nav (public)", async ({ browser }) => {
    const ctx  = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();
    await page.goto("/pricing");
    await expect(page.getByText("$49", { exact: true })).toBeVisible();
    await ctx.close();
  });

  test("privacy page accessible", async ({ browser }) => {
    const ctx  = await browser.newContext({ storageState: { cookies: [], origins: [] }, viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    await page.goto("/privacy");
    await expect(page.getByRole("heading", { name: /privacy policy/i })).toBeVisible({ timeout: 10_000 });
    await ctx.close();
  });

  test("terms page accessible", async ({ browser }) => {
    const ctx  = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();
    await page.goto("/terms");
    await expect(page.getByText(/terms of service/i)).toBeVisible();
    await ctx.close();
  });
});
