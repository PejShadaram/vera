/**
 * Runs once before all tests.
 * Authenticates all test users (sign-up or sign-in) and saves browser sessions.
 * Handles all Clerk sign-in flows: password, email OTP, factor-two OTP.
 *
 * Primary user  → .playwright/auth.json
 * Users 2–5     → .playwright/auth-user-{2..5}.json (used by multi-user tests)
 */
import { test as setup, expect, type Page } from "@playwright/test";
import * as fs   from "fs";
import * as path from "path";

const AUTH_FILE = path.join(__dirname, "../../.playwright/auth.json");
const AUTH_DIR  = path.dirname(AUTH_FILE);

const TEST_USERS = [
  { email: "vera-test-user1+clerk_test@mailinator.com", password: "VeraTest2026!" },
  { email: "vera-test-user2+clerk_test@mailinator.com", password: "VeraTest2026!" },
  { email: "vera-test-user3+clerk_test@mailinator.com", password: "VeraTest2026!" },
  { email: "vera-test-user4+clerk_test@mailinator.com", password: "VeraTest2026!" },
  { email: "vera-test-user5+clerk_test@mailinator.com", password: "VeraTest2026!" },
];

/**
 * Signs in (or signs up) a Clerk user.
 * Handles: password sign-in, email OTP sign-in, sign-up with OTP, factor-two OTP.
 * Returns true on success, false if unable to reach /dashboard within timeout.
 */
async function signInUser(page: Page, email: string, password: string): Promise<boolean> {
  const base = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  await page.goto(`${base}/sign-in`);

  await page.getByLabel(/email/i).fill(email);
  await page.getByRole("button", { name: "Continue", exact: true }).click();

  const pwInput   = page.locator('input[type="password"]');
  const codeInput = page.locator('input[inputmode="numeric"], input[autocomplete*="one-time"]').first();
  const notFound  = page.getByText(/couldn't find your account/i);

  // Detect which screen Clerk shows next
  await Promise.race([
    pwInput.waitFor({ state: "visible",  timeout: 8_000 }),
    codeInput.waitFor({ state: "visible", timeout: 8_000 }),
    notFound.waitFor({ state: "visible", timeout: 8_000 }),
  ]).catch(() => {});

  if (await notFound.isVisible().catch(() => false)) {
    // Account doesn't exist — create it
    await page.goto(`${base}/sign-up`);
    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/password/i).first().fill(password);
    const nameField = page.getByLabel(/first name/i);
    if (await nameField.isVisible({ timeout: 1_000 }).catch(() => false))
      await nameField.fill("E2E");
    await page.getByRole("button", { name: "Continue", exact: true }).click();

    // OTP verification after sign-up
    const signUpCode = page.locator('input[inputmode="numeric"]').first();
    if (await signUpCode.isVisible({ timeout: 6_000 }).catch(() => false)) {
      await signUpCode.click();
      await page.keyboard.type("424242");
      await page.waitForTimeout(1000);
      const btn = page.getByRole("button", { name: "Continue", exact: true });
      if (await btn.isVisible({ timeout: 2_000 }).catch(() => false)) await btn.click();
    }

  } else if (await codeInput.isVisible().catch(() => false)) {
    // Clerk sent an email OTP instead of showing the password field
    await codeInput.click();
    await page.keyboard.type("424242");
    await page.waitForTimeout(1000);
    const btn = page.getByRole("button", { name: "Continue", exact: true });
    if (await btn.isVisible({ timeout: 2_000 }).catch(() => false)) await btn.click();

    // After email OTP, Clerk may still show a password prompt on some configs
    if (await pwInput.isVisible({ timeout: 4_000 }).catch(() => false)) {
      await pwInput.fill(password);
      await page.getByRole("button", { name: "Continue", exact: true }).click();
    }

  } else if (await pwInput.isVisible().catch(() => false)) {
    // Standard password sign-in
    await pwInput.fill(password);
    await page.getByRole("button", { name: "Continue", exact: true }).click();

  } else {
    // Unknown state — bail out
    return false;
  }

  // Handle Clerk's "new device" factor-two / factor-one OTP step
  await Promise.race([
    page.waitForURL(/\/dashboard/,  { timeout: 15_000 }),
    page.waitForURL(/\/factor-two/, { timeout: 15_000 }),
    page.waitForURL(/\/factor-one/, { timeout: 15_000 }),
  ]).catch(() => {});

  if (page.url().includes("/factor-two") || page.url().includes("/factor-one")) {
    const firstOtp = page.locator('input[inputmode="numeric"]').first();
    await firstOtp.waitFor({ state: "visible", timeout: 8_000 });
    await firstOtp.click();
    await page.keyboard.type("424242");
    await page.waitForTimeout(1500);
    const btn = page.getByRole("button", { name: "Continue", exact: true });
    if (await btn.isVisible({ timeout: 2_000 }).catch(() => false)) await btn.click();
  }

  try {
    await page.waitForURL(/\/dashboard/, { timeout: 20_000 });
    return page.url().includes("/dashboard");
  } catch {
    return false;
  }
}

setup("authenticate all test users", async ({ page, browser }) => {
  fs.mkdirSync(AUTH_DIR, { recursive: true });

  // ── Primary user (user 1) ─────────────────────────────────────────────────
  const ok = await signInUser(page, TEST_USERS[0].email, TEST_USERS[0].password);
  if (!ok) throw new Error(`Primary user auth failed — check Clerk config`);
  await expect(page).toHaveURL(/\/dashboard/);
  await page.context().storageState({ path: AUTH_FILE });
  console.log(`\n✓ Auth ready — ${TEST_USERS[0].email}`);

  // ── Users 2–5 (for multi-user isolation tests) ────────────────────────────
  // Each runs in its own fresh browser context; failures are warnings not errors.
  for (let i = 1; i < TEST_USERS.length; i++) {
    const authPath = path.join(AUTH_DIR, `auth-user-${i + 1}.json`);
    if (fs.existsSync(authPath)) {
      console.log(`✓ Auth cached  — ${TEST_USERS[i].email}`);
      continue;
    }

    const ctx     = await browser.newContext();
    const newPage = await ctx.newPage();
    try {
      const result = await signInUser(newPage, TEST_USERS[i].email, TEST_USERS[i].password);
      if (result) {
        await ctx.storageState({ path: authPath });
        console.log(`✓ Auth saved   — ${TEST_USERS[i].email}`);
      } else {
        console.warn(`⚠ Auth failed  — ${TEST_USERS[i].email} (multi-user tests will skip)`);
      }
    } catch (e) {
      console.warn(`⚠ Auth error   — ${TEST_USERS[i].email}: ${e}`);
    } finally {
      await ctx.close();
    }
  }
});
