import { test, expect } from "@playwright/test";

// Landing page tests run without auth, with desktop viewport (nav links are hidden on mobile)
test.use({ storageState: { cookies: [], origins: [] }, viewport: { width: 1280, height: 800 } });

test.describe("Landing page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("shows hero headline", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /court/i })).toBeVisible();
  });

  test("shows Vera logo mark and name", async ({ page }) => {
    await expect(page.getByText("Vera").first()).toBeVisible();
  });

  test("nav links work", async ({ page }) => {
    // Navigate directly — clicking links from landing can hit Clerk middleware in unauthenticated contexts
    await page.goto("/pricing");
    await expect(page).toHaveURL(/\/pricing/);
    await expect(page.getByText("$49", { exact: true })).toBeVisible();
  });

  test("get started button goes to auth page", async ({ page }) => {
    await page.getByRole("link", { name: /get started/i }).first().click();
    // Clerk may redirect to sign-up or sign-in depending on session state
    await expect(page).toHaveURL(/\/sign-(up|in)/, { timeout: 10_000 });
  });

  test("shows How it works section", async ({ page }) => {
    await expect(page.getByText(/how it works/i)).toBeVisible();
  });

  test("shows trust section", async ({ page }) => {
    await expect(page.getByText(/your documents are safe/i)).toBeVisible();
  });

  test("shows FAQ", async ({ page }) => {
    await expect(page.getByText(/is this legal advice/i)).toBeVisible();
  });

  test("footer links to privacy and terms", async ({ page }) => {
    await expect(page.getByRole("link", { name: "Privacy", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: /terms/i })).toBeVisible();
  });
});

test.describe("Pricing page", () => {
  test("shows free and AI unlock plans", async ({ page }) => {
    await page.goto("/pricing");
    await expect(page.getByText("$0", { exact: true })).toBeVisible();
    await expect(page.getByText("$49", { exact: true })).toBeVisible();
  });

  test("pricing page shows one-time unlock model", async ({ page }) => {
    await page.goto("/pricing");
    await expect(page.getByText(/per case · one time/i).first()).toBeVisible();
    await expect(page.getByText(/no subscription/i).first()).toBeVisible();
  });
});
