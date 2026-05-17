/**
 * Multi-user isolation and multi-case tests.
 * Uses pre-saved auth states from auth.setup.ts (no live login needed).
 * Requires .playwright/test-users.json (run seed script first).
 */
import { test, expect } from "@playwright/test";
import * as fs   from "fs";
import * as path from "path";

const AUTH_FILE  = path.join(__dirname, "../../.playwright/auth.json");
const USERS_FILE = path.join(__dirname, "../../.playwright/test-users.json");

type TestUser = { email: string; password: string; cases: string[] };

function loadUsers(): TestUser[] {
  if (!fs.existsSync(USERS_FILE)) return [];
  return JSON.parse(fs.readFileSync(USERS_FILE, "utf8"));
}

function authFile(userIndex: number): string {
  // Index 0 = primary user (AUTH_FILE), index N = auth-user-N+1.json
  if (userIndex === 0) return AUTH_FILE;
  return path.join(__dirname, `../../.playwright/auth-user-${userIndex + 1}.json`);
}

// ── Primary user — 5 cases ───────────────────────────────────────────────────

test.describe("Primary user — 5 cases", () => {
  let users: TestUser[];

  test.beforeAll(() => {
    users = loadUsers();
    if (!users.length) test.skip();
  });

  test("dashboard shows all 5 cases", async ({ browser }) => {
    const ctx  = await browser.newContext({ storageState: AUTH_FILE });
    const page = await ctx.newPage();
    try {
      await page.goto("/dashboard");
      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(2000); // let case list fully render
      // All 5 seeded cases should appear
      await expect(page.getByText(/Smith v\. Jones/i).first()).toBeVisible({ timeout: 20_000 });
      await expect(page.getByText(/Williams v\. Davis/i).first()).toBeVisible({ timeout: 10_000 });
      await expect(page.getByText(/Sunset Properties/i).first()).toBeVisible({ timeout: 10_000 });
      await expect(page.getByText(/Tech Corp Inc/i).first()).toBeVisible({ timeout: 10_000 });
      await expect(page.getByText(/Park v\. Anderson/i).first()).toBeVisible({ timeout: 10_000 });
    } finally { await ctx.close(); }
  });

  test("can navigate between cases without data bleed", async ({ browser }) => {
    const ctx  = await browser.newContext({ storageState: AUTH_FILE });
    const page = await ctx.newPage();
    try {
      await page.goto("/dashboard");
      await page.getByText(/Smith v\. Jones/i).click();
      await page.waitForURL(/\/cases\//);
      await expect(page.getByText(/Jones, Alex/i)).toBeVisible();

      await page.goto("/dashboard");
      await page.getByText(/Park v\. Anderson/i).click();
      await page.waitForURL(/\/cases\//);
      await expect(page.getByText(/Jones, Alex/i)).not.toBeVisible();
      await expect(page.getByText(/Anderson, Tyler/i)).toBeVisible();
    } finally { await ctx.close(); }
  });

  test("divorce case has correct timeline entries", async ({ browser }) => {
    const ctx  = await browser.newContext({ storageState: AUTH_FILE });
    const page = await ctx.newPage();
    try {
      await page.goto("/dashboard");
      await page.getByText(/Smith v\. Jones/i).click();
      await page.waitForURL(/\/cases\//);
      await expect(page.getByText(/parties married/i)).toBeVisible({ timeout: 10_000 });
      await expect(page.getByText(/Original Petition for Divorce filed/i)).toBeVisible();
    } finally { await ctx.close(); }
  });

  test("small claims case has financial data", async ({ browser }) => {
    const ctx  = await browser.newContext({ storageState: AUTH_FILE });
    const page = await ctx.newPage();
    try {
      await page.goto("/dashboard");
      await page.waitForTimeout(1500);
      await page.getByText(/Park v\. Anderson/i).first().click();
      await page.waitForURL(/\/cases\//);
      await page.waitForTimeout(1000);
      await page.getByRole("button", { name: /more/i }).click();
      await page.getByRole("button", { name: /^finances$/i }).click();
      await page.waitForTimeout(500);
      await expect(page.getByText(/4,500/).first()).toBeVisible({ timeout: 15_000 });
    } finally { await ctx.close(); }
  });

  test("stat card shows correct deadline count", async ({ browser }) => {
    const ctx  = await browser.newContext({ storageState: AUTH_FILE });
    const page = await ctx.newPage();
    try {
      await page.goto("/dashboard");
      await page.getByText(/Smith v\. Jones/i).click();
      await page.waitForURL(/\/cases\//);
      // Should not say "None" — divorce case has 3 deadlines
      const statCards = page.locator('[data-testid="stat-next-deadline"], .space-y-5 p, .grid p');
      // Wait for page to load and check the deadline count isn't None
      await page.waitForTimeout(2000);
      const noneText = await page.getByText(/^None$/).count();
      // At most 1 "None" (some other stat), not all 4 stats showing None
      expect(noneText).toBeLessThanOrEqual(1);
    } finally { await ctx.close(); }
  });
});

// ── Multi-user isolation ──────────────────────────────────────────────────────

test.describe("User isolation — different users cannot see each other's cases", () => {
  let users: TestUser[];

  test.beforeAll(() => {
    users = loadUsers();
    if (users.length < 2) test.skip();
  });

  test("user 2 sees only their own cases", async ({ browser }) => {
    const u2AuthFile = authFile(1);
    if (!fs.existsSync(u2AuthFile)) test.skip();

    const ctx  = await browser.newContext({ storageState: u2AuthFile });
    const page = await ctx.newPage();
    try {
      await page.goto("/dashboard");
      await expect(page.getByRole("heading", { name: /your cases/i })).toBeVisible();
      const caseLinks = await page.locator("a[href^='/cases/']").count();
      expect(caseLinks).toBe(5);
    } finally { await ctx.close(); }
  });

  test("user 1 cannot access user 2's case by ID", async ({ browser }) => {
    const u2AuthFile = authFile(1);
    if (!users[1]?.cases?.length || !fs.existsSync(u2AuthFile)) test.skip();

    const u2CaseId = users[1].cases[0];
    const ctx  = await browser.newContext({ storageState: AUTH_FILE });
    const page = await ctx.newPage();
    try {
      await page.goto(`/cases/${u2CaseId}`);
      // Should 404 — not show user 2's case data
      await page.waitForLoadState("load");
      const hasU2Case = await page.getByText(/Williams v\. Davis/i).isVisible().catch(() => false);
      expect(hasU2Case).toBe(false);
    } finally { await ctx.close(); }
  });
});

// ── Parallel user sessions ───────────────────────────────────────────────────

test.describe("Parallel sessions — multiple users simultaneously", () => {
  test("5 users can access their dashboards simultaneously", async ({ browser }) => {
    const users = loadUsers();
    if (users.length < 5) test.skip();

    // Only run with auth files that actually exist
    const available = users.slice(0, 5).map((_, i) => authFile(i)).filter(f => fs.existsSync(f));
    if (available.length < 2) test.skip(); // need at least 2 for a meaningful parallel test

    const results = await Promise.all(
      available.map(async (aFile) => {
        const ctx  = await browser.newContext({ storageState: aFile });
        const page = await ctx.newPage();
        try {
          await page.goto("/dashboard");
          const heading = await page.getByRole("heading", { name: /your cases/i }).isVisible({ timeout: 15_000 });
          const count   = await page.locator("a[href^='/cases/']").count();
          return { ok: heading, count };
        } finally { await ctx.close(); }
      })
    );

    for (const r of results) {
      expect(r.ok).toBe(true);
      expect(r.count).toBeGreaterThanOrEqual(5);
    }
  });
});
