/**
 * Runs once before all tests.
 * Signs up a fresh test account through the Vera UI (works with any Clerk
 * environment — keyless dev mode, test, or production).
 * Then seeds 5 cases via the Vera API so subsequent tests have real data.
 * Saves the browser session to .playwright/auth.json.
 */
import { test as setup, expect } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

const AUTH_FILE = path.join(__dirname, "../../.playwright/auth.json");

const TEST_EMAIL    = process.env.TEST_USER_EMAIL    ?? "vera-test-user1+clerk_test@mailinator.com";
const TEST_PASSWORD = process.env.TEST_USER_PASSWORD ?? "VeraTest2026!";

setup("authenticate and seed", async ({ page }) => {
  fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true });

  // ── 1. Sign up (if first run) or sign in ─────────────────────────────────
  await page.goto("/sign-in");

  // Fill email
  await page.getByLabel(/email/i).fill(TEST_EMAIL);
  await page.getByRole("button", { name: "Continue", exact: true }).click();

  const pwInput = page.locator('input[type="password"]');
  const notFound = page.getByText(/couldn't find your account/i);

  // Wait to see if we need to sign UP or if the password field appeared
  await Promise.race([
    pwInput.waitFor({ state: "visible", timeout: 8_000 }),
    notFound.waitFor({ state: "visible", timeout: 8_000 }),
  ]).catch(() => {});

  if (await notFound.isVisible()) {
    // Account doesn't exist — sign up instead
    await page.goto("/sign-up");
    await page.getByLabel(/email/i).fill(TEST_EMAIL);
    await page.getByLabel(/password/i).first().fill(TEST_PASSWORD);
    // Some Clerk configs show a name field
    const firstNameField = page.getByLabel(/first name/i);
    if (await firstNameField.isVisible({ timeout: 1_000 }).catch(() => false))
      await firstNameField.fill("E2E");
    await page.getByRole("button", { name: "Continue", exact: true }).click();

    // +clerk_test@ emails accept OTP 424242 in Clerk dev mode
    const codeInput = page.locator('input[inputmode="numeric"], input[name*="code"]').first();
    if (await codeInput.isVisible({ timeout: 6_000 }).catch(() => false)) {
      await codeInput.click();
      await page.keyboard.type("424242");
      await page.waitForTimeout(1000);
      const continueBtn = page.getByRole("button", { name: "Continue", exact: true });
      if (await continueBtn.isVisible({ timeout: 2_000 }).catch(() => false))
        await continueBtn.click();
    }
  } else {
    // Account exists — sign in normally
    await pwInput.fill(TEST_PASSWORD);
    await page.getByRole("button", { name: "Continue", exact: true }).click();
  }

  // Handle Clerk's "new device" factor-two OTP step
  // Wait to see if we land on factor-two or dashboard
  await Promise.race([
    page.waitForURL(/\/dashboard/,    { timeout: 15_000 }),
    page.waitForURL(/\/factor-two/,   { timeout: 15_000 }),
    page.waitForURL(/\/factor-one/,   { timeout: 15_000 }),
  ]).catch(() => {});

  if (page.url().includes("/factor-two") || page.url().includes("/factor-one")) {
    // Clerk dev mode: click the first OTP box then keyboard-type the code
    // OTP inputs are individual maxlength=1 inputs with inputmode="numeric"
    const firstOtp = page.locator('input[inputmode="numeric"]').first();
    await firstOtp.waitFor({ state: "visible", timeout: 8_000 });
    await firstOtp.click();
    await page.keyboard.type("424242");
    // Clerk auto-advances after entering the code — no need to click Continue
    // but click it as a fallback if the form doesn't auto-submit
    await page.waitForTimeout(1500);
    const continueBtn = page.getByRole("button", { name: "Continue", exact: true });
    if (await continueBtn.isVisible({ timeout: 2_000 }).catch(() => false))
      await continueBtn.click();
  }

  // Wait for dashboard
  await page.waitForURL(/\/dashboard/, { timeout: 20_000 });
  await expect(page).toHaveURL(/\/dashboard/);

  // ── 2. Save primary session ──────────────────────────────────────────────
  await page.context().storageState({ path: AUTH_FILE });
  console.log(`\n✓ Auth ready — ${TEST_EMAIL}`);
});
