import { test, expect } from "@playwright/test";

test.describe("Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard");
  });

  test("loads dashboard page", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /your cases/i })).toBeVisible();
  });

  test("shows new case button", async ({ page }) => {
    await expect(page.getByRole("link", { name: /new case/i })).toBeVisible();
  });

  test("account link in nav", async ({ page }) => {
    await page.getByRole("link", { name: "Account" }).click();
    await expect(page).toHaveURL(/\/account/);
  });

  test("account page loads and shows AI unlock info", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/account");
    await expect(page.getByText(/ai unlocks/i).first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/\$49/).first()).toBeVisible({ timeout: 15_000 });
  });
});
