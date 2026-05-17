/**
 * Full case creation and management workflow.
 * Creates a real case, exercises all primary tabs, then deletes.
 */
import { test, expect } from "@playwright/test";
import * as path from "path";

const FIXTURE = path.join(__dirname, "../fixtures/test-document.txt");
let caseUrl = "";

test.describe("Case creation wizard", () => {
  test("completes new case wizard", async ({ page }) => {
    await page.goto("/cases/new");

    // Step 1 — pick case type (click the "other" option)
    await page.getByText(/Something else/i).click();

    // Step 2 — fill in details
    await page.getByPlaceholder(/e\.g\. Texas/i).fill("California");
    await page.getByPlaceholder(/What's happening/i).fill("E2E test dispute");
    await page.getByPlaceholder(/Name or company/i).fill("Test Opposing Party");
    await page.getByRole("button", { name: /set up my case/i }).click();

    // Step 3 — skip document upload
    await page.waitForURL(/\/cases\/new/);
    await page.getByRole("button", { name: /continue without documents/i }).click();

    // Should land on the case page
    await page.waitForURL(/\/cases\/[a-f0-9-]+$/);
    caseUrl = page.url();
    expect(caseUrl).toMatch(/\/cases\/[a-f0-9-]+$/);
  });
});

test.describe("Case tabs — primary", () => {
  test.beforeEach(async ({ page }) => {
    if (!caseUrl) test.skip();
    await page.goto(caseUrl);
  });

  test("Timeline tab — add and see entry", async ({ page }) => {
    await expect(page.getByRole("tab", { name: /timeline/i }).or(
      page.getByRole("button", { name: /timeline/i })
    )).toBeVisible();

    // Add a timeline entry
    const dateInput = page.locator('input[type="date"]').first();
    await dateInput.fill("2025-03-15");
    await page.getByPlaceholder(/describe what happened/i).fill("E2E test event");
    await page.getByRole("button", { name: /^add$/i }).first().click();

    await expect(page.getByText("E2E test event")).toBeVisible();
  });

  test("Documents tab — upload test file", async ({ page }) => {
    await page.getByRole("button", { name: "Documents", exact: true }).click();
    await expect(page.getByText(/upload document/i)).toBeVisible();

    const [fileChooser] = await Promise.all([
      page.waitForEvent("filechooser"),
      page.getByText(/upload document/i).click(),
    ]);
    await fileChooser.setFiles(FIXTURE);

    // File should appear in the list
    await expect(page.getByText("test-document.txt")).toBeVisible({ timeout: 15_000 });
  });

  test("Evidence tab — add manual entry", async ({ page }) => {
    await page.getByText("Evidence").click();
    await page.getByPlaceholder(/evidence title/i).fill("E2E test evidence");
    await page.getByRole("button", { name: /^add$/i }).first().click();
    await expect(page.getByText("E2E test evidence")).toBeVisible();
  });

  test("Tasks tab — add and move a task", async ({ page }) => {
    await page.getByRole("button", { name: "Tasks", exact: true }).click();
    await page.getByPlaceholder(/add a task/i).fill("E2E test task");
    await page.getByRole("button", { name: /^add$/i }).first().click();
    await expect(page.getByText("E2E test task")).toBeVisible();

    // Move to In Progress
    await page.getByRole("button", { name: /start/i }).first().click();
    await expect(page.getByText("In Progress")).toBeVisible();
  });

  test("Deadlines tab — add a deadline", async ({ page }) => {
    await page.getByText("Deadlines").click();
    await page.getByPlaceholder(/deadline description/i).fill("E2E test deadline");
    const datePicker = page.locator('input[type="date"]').first();
    await datePicker.fill("2025-12-31");
    await page.getByRole("button", { name: /^add$/i }).first().click();
    await expect(page.getByText("E2E test deadline")).toBeVisible();
  });
});

test.describe("Case tabs — secondary (More menu)", () => {
  test.beforeEach(async ({ page }) => {
    if (!caseUrl) test.skip();
    await page.goto(caseUrl);
  });

  test("opens More dropdown and navigates to Notes", async ({ page }) => {
    await page.getByRole("button", { name: /more/i }).click();
    await expect(page.getByRole("button", { name: /notes/i })).toBeVisible();
    await page.getByRole("button", { name: /^notes$/i }).click();
    await expect(page.getByPlaceholder(/start writing/i)).toBeVisible();
  });

  test("opens Ask Vera tab", async ({ page }) => {
    await page.getByRole("button", { name: /more/i }).click();
    await page.getByRole("button", { name: /ask vera/i }).click();
    // Locked case shows lock CTA; unlocked shows chat input — either is correct
    await expect(
      page.getByPlaceholder(/ask about your case/i).or(page.getByText(/unlock.*case/i).first())
    ).toBeVisible({ timeout: 8_000 });
  });

  test("opens Finances tab", async ({ page }) => {
    await page.getByRole("button", { name: /more/i }).click();
    await page.getByRole("button", { name: /^finances$/i }).click();
    await expect(page.getByText(/assets/i)).toBeVisible();
  });

  test("opens Calculator tab", async ({ page }) => {
    await page.getByRole("button", { name: /more/i }).click();
    await page.getByRole("button", { name: /calculator/i }).click();
    await expect(page.getByText(/marital estate/i)).toBeVisible();
  });

  test("opens Settings and shows case name", async ({ page }) => {
    await page.getByRole("button", { name: /more/i }).click();
    await page.getByRole("button", { name: /settings/i }).click();
    await expect(page.getByText(/case details/i)).toBeVisible();
    await expect(page.getByText(/danger zone/i)).toBeVisible();
  });
});

test.describe("Vera's Take", () => {
  test("Vera's Take panel loads", async ({ page }) => {
    if (!caseUrl) test.skip();
    await page.goto(caseUrl);
    // Panel always renders — locked shows unlock prompt, unlocked shows analysis
    await expect(page.getByText("Vera's Take", { exact: true })).toBeVisible();
    await expect(
      page.getByText(/loading/i)
        .or(page.getByText(/next/i))
        .or(page.getByText(/unlock/i).first())
    ).toBeVisible({ timeout: 15_000 });
  });

  test("Vera's Take re-fetches analysis after timeline entry added", async ({ page }) => {
    // Self-contained: create a case then verify the analysis API is re-called after a write
    await page.goto("/cases/new");
    await page.getByText(/Something else/i).click();
    await page.getByPlaceholder(/e\.g\. Texas/i).fill("Texas");
    await page.getByPlaceholder(/What's happening/i).fill("Refresh test");
    await page.getByPlaceholder(/Name or company/i).fill("Opposing");
    await page.getByRole("button", { name: /set up my case/i }).click();
    await page.waitForURL(/\/cases\/new/);
    await page.getByRole("button", { name: /continue without documents/i }).click();
    await page.waitForURL(/\/cases\/[a-f0-9-]+$/);

    await expect(page.getByText("Vera's Take", { exact: true })).toBeVisible();
    // Wait for initial analysis fetch to settle
    await page.waitForLoadState("networkidle");

    // Add a timeline entry and verify a cache-busted analysis request fires
    const [request] = await Promise.all([
      page.waitForRequest(r => r.url().includes("/analysis?bust="), { timeout: 5_000 }),
      (async () => {
        await page.locator('input[type="date"]').first().fill("2025-06-01");
        await page.getByPlaceholder(/describe what happened/i).fill("Refresh trigger test entry");
        await page.getByRole("button", { name: /^add$/i }).first().click();
      })(),
    ]);

    expect(request.url()).toContain("/analysis?bust=");
  });

  test("Vera's Take re-fetches analysis after deadline added", async ({ page }) => {
    await page.goto("/cases/new");
    await page.getByText(/Something else/i).click();
    await page.getByPlaceholder(/e\.g\. Texas/i).fill("Texas");
    await page.getByPlaceholder(/What's happening/i).fill("Deadline refresh test");
    await page.getByPlaceholder(/Name or company/i).fill("Opposing");
    await page.getByRole("button", { name: /set up my case/i }).click();
    await page.waitForURL(/\/cases\/new/);
    await page.getByRole("button", { name: /continue without documents/i }).click();
    await page.waitForURL(/\/cases\/[a-f0-9-]+$/);

    await expect(page.getByText("Vera's Take", { exact: true })).toBeVisible();
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: /deadlines/i }).click();

    const [request] = await Promise.all([
      page.waitForRequest(r => r.url().includes("/analysis?bust="), { timeout: 5_000 }),
      (async () => {
        await page.getByPlaceholder(/deadline description/i).fill("Court hearing");
        await page.locator('input[type="date"]').last().fill("2025-09-01");
        await page.getByRole("button", { name: /^add$/i }).last().click();
      })(),
    ]);

    expect(request.url()).toContain("/analysis?bust=");
  });
});

test.describe("Case cleanup", () => {
  test("deletes the test case", async ({ page }) => {
    if (!caseUrl) test.skip();
    await page.goto(caseUrl);

    // Go to Settings → delete
    await page.getByRole("button", { name: /more/i }).click();
    await page.getByRole("button", { name: /settings/i }).click();
    await page.getByRole("button", { name: /delete this case/i }).click();

    // Two confirmation dialogs
    page.on("dialog", async dialog => { await dialog.accept(); });

    await page.waitForURL(/\/dashboard/, { timeout: 10_000 });
    await expect(page).toHaveURL(/\/dashboard/);
  });
});
