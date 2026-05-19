import { test, expect } from "@playwright/test";
import * as path from "path";

// These tests need a case — use the case-workflow suite to create one first,
// or point EXISTING_CASE_URL at a known case for isolated runs.
const EXISTING_CASE_URL = process.env.TEST_CASE_URL ?? "";

test.describe("Calculator", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test.beforeEach(async ({ page }) => {
    if (!EXISTING_CASE_URL) test.skip();
    await page.goto(EXISTING_CASE_URL);
    // Desktop: Calculator is in the Work group of the left nav
    await page.getByRole("button", { name: /^calculator$/i }).first().click();
  });

  test("shows marital estate input", async ({ page }) => {
    await expect(page.getByText(/marital estate in dispute/i)).toBeVisible();
  });

  test("receiving offer toggle works", async ({ page }) => {
    await page.getByText(/i received an offer/i).click();
    await expect(page.getByText(/amount they are offering/i)).toBeVisible();
  });

  test("making offer toggle works", async ({ page }) => {
    await page.getByText(/i am making an offer/i).click();
    await expect(page.getByText(/amount you are offering/i)).toBeVisible();
  });

  test("clicking a money field opens text input", async ({ page }) => {
    // Click the dispute field to enter edit mode
    const disputeBtn = page.locator("button").filter({ hasText: /^[\d,]+$/ }).first();
    await disputeBtn.click();
    await expect(page.locator('input[inputmode="numeric"]').first()).toBeFocused();
  });

  test("percent quick-select chips update share", async ({ page }) => {
    await page.getByRole("button", { name: /^60%$/ }).click();
    await expect(page.locator('input[type="number"]').first()).toHaveValue("60");
  });

  test("outcome comparison cards visible", async ({ page }) => {
    await expect(page.getByText(/if you go to trial/i)).toBeVisible();
  });
});
