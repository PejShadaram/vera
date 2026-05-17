# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: auth.setup.ts >> authenticate and seed
- Location: tests/e2e/auth.setup.ts:17:6

# Error details

```
TimeoutError: page.waitForURL: Timeout 20000ms exceeded.
=========================== logs ===========================
waiting for navigation until "load"
============================================================
```

# Page snapshot

```yaml
- generic [ref=e1]:
  - generic [ref=e2]:
    - generic [ref=e3]:
      - heading "Vera" [level=1] [ref=e4]
      - paragraph [ref=e5]: Know where you stand.
    - generic [ref=e7]:
      - generic [ref=e8]:
        - generic [ref=e10]:
          - heading "Check your email" [level=1] [ref=e11]
          - paragraph [ref=e12]: to continue to My Application
          - paragraph [ref=e14]: vera-test-user1+clerk_test@mailinator.com
        - generic [ref=e15]:
          - generic [ref=e16]:
            - generic [ref=e17]:
              - generic [ref=e18]:
                - generic:
                  - group
                  - textbox "Enter verification code" [ref=e19]
              - generic [ref=e20]: Enter code.
              - paragraph [ref=e22]:
                - img [ref=e23]
                - text: Enter code.
            - button "Didn't receive a code? Resend (9)" [disabled]
          - paragraph [ref=e26]: You're signing in from a new device. We're asking for verification to keep your account secure.
          - generic [ref=e27]:
            - button "Continue" [active] [ref=e28] [cursor=pointer]:
              - generic [ref=e29]:
                - text: Continue
                - img [ref=e30]
            - link "Use another method" [ref=e33] [cursor=pointer]:
              - /url: http://localhost:3000/sign-in/factor-two
      - generic [ref=e36]:
        - generic [ref=e38]:
          - paragraph [ref=e39]: Secured by
          - link "Clerk logo" [ref=e40] [cursor=pointer]:
            - /url: https://go.clerk.com/components
            - img [ref=e41]
        - paragraph [ref=e46]: Development mode
  - generic [ref=e51] [cursor=pointer]:
    - button "Open Next.js Dev Tools" [ref=e52]:
      - img [ref=e53]
    - generic [ref=e56]:
      - button "Open issues overlay" [ref=e57]:
        - generic [ref=e58]:
          - generic [ref=e59]: "1"
          - generic [ref=e60]: "2"
        - generic [ref=e61]:
          - text: Issue
          - generic [ref=e62]: s
      - button "Collapse issues badge" [ref=e63]:
        - img [ref=e64]
  - alert [ref=e66]
  - generic [ref=e67]:
    - button "Keyless prompt" [expanded] [ref=e68] [cursor=pointer]:
      - img [ref=e69]
      - generic [ref=e73]: Configure your application
      - img [ref=e74]
    - generic [ref=e77]:
      - generic [ref=e78]:
        - paragraph [ref=e79]: Temporary API keys are enabled so you can get started immediately.
        - list [ref=e80]:
          - listitem [ref=e81]: Add SSO connections (eg. GitHub)
          - listitem [ref=e82]: Set up B2B authentication
          - listitem [ref=e83]: Enable MFA
        - paragraph [ref=e84]: Access the dashboard to customize auth settings and explore Clerk features.
      - link "Configure your application" [ref=e85] [cursor=pointer]:
        - /url: https://dashboard.clerk.com/apps/claim?framework=nextjs&token=mzug1zcx82g7dsj8d4xu50hry7gx722g40rz611t&return_url=http%3A%2F%2Flocalhost%3A3000%2Fsign-in
```

# Test source

```ts
  1   | /**
  2   |  * Runs once before all tests.
  3   |  * Signs up a fresh test account through the Vera UI (works with any Clerk
  4   |  * environment — keyless dev mode, test, or production).
  5   |  * Then seeds 5 cases via the Vera API so subsequent tests have real data.
  6   |  * Saves the browser session to .playwright/auth.json.
  7   |  */
  8   | import { test as setup, expect } from "@playwright/test";
  9   | import * as fs   from "fs";
  10  | import * as path from "path";
  11  | 
  12  | const AUTH_FILE = path.join(__dirname, "../../.playwright/auth.json");
  13  | 
  14  | const TEST_EMAIL    = process.env.TEST_USER_EMAIL    ?? "vera-test-user1+clerk_test@mailinator.com";
  15  | const TEST_PASSWORD = process.env.TEST_USER_PASSWORD ?? "VeraTest2026!";
  16  | 
  17  | setup("authenticate and seed", async ({ page }) => {
  18  |   fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true });
  19  | 
  20  |   // ── 1. Sign up (if first run) or sign in ─────────────────────────────────
  21  |   await page.goto("/sign-in");
  22  | 
  23  |   // Fill email
  24  |   await page.getByLabel(/email/i).fill(TEST_EMAIL);
  25  |   await page.getByRole("button", { name: "Continue", exact: true }).click();
  26  | 
  27  |   const pwInput = page.locator('input[type="password"]');
  28  |   const notFound = page.getByText(/couldn't find your account/i);
  29  | 
  30  |   // Wait to see if we need to sign UP or if the password field appeared
  31  |   await Promise.race([
  32  |     pwInput.waitFor({ state: "visible", timeout: 8_000 }),
  33  |     notFound.waitFor({ state: "visible", timeout: 8_000 }),
  34  |   ]).catch(() => {});
  35  | 
  36  |   if (await notFound.isVisible()) {
  37  |     // Account doesn't exist — sign up instead
  38  |     await page.goto("/sign-up");
  39  |     await page.getByLabel(/email/i).fill(TEST_EMAIL);
  40  |     await page.getByLabel(/password/i).first().fill(TEST_PASSWORD);
  41  |     // Some Clerk configs show a name field
  42  |     const firstNameField = page.getByLabel(/first name/i);
  43  |     if (await firstNameField.isVisible({ timeout: 1_000 }).catch(() => false))
  44  |       await firstNameField.fill("E2E");
  45  |     await page.getByRole("button", { name: "Continue", exact: true }).click();
  46  | 
  47  |     // +clerk_test@ emails accept OTP 424242 in Clerk dev mode
  48  |     const codeInput = page.locator('input[inputmode="numeric"], input[name*="code"]').first();
  49  |     if (await codeInput.isVisible({ timeout: 6_000 }).catch(() => false)) {
  50  |       await codeInput.click();
  51  |       await page.keyboard.type("424242");
  52  |       await page.waitForTimeout(1000);
  53  |       const continueBtn = page.getByRole("button", { name: "Continue", exact: true });
  54  |       if (await continueBtn.isVisible({ timeout: 2_000 }).catch(() => false))
  55  |         await continueBtn.click();
  56  |     }
  57  |   } else {
  58  |     // Account exists — sign in normally
  59  |     await pwInput.fill(TEST_PASSWORD);
  60  |     await page.getByRole("button", { name: "Continue", exact: true }).click();
  61  |   }
  62  | 
  63  |   // Handle Clerk's "new device" factor-two OTP step
  64  |   // Wait to see if we land on factor-two or dashboard
  65  |   await Promise.race([
  66  |     page.waitForURL(/\/dashboard/,    { timeout: 15_000 }),
  67  |     page.waitForURL(/\/factor-two/,   { timeout: 15_000 }),
  68  |     page.waitForURL(/\/factor-one/,   { timeout: 15_000 }),
  69  |   ]).catch(() => {});
  70  | 
  71  |   if (page.url().includes("/factor-two") || page.url().includes("/factor-one")) {
  72  |     // Clerk dev mode: click the first OTP box then keyboard-type the code
  73  |     // OTP inputs are individual maxlength=1 inputs with inputmode="numeric"
  74  |     const firstOtp = page.locator('input[inputmode="numeric"]').first();
  75  |     await firstOtp.waitFor({ state: "visible", timeout: 8_000 });
  76  |     await firstOtp.click();
  77  |     await page.keyboard.type("424242");
  78  |     // Clerk auto-advances after entering the code — no need to click Continue
  79  |     // but click it as a fallback if the form doesn't auto-submit
  80  |     await page.waitForTimeout(1500);
  81  |     const continueBtn = page.getByRole("button", { name: "Continue", exact: true });
  82  |     if (await continueBtn.isVisible({ timeout: 2_000 }).catch(() => false))
  83  |       await continueBtn.click();
  84  |   }
  85  | 
  86  |   // Wait for dashboard
> 87  |   await page.waitForURL(/\/dashboard/, { timeout: 20_000 });
      |              ^ TimeoutError: page.waitForURL: Timeout 20000ms exceeded.
  88  |   await expect(page).toHaveURL(/\/dashboard/);
  89  | 
  90  |   // ── 2. Save primary session ──────────────────────────────────────────────
  91  |   // Cases are seeded by the seed script (npm run seed:test) — no API seeding here
  92  |   await page.context().storageState({ path: AUTH_FILE });
  93  |   console.log(`\n✓ Auth ready — ${TEST_EMAIL}`);
  94  | 
  95  |   // ── 4. Pre-auth users 2-5 for multi-user tests ──────────────────────────
  96  |   const usersFile = path.join(__dirname, "../../.playwright/test-users.json");
  97  |   if (fs.existsSync(usersFile)) {
  98  |     const users: Array<{ email: string; password: string }> = JSON.parse(fs.readFileSync(usersFile, "utf8"));
  99  |     for (let i = 1; i < users.length && i < 5; i++) {
  100 |       const u = users[i];
  101 |       const authPath = path.join(__dirname, `../../.playwright/auth-user-${i + 1}.json`);
  102 |       if (fs.existsSync(authPath)) continue; // already saved
  103 | 
  104 |       const newCtx  = await page.context().browser()!.newContext();
  105 |       const newPage = await newCtx.newPage();
  106 |       const base    = process.env.BASE_URL ?? "http://localhost:3000";
  107 |       try {
  108 |         await newPage.goto(`${base}/sign-in`);
  109 |         await newPage.getByLabel(/email/i).fill(u.email);
  110 |         await newPage.getByRole("button", { name: "Continue", exact: true }).click();
  111 |         const pw = newPage.locator('input[type="password"]');
  112 |         await pw.waitFor({ state: "visible", timeout: 10_000 });
  113 |         await pw.fill(u.password);
  114 |         await newPage.getByRole("button", { name: "Continue", exact: true }).click();
  115 | 
  116 |         await Promise.race([
  117 |           newPage.waitForURL(/\/dashboard/,    { timeout: 30_000 }),
  118 |           newPage.waitForURL(/\/factor-two/,   { timeout: 30_000 }),
  119 |         ]).catch(() => {});
  120 | 
  121 |         if (newPage.url().includes("/factor-two")) {
  122 |           const otp = newPage.locator('input[inputmode="numeric"]').first();
  123 |           await otp.waitFor({ state: "visible", timeout: 8_000 });
  124 |           await otp.click();
  125 |           await newPage.keyboard.type("424242");
  126 |           await newPage.waitForTimeout(1500);
  127 |           const btn = newPage.getByRole("button", { name: "Continue", exact: true });
  128 |           if (await btn.isVisible({ timeout: 2_000 }).catch(() => false)) await btn.click();
  129 |         }
  130 | 
  131 |         await newPage.waitForURL(/\/dashboard/, { timeout: 45_000 });
  132 |         await newCtx.storageState({ path: authPath });
  133 |         console.log(`✓ Auth saved — ${u.email}`);
  134 |       } catch (e) {
  135 |         console.warn(`⚠ Could not pre-auth ${u.email}: ${e}`);
  136 |       } finally {
  137 |         await newCtx.close();
  138 |       }
  139 |     }
  140 |   }
  141 | });
  142 | 
```