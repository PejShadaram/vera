/**
 * Full case creation and management workflow.
 * Desktop viewport (1280×800) is used throughout so the left nav is visible.
 * Creates a real case, exercises all sections, then deletes.
 */
import { test, expect } from "@playwright/test";
import * as path from "path";

// Serial mode: caseUrl is module-level state shared across tests in this file.
// With multiple workers, each worker gets its own module scope, breaking caseUrl.
// Serial ensures all tests run on the same worker in order.
test.describe.configure({ mode: "serial" });

const FIXTURE = path.join(__dirname, "../fixtures/test-document.txt");
let caseUrl = "";

// All tests run at desktop width so the left nav is always visible.
test.use({ viewport: { width: 1280, height: 800 } });

test.describe("Case creation wizard", () => {
  test("completes new case wizard", async ({ page }) => {
    await page.goto("/cases/new");

    // Step 1 — pick case type (auto-advances after 300ms selected state)
    await page.getByText(/Something else/i).click();
    await page.waitForTimeout(800); // wait for 300ms auto-advance + render

    // Step 2 — opposing party (optional, just continue)
    // "other" has no context questions so Continue goes straight to state
    await page.getByRole("button", { name: /continue/i }).first().click();

    // Step 3 (state) — "other" case type has no context questions, skips to state directly
    await expect(page.getByPlaceholder(/e\.g\. Texas/i)).toBeVisible({ timeout: 5_000 });
    await page.getByPlaceholder(/e\.g\. Texas/i).fill("California");
    await page.getByRole("button", { name: /create my case/i }).click();

    // Step 5 — upload screen — go to case
    await expect(page.getByText(/your case is set up/i)).toBeVisible({ timeout: 10_000 });
    await page.getByRole("button", { name: /go to my case/i }).click();

    await page.waitForURL(/\/cases\/[a-f0-9-]+$/);
    caseUrl = page.url();
    expect(caseUrl).toMatch(/\/cases\/[a-f0-9-]+$/);
  });
});

test.describe("Left nav — desktop", () => {
  test.beforeEach(async ({ page }) => {
    if (!caseUrl) test.skip();
    await page.goto(caseUrl, { waitUntil: "networkidle" });
  });

  test("left nav is visible with group headers", async ({ page }) => {
    // Scope to the sidebar nav to avoid matching other text on the page
    const sidenav = page.locator("nav.w-44");
    await expect(sidenav.getByText("Case File")).toBeVisible();
    await expect(sidenav.getByText("Work")).toBeVisible();
    await expect(sidenav.getByText("AI")).toBeVisible();
    await expect(sidenav.getByRole("button", { name: /^settings$/i })).toBeVisible();
  });

  test("all nav sections are clickable", async ({ page }) => {
    const sections = ["Timeline", "Evidence", "Documents", "Strategy", "Tasks", "Deadlines", "Finances", "Rules"];
    for (const s of sections) {
      await page.getByRole("button", { name: new RegExp(`^${s}$`, "i") }).first().click();
      // Each section renders something — just confirm no crash
      await expect(page.locator("body")).not.toContainText("Application error");
    }
  });
});

test.describe("Case sections — Case File group", () => {
  test.beforeEach(async ({ page }) => {
    if (!caseUrl) test.skip();
    await page.goto(caseUrl, { waitUntil: "networkidle" });
  });

  test("Timeline — add and see entry", async ({ page }) => {
    // Timeline is the default active tab — wait for its form to be ready
    await expect(page.getByPlaceholder(/describe what happened/i)).toBeVisible({ timeout: 10_000 });
    const dateInput = page.locator('input[type="date"]').first();
    await dateInput.fill("2025-03-15");
    await page.getByPlaceholder(/describe what happened/i).fill("E2E test event");
    await page.getByRole("button", { name: /^add$/i }).first().click();
    await expect(page.getByText("E2E test event")).toBeVisible();
  });

  test("Evidence — add manual entry", async ({ page }) => {
    await page.getByRole("button", { name: /^evidence$/i }).first().click();
    await page.getByPlaceholder(/evidence title/i).fill("E2E test evidence");
    await page.getByRole("button", { name: /^add$/i }).first().click();
    await expect(page.getByText("E2E test evidence")).toBeVisible();
  });

  test("Strategy — text is saved after typing", async ({ page }) => {
    await page.getByRole("button", { name: /^strategy$/i }).first().click();
    const textarea = page.getByPlaceholder(/what is your argument/i);
    await expect(textarea).toBeVisible();
    const noteText = "E2E test strategy content";
    await textarea.fill(noteText);
    await page.waitForResponse(r =>
      r.url().includes("/notes") && r.request().method() === "PUT" && r.ok(),
      { timeout: 10_000 },
    );
    await expect(page.getByText(/saved/i).first()).toBeVisible({ timeout: 5_000 });
    await page.reload();
    await page.getByRole("button", { name: /^strategy$/i }).first().click();
    await expect(page.getByPlaceholder(/what is your argument/i)).toHaveValue(noteText, { timeout: 8_000 });
  });

  test("Log — capture via FAB appears in Timeline", async ({ page }) => {
    // Log is merged into Timeline — use the FAB to add a quick note
    const fab = page.locator("button").filter({ has: page.locator("circle[cx='11']") }).last();
    await fab.click();
    await page.getByRole("button", { name: /log a note/i }).click();
    const text = "E2E log entry — captured a call";
    await page.getByPlaceholder(/log an event, call, or observation/i).fill(text);
    await page.getByRole("button", { name: /^log it$/i }).click();
    // Quick note should appear in Timeline
    await page.getByRole("button", { name: /^timeline$/i }).first().click();
    await expect(page.getByText(text)).toBeVisible({ timeout: 8_000 });
  });
});

test.describe("Case sections — Work group", () => {
  test.beforeEach(async ({ page }) => {
    if (!caseUrl) test.skip();
    await page.goto(caseUrl, { waitUntil: "networkidle" });
  });

  test("Tasks — add and move a task", async ({ page }) => {
    await page.getByRole("button", { name: /^tasks$/i }).first().click();
    await page.getByPlaceholder(/add a task/i).fill("E2E test task");
    await page.getByRole("button", { name: /^add$/i }).first().click();
    await expect(page.getByText("E2E test task")).toBeVisible();
    await page.getByRole("button", { name: /start/i }).first().click();
    await expect(page.getByText("In Progress")).toBeVisible();
  });

  test("Deadlines — add a deadline", async ({ page }) => {
    await page.getByRole("button", { name: /^deadlines$/i }).first().click();
    await page.getByPlaceholder(/deadline description/i).fill("E2E test deadline");
    const datePicker = page.locator('input[type="date"]').first();
    await datePicker.fill("2025-12-31");
    await page.getByRole("button", { name: /^add$/i }).first().click();
    await expect(page.getByText("E2E test deadline")).toBeVisible();
  });

  test("Deadlines — complete a deadline", async ({ page }) => {
    await page.getByRole("button", { name: /^deadlines$/i }).first().click();
    await expect(page.getByText("E2E test deadline")).toBeVisible();
    await page.getByTitle(/mark complete/i).first().click();
    await expect(page.getByText(/^completed$/i)).toBeVisible();
    await expect(page.getByText("E2E test deadline")).toBeVisible();
  });

  test("Finances — add an Asset item", async ({ page }) => {
    await page.getByRole("button", { name: /^finances$/i }).first().click();
    await page.getByPlaceholder(/^description$/i).fill("House");
    await page.getByPlaceholder(/^amount$/i).fill("450000");
    await page.getByRole("button", { name: /^add$/i }).first().click();
    await expect(page.getByText("House", { exact: true })).toBeVisible();
    await expect(page.getByText("$450,000.00").first()).toBeVisible();
  });

  test("Calculator — outcome comparison visible (divorce/custody/employment/small_claims only)", async ({ page }) => {
    const calcBtn = page.getByRole("button", { name: /^calculator$/i }).first();
    const isVisible = await calcBtn.isVisible().catch(() => false);
    if (!isVisible) { test.skip(); return; } // not shown for "other" case type
    await calcBtn.click();
    await expect(page.getByText(/outcome comparison/i)).toBeVisible();
  });
});

test.describe("Case sections — AI group", () => {
  test.beforeEach(async ({ page }) => {
    if (!caseUrl) test.skip();
    await page.goto(caseUrl, { waitUntil: "networkidle" });
  });

  test("Ask Vera — FAB opens chat drawer or unlock prompt", async ({ page }) => {
    // Ask Vera is now in the floating FAB, not the nav
    const fab = page.locator("button").filter({ has: page.locator("circle[cx='11']") }).last();
    await fab.click();
    // Should show "Ask Vera" pill option
    await expect(page.getByRole("button", { name: /ask vera/i })).toBeVisible({ timeout: 5_000 });
    await page.getByRole("button", { name: /ask vera/i }).click();
    // Drawer should open with either chat input or unlock CTA
    await expect(
      page.getByPlaceholder(/ask about your case/i).or(page.getByText(/unlock this case/i).first())
    ).toBeVisible({ timeout: 8_000 });
  });

  test("Rules — tab mounts and shows header", async ({ page }) => {
    await page.getByRole("button", { name: /^rules$/i }).first().click();
    await expect(page.getByText("Rules & Statutes", { exact: true })).toBeVisible({ timeout: 10_000 });
    // Disclaimer warning is always visible
    await expect(page.getByText(/verify before acting/i)).toBeVisible({ timeout: 5_000 });
  });

  test("Drafts nav item shows lock icon for locked case", async ({ page }) => {
    // Drafts is the UNLOCK_REQUIRED item in the nav
    const draftsBtn = page.getByRole("button", { name: /^drafts$/i }).first();
    await expect(draftsBtn).toBeVisible();
    await expect(draftsBtn.locator("svg")).not.toHaveCount(0);
  });
});

test.describe("Settings — via left nav", () => {
  test.beforeEach(async ({ page }) => {
    if (!caseUrl) test.skip();
    await page.goto(caseUrl, { waitUntil: "networkidle" });
  });

  test("Settings has correct section structure", async ({ page }) => {
    await page.evaluate(() => window.dispatchEvent(new CustomEvent("vera:open-tab", { detail: "Settings" })));
    await expect(page.getByText(/case details/i)).toBeVisible();
    await expect(page.getByText(/case lifecycle/i)).toBeVisible();
    await expect(page.getByText(/danger zone/i).first()).toBeVisible();
    // Status buttons present
    await expect(page.getByRole("button", { name: /^active$/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /^on hold$/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /^closed$/i })).toBeVisible();
  });

  test("case lifecycle status auto-saves on click", async ({ page }) => {
    await page.evaluate(() => window.dispatchEvent(new CustomEvent("vera:open-tab", { detail: "Settings" })));
    await expect(page.getByText(/case lifecycle/i)).toBeVisible({ timeout: 8_000 });
    // Switch to On Hold — should fire PATCH immediately (no Save button needed)
    const [response] = await Promise.all([
      page.waitForResponse(r =>
        /\/api\/cases\/[a-f0-9-]+$/.test(r.url()) && r.request().method() === "PATCH" && r.ok(),
        { timeout: 8_000 },
      ),
      page.getByRole("button", { name: /^on hold$/i }).click(),
    ]);
    expect(response.ok()).toBe(true);
    // Restore to Active
    await page.getByRole("button", { name: /^active$/i }).click();
  });

  test("renames the case and reflects on page header", async ({ page }) => {
    const newName = "E2E Renamed Case " + Date.now();
    await page.evaluate(() => window.dispatchEvent(new CustomEvent("vera:open-tab", { detail: "Settings" })));
    await expect(page.getByText(/case details/i)).toBeVisible({ timeout: 8_000 });
    // Use the unique placeholder for the case name field
    const nameInput = page.getByPlaceholder(/Smith v\. Jones/i);
    await nameInput.fill(newName);
    await Promise.all([
      page.waitForResponse(r =>
        /\/api\/cases\/[a-f0-9-]+$/.test(r.url()) && r.request().method() === "PATCH" && r.ok(),
        { timeout: 10_000 },
      ),
      page.getByRole("button", { name: /save changes/i }).click(),
    ]);
    await page.goto(caseUrl, { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: newName })).toBeVisible();
  });
});

test.describe("Timeline — delete entry", () => {
  test.beforeEach(async ({ page }) => {
    if (!caseUrl) test.skip();
    await page.goto(caseUrl, { waitUntil: "networkidle" });
  });

  test("deletes a timeline entry", async ({ page }) => {
    await page.getByRole("button", { name: /^timeline$/i }).first().click();
    await page.locator('input[type="date"]').first().fill("2025-04-20");
    await page.getByPlaceholder(/describe what happened/i).fill("Second timeline entry");
    await page.getByRole("button", { name: /^add$/i }).first().click();
    await expect(page.getByText("Second timeline entry")).toBeVisible();
    await expect(page.getByText("E2E test event")).toBeVisible();
    page.once("dialog", d => d.accept());
    const firstRow = page.locator("div.group", { hasText: "E2E test event" }).first();
    await firstRow.hover();
    await firstRow.getByRole("button", { name: /^delete$/i }).click();
    await expect(page.getByText("E2E test event")).toHaveCount(0);
    await expect(page.getByText("Second timeline entry")).toBeVisible();
  });
});

test.describe("Vera's Take", () => {
  test("panel is collapsed by default and shows preview text", async ({ page }) => {
    if (!caseUrl) test.skip();
    await page.goto(caseUrl, { waitUntil: "networkidle" });
    // Title is always visible in the collapsed header
    await expect(page.getByText("Vera's Take", { exact: true })).toBeVisible();
    // Collapsed state shows a preview snippet (loading, upload CTA, or analysis summary)
    // — any of these means the component rendered correctly
    await expect(
      page.getByText(/analyzing your case/i)
        .or(page.getByText(/upload a document to get started/i))
        .or(page.getByText(/reads your full case file/i))
    ).toBeVisible({ timeout: 5_000 });
  });

  test("panel header is clickable and has chevron toggle", async ({ page }) => {
    if (!caseUrl) test.skip();
    await page.goto(caseUrl, { waitUntil: "networkidle" });
    // The header contains a chevron svg — clicking it should not throw
    const veraHeader = page.getByText("Vera's Take", { exact: true });
    await expect(veraHeader).toBeVisible();
    await veraHeader.click();
    // Panel remains on page after interaction — no crash
    await expect(veraHeader).toBeVisible();
  });

  test("re-fetches analysis after timeline entry added", async ({ page }) => {
    // Create a fresh case via the new 4-step wizard
    await page.goto("/cases/new");
    await page.getByText(/Something else/i).click();
    await page.waitForTimeout(800);
    await page.getByRole("button", { name: /continue/i }).first().click();
    await expect(page.getByPlaceholder(/e\.g\. Texas/i)).toBeVisible({ timeout: 5_000 });
    await page.getByPlaceholder(/e\.g\. Texas/i).fill("Texas");
    await page.getByRole("button", { name: /create my case/i }).click();
    await expect(page.getByText(/your case is set up/i)).toBeVisible({ timeout: 10_000 });
    await page.getByRole("button", { name: /go to my case/i }).click();
    await page.waitForURL(/\/cases\/[a-f0-9-]+$/);
    await expect(page.getByText("Vera's Take", { exact: true })).toBeVisible();
    await page.waitForLoadState("networkidle");
    // Timeline is the default active tab — fill fields then start listening + click simultaneously
    await page.locator('input[type="date"]').first().fill("2025-06-01");
    await page.getByPlaceholder(/describe what happened/i).fill("Refresh trigger test entry");
    const [request] = await Promise.all([
      page.waitForRequest(r => r.url().includes("/analysis?bust="), { timeout: 15_000 }),
      page.getByRole("button", { name: /^add$/i }).first().click(),
    ]);
    expect(request.url()).toContain("/analysis?bust=");
  });
});

test.describe.serial("Case creation — divorce type", () => {
  let divorceCaseUrl = "";

  test("creates a divorce case via wizard", async ({ page }) => {
    await page.goto("/cases/new");
    // Step 1 — case type
    await page.getByText(/My marriage is ending/i).click();
    await page.waitForTimeout(800);
    // Step 2 — opposing party
    await page.getByPlaceholder(/full name/i).fill("Test Spouse");
    await page.getByRole("button", { name: /continue/i }).first().click();
    // Step 3 — context questions (divorce has children/property/contested)
    await expect(page.getByText(/Do you have children together/i)).toBeVisible({ timeout: 5_000 });
    const childrenQ = page.locator("div").filter({ has: page.getByText("Do you have children together?") }).last();
    const propertyQ = page.locator("div").filter({ has: page.getByText("Is there property to divide?") }).last();
    const contestedQ = page.locator("div").filter({ has: page.getByText("Is this contested?") }).last();
    await childrenQ.getByRole("button", { name: /^no$/i }).click();
    await propertyQ.getByRole("button", { name: /^yes$/i }).click();
    await contestedQ.getByRole("button", { name: /^yes$/i }).click();
    await page.getByRole("button", { name: /continue/i }).first().click();
    // Step 4 — state
    await page.getByPlaceholder(/e\.g\. Texas/i).fill("California");
    await page.getByRole("button", { name: /create my case/i }).click();
    // Step 5 — upload screen
    await expect(page.getByText(/your case is set up/i)).toBeVisible({ timeout: 10_000 });
    await page.getByRole("button", { name: /go to my case/i }).click();
    await page.waitForURL(/\/cases\/[a-f0-9-]+$/);
    divorceCaseUrl = page.url();
    expect(divorceCaseUrl).toMatch(/\/cases\/[a-f0-9-]+$/);
  });

  test("case page shows Divorce type badge", async ({ page }) => {
    if (!divorceCaseUrl) test.skip();
    await page.goto(divorceCaseUrl);
    await expect(page.getByText("Divorce", { exact: true })).toBeVisible();
  });

  test("deletes the divorce case", async ({ page }) => {
    if (!divorceCaseUrl) test.skip();
    await page.goto(divorceCaseUrl);
    await page.evaluate(() => window.dispatchEvent(new CustomEvent("vera:open-tab", { detail: "Settings" })));
    await expect(page.getByText(/danger zone/i).first()).toBeVisible();
    const caseName = await page.locator("p.font-mono").textContent();
    expect(caseName).toBeTruthy();
    await page.getByPlaceholder(/type the case name/i).fill(caseName!.trim());
    await page.getByRole("button", { name: /permanently delete/i }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 15_000 });
  });
});

test.describe.serial("FloatingCapture button", () => {
  let captureCaseUrl = "";

  test("creates a case to exercise FloatingCapture", async ({ page }) => {
    await page.goto("/cases/new");
    await page.getByText(/Something else/i).click();
    await page.waitForTimeout(800);
    await page.getByRole("button", { name: /continue/i }).first().click();
    await expect(page.getByPlaceholder(/e\.g\. Texas/i)).toBeVisible({ timeout: 5_000 });
    await page.getByPlaceholder(/e\.g\. Texas/i).fill("Texas");
    await page.getByRole("button", { name: /create my case/i }).click();
    await expect(page.getByText(/your case is set up/i)).toBeVisible({ timeout: 10_000 });
    await page.getByRole("button", { name: /go to my case/i }).click();
    await page.waitForURL(/\/cases\/[a-f0-9-]+$/);
    captureCaseUrl = page.url();
  });

  test("opens, accepts text, saves — entry appears in Timeline", async ({ page }) => {
    if (!captureCaseUrl) test.skip();
    await page.goto(captureCaseUrl, { waitUntil: "networkidle" });
    // Open FAB → Log a note
    const fab = page.locator("button").filter({ has: page.locator("circle[cx='11']") }).last();
    await fab.click();
    await expect(page.getByRole("button", { name: /log a note/i })).toBeVisible({ timeout: 5_000 });
    await page.getByRole("button", { name: /log a note/i }).click();
    const captureText = "Floating capture entry from E2E";
    await page.getByPlaceholder(/log an event, call, or observation/i).fill(captureText);
    await page.getByRole("button", { name: /log it/i }).click();
    await page.waitForTimeout(1500);
    // Entry should appear in Timeline (captures are merged into Timeline)
    await expect(page.getByText(captureText).first()).toBeVisible({ timeout: 8_000 });
  });

  test("deletes the capture-test case", async ({ page }) => {
    if (!captureCaseUrl) test.skip();
    await page.goto(captureCaseUrl);
    await page.evaluate(() => window.dispatchEvent(new CustomEvent("vera:open-tab", { detail: "Settings" })));
    await expect(page.getByText(/danger zone/i).first()).toBeVisible();
    const caseName = await page.locator("p.font-mono").textContent();
    expect(caseName).toBeTruthy();
    await page.getByPlaceholder(/type the case name/i).fill(caseName!.trim());
    await page.getByRole("button", { name: /permanently delete/i }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 15_000 });
  });
});

test.describe("Case cleanup", () => {
  test("deletes the main test case", async ({ page }) => {
    if (!caseUrl) test.skip();
    await page.goto(caseUrl, { waitUntil: "networkidle" });
    await page.evaluate(() => window.dispatchEvent(new CustomEvent("vera:open-tab", { detail: "Settings" })));
    await expect(page.getByText(/danger zone/i).first()).toBeVisible();
    const caseName = await page.locator("p.font-mono").textContent();
    expect(caseName).toBeTruthy();
    await page.getByPlaceholder(/type the case name/i).fill(caseName!.trim());
    await page.getByRole("button", { name: /permanently delete/i }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 15_000 });
    await expect(page).toHaveURL(/\/dashboard/);
  });
});
