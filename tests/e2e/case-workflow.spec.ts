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

  test.fixme("Documents tab — upload test file", async ({ page }) => {
    // File upload via Playwright is unreliable with React synthetic events on
    // display:none inputs. The filechooser opens and setFiles() runs but the
    // React onChange handler doesn't fire in the test environment.
    // Test the upload flow manually via veracase.app instead.
    await page.getByRole("button", { name: "Documents", exact: true }).click();
    const uploadBtn = page.getByRole("button", { name: /upload document/i });
    await expect(uploadBtn).toBeVisible();

    const [fileChooser] = await Promise.all([
      page.waitForEvent("filechooser"),
      uploadBtn.click(),
    ]);
    await fileChooser.setFiles(FIXTURE);
    await expect(page.getByText("test-document.txt")).toBeVisible({ timeout: 20_000 });
  });

  test("Evidence tab — add manual entry", async ({ page }) => {
    await page.getByRole("button", { name: "Evidence", exact: true }).click();
    await page.getByPlaceholder(/evidence title/i).fill("E2E test evidence");
    await page.getByRole("button", { name: /^add$/i }).first().click();
    await expect(page.getByText("E2E test evidence")).toBeVisible();
  });

  test("Tasks tab — add and move a task", async ({ page }) => {
    // Tasks is now in the More menu
    await page.getByRole("button", { name: /more/i }).click();
    await page.getByRole("button", { name: /^tasks$/i }).click();
    await page.getByPlaceholder(/add a task/i).fill("E2E test task");
    await page.getByRole("button", { name: /^add$/i }).first().click();
    await expect(page.getByText("E2E test task")).toBeVisible();

    // Move to In Progress
    await page.getByRole("button", { name: /start/i }).first().click();
    await expect(page.getByText("In Progress")).toBeVisible();
  });

  test("Deadlines tab — add a deadline", async ({ page }) => {
    await page.getByRole("button", { name: "Deadlines", exact: true }).click();
    await page.getByPlaceholder(/deadline description/i).fill("E2E test deadline");
    const datePicker = page.locator('input[type="date"]').first();
    await datePicker.fill("2025-12-31");
    await page.getByRole("button", { name: /^add$/i }).first().click();
    await expect(page.getByText("E2E test deadline")).toBeVisible();
  });

  // ── Timeline entry delete ────────────────────────────────────────────────
  // Adds a second entry then deletes the first one — verifies only the second remains.
  test("Timeline tab — delete an entry", async ({ page }) => {
    // Timeline is the default active tab. Add a second entry.
    await page.locator('input[type="date"]').first().fill("2025-04-20");
    await page.getByPlaceholder(/describe what happened/i).fill("Second timeline entry");
    await page.getByRole("button", { name: /^add$/i }).first().click();
    await expect(page.getByText("Second timeline entry")).toBeVisible();

    // Both entries should now be present
    await expect(page.getByText("E2E test event")).toBeVisible();

    // Confirm the browser dialog that fires from window.confirm() before the delete button click
    page.once("dialog", d => d.accept());

    // The first entry's row should expose a "delete" button when its group is hovered.
    // Use a scoped locator: find the row containing "E2E test event" then click its "delete" button.
    const firstRow = page.locator("div.group", { hasText: "E2E test event" }).first();
    await firstRow.hover();
    await firstRow.getByRole("button", { name: /^delete$/i }).click();

    // First entry should be gone, second should still be present
    await expect(page.getByText("E2E test event")).toHaveCount(0);
    await expect(page.getByText("Second timeline entry")).toBeVisible();
  });

  // ── Deadline complete ────────────────────────────────────────────────────
  // Marks the existing deadline complete and verifies it moves to the Completed section.
  test("Deadlines tab — complete a deadline", async ({ page }) => {
    await page.getByRole("button", { name: "Deadlines", exact: true }).click();
    await expect(page.getByText("E2E test deadline")).toBeVisible();

    // Click the round complete button (title="Mark complete") on the active deadline row
    const completeBtn = page.getByTitle(/mark complete/i).first();
    await completeBtn.click();

    // A "Completed" header appears once any deadline is completed
    await expect(page.getByText(/^completed$/i)).toBeVisible();
    // The deadline label should still be visible (now inside the completed list with strikethrough)
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
    // Ask Vera is now in the primary tab row
    await page.getByRole("button", { name: /ask vera/i }).first().click();
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
    // "Outcome comparison" is present for all case types
    await expect(page.getByText(/outcome comparison/i)).toBeVisible();
  });

  test("opens Settings and shows case name", async ({ page }) => {
    await page.getByRole("button", { name: /more/i }).click();
    await page.getByRole("button", { name: /settings/i }).click();
    await expect(page.getByText(/case details/i)).toBeVisible();
    await expect(page.getByText(/danger zone/i)).toBeVisible();
  });

  // ── Log tab (captures) ────────────────────────────────────────────────────
  // Opens the Log tab, types and saves an entry, and verifies it renders.
  // This tab had a bug previously and isn't otherwise exercised.
  test("Log tab — type and save a capture entry", async ({ page }) => {
    await page.getByRole("button", { name: /more/i }).click();
    await page.getByRole("button", { name: /^log$/i }).click();

    const text = "E2E log entry — captured a call";
    await page.getByPlaceholder(/log an event, call, or observation/i).fill(text);
    await page.getByRole("button", { name: /^log$/i }).last().click();
    await expect(page.getByText(text)).toBeVisible();
  });

  // ── Finances — add an Asset ──────────────────────────────────────────────
  // Defaults are: category=Asset, no amount required other than description.
  // Add an Asset for $450,000 and verify it appears in the list.
  test("Finances tab — add an Asset item", async ({ page }) => {
    await page.getByRole("button", { name: /more/i }).click();
    await page.getByRole("button", { name: /^finances$/i }).click();

    await page.getByPlaceholder(/^description$/i).fill("House");
    await page.getByPlaceholder(/^amount$/i).fill("450000");
    await page.getByRole("button", { name: /^add$/i }).first().click();

    // The new row should appear with the description and a formatted amount
    // ($450,000.00 also appears in the Asset totals card, so use .first())
    await expect(page.getByText("House", { exact: true })).toBeVisible();
    await expect(page.getByText("$450,000.00").first()).toBeVisible();
  });

  // ── Notes — type and autosave ────────────────────────────────────────────
  // NotesTab debounces a PUT /api/cases/:id/notes after 1.5s of inactivity.
  // Verify the saved indicator appears and the textarea retains the content
  // after a remount (navigating away and back).
  test("Notes tab — text is saved after typing", async ({ page }) => {
    await page.getByRole("button", { name: /more/i }).click();
    await page.getByRole("button", { name: /^notes$/i }).click();

    const textarea = page.getByPlaceholder(/start writing/i);
    await expect(textarea).toBeVisible();

    const noteText = "E2E test note content";
    await textarea.fill(noteText);

    // Wait for the debounced save (PUT) to land, then "Saved ✓" to appear
    await page.waitForResponse(r =>
      r.url().includes("/notes") && r.request().method() === "PUT" && r.ok(),
      { timeout: 10_000 },
    );
    await expect(page.getByText(/saved/i).first()).toBeVisible({ timeout: 5_000 });

    // Reload the page and re-open Notes — content should still be present
    await page.reload();
    await page.getByRole("button", { name: /more/i }).click();
    await page.getByRole("button", { name: /^notes$/i }).click();
    await expect(page.getByPlaceholder(/start writing/i)).toHaveValue(noteText);
  });
});

test.describe("Vera's Take", () => {
  test("Vera's Take panel loads", async ({ page }) => {
    if (!caseUrl) test.skip();
    await page.goto(caseUrl);
    // Vera's Take panel is always rendered on the case page regardless of unlock state
    await expect(page.getByText("Vera's Take", { exact: true })).toBeVisible();
    await expect(page.getByText(/reads your full case file/i)).toBeVisible();
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

// ─────────────────────────────────────────────────────────────────────────
// Self-contained describe blocks below — each creates and deletes its own case.
// They run AFTER the main sequential flow but BEFORE the shared-case cleanup.
// ─────────────────────────────────────────────────────────────────────────

/**
 * Wizard variety: the divorce case type asks different questions than "other".
 * Verifies the wizard completes, the case is created, and the case header
 * shows the correct "Divorce" type badge. Self-contained — cleans up.
 */
test.describe.serial("Case creation wizard — divorce type", () => {
  let divorceCaseUrl = "";

  test("creates a divorce case via wizard", async ({ page }) => {
    await page.goto("/cases/new");

    // Step 1 — pick the divorce case type
    await page.getByText(/My marriage is ending/i).click();

    // Step 2 — divorce-specific questions: state, filed, property, children, opposing
    await page.getByPlaceholder(/e\.g\. Texas/i).fill("California");

    // Each radio question is a <div> wrapping a <label> + a button group. Scope clicks by label.
    const filedQ    = page.locator("div").filter({ has: page.getByText("Has anything been filed with the court yet?") }).last();
    const propertyQ = page.locator("div").filter({ has: page.getByText("Do you have property together?") }).last();
    const childrenQ = page.locator("div").filter({ has: page.getByText("Do you have children together?") }).last();

    await filedQ.getByRole("button", { name: /^yes$/i }).click();
    await propertyQ.getByRole("button", { name: /^yes$/i }).click();
    await childrenQ.getByRole("button", { name: /^no$/i }).click();

    await page.getByPlaceholder(/full name/i).fill("Test Spouse");

    await page.getByRole("button", { name: /set up my case/i }).click();

    // Step 3 — skip document upload
    await page.waitForURL(/\/cases\/new/);
    await page.getByRole("button", { name: /continue without documents/i }).click();

    // Lands on case page
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
    await page.getByRole("button", { name: /more/i }).click();
    await page.getByRole("button", { name: /settings/i }).click();
    await expect(page.getByText(/danger zone/i)).toBeVisible();
    const caseName = await page.locator("p.font-mono").textContent();
    expect(caseName).toBeTruthy();
    await page.getByPlaceholder(/type the case name/i).fill(caseName!.trim());
    await page.getByRole("button", { name: /permanently delete/i }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 15_000 });
  });
});

/**
 * FloatingCapture: the bottom-right "Capture" button is always available on
 * a case page. It opens a popover with a textarea — saving posts to /captures
 * and the new entry should appear in the Log tab.
 */
test.describe.serial("FloatingCapture button", () => {
  let captureCaseUrl = "";

  test("creates a case to exercise FloatingCapture", async ({ page }) => {
    await page.goto("/cases/new");
    await page.getByText(/Something else/i).click();
    await page.getByPlaceholder(/e\.g\. Texas/i).fill("Texas");
    await page.getByPlaceholder(/What's happening/i).fill("Floating capture test");
    await page.getByPlaceholder(/Name or company/i).fill("Capture Opposing");
    await page.getByRole("button", { name: /set up my case/i }).click();
    await page.waitForURL(/\/cases\/new/);
    await page.getByRole("button", { name: /continue without documents/i }).click();
    await page.waitForURL(/\/cases\/[a-f0-9-]+$/);
    captureCaseUrl = page.url();
  });

  test("opens, accepts text, saves — entry appears in Log tab", async ({ page }) => {
    if (!captureCaseUrl) test.skip();
    await page.goto(captureCaseUrl);

    // Open the floating Capture popover (bottom-right button)
    await page.getByRole("button", { name: /^capture$/i }).click();

    // The popover contains its own textarea with the same placeholder as the Log tab.
    // It also contains a "Log it" button — distinguishes it from the Log tab "Log" button.
    const captureText = "Floating capture entry from E2E";
    const captureTextarea = page.getByPlaceholder(/log an event, call, or observation/i);
    await captureTextarea.fill(captureText);

    await page.getByRole("button", { name: /log it/i }).click();

    // The popover auto-closes after 1.2s; the entry should appear in the Log tab.
    // Wait a moment for the close animation then open the Log tab.
    await page.waitForTimeout(1500);
    await page.getByRole("button", { name: /more/i }).click();
    await page.getByRole("button", { name: /^log$/i }).click();

    await expect(page.getByText(captureText)).toBeVisible({ timeout: 5_000 });
  });

  test("deletes the capture-test case", async ({ page }) => {
    if (!captureCaseUrl) test.skip();
    await page.goto(captureCaseUrl);
    await page.getByRole("button", { name: /more/i }).click();
    await page.getByRole("button", { name: /settings/i }).click();
    await expect(page.getByText(/danger zone/i)).toBeVisible();
    const caseName = await page.locator("p.font-mono").textContent();
    expect(caseName).toBeTruthy();
    await page.getByPlaceholder(/type the case name/i).fill(caseName!.trim());
    await page.getByRole("button", { name: /permanently delete/i }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 15_000 });
  });
});

/**
 * Settings — change the case name and verify the change is reflected on the
 * case page header. Self-contained — creates and deletes its own case.
 */
test.describe.serial("Case settings — rename", () => {
  let renameCaseUrl = "";
  const newName = "E2E Renamed Case " + Date.now();

  test("creates a case to rename", async ({ page }) => {
    await page.goto("/cases/new");
    await page.getByText(/Something else/i).click();
    await page.getByPlaceholder(/e\.g\. Texas/i).fill("Texas");
    await page.getByPlaceholder(/What's happening/i).fill("Rename test");
    await page.getByPlaceholder(/Name or company/i).fill("Rename Opposing");
    await page.getByRole("button", { name: /set up my case/i }).click();
    await page.waitForURL(/\/cases\/new/);
    await page.getByRole("button", { name: /continue without documents/i }).click();
    await page.waitForURL(/\/cases\/[a-f0-9-]+$/);
    renameCaseUrl = page.url();
  });

  test("renames the case via Settings and reflects on the page", async ({ page }) => {
    if (!renameCaseUrl) test.skip();
    await page.goto(renameCaseUrl);
    await page.getByRole("button", { name: /more/i }).click();
    await page.getByRole("button", { name: /settings/i }).click();
    await expect(page.getByText(/case details/i)).toBeVisible();

    // The first input under "Case details" is the Case name field
    const nameInput = page.locator("input").first();
    await nameInput.fill(newName);

    // Wait for PATCH to land before navigating away
    await Promise.all([
      page.waitForResponse(r =>
        /\/api\/cases\/[a-f0-9-]+$/.test(r.url()) && r.request().method() === "PATCH" && r.ok(),
        { timeout: 10_000 },
      ),
      page.getByRole("button", { name: /save changes/i }).click(),
    ]);

    // Reload the case page — header h1 should show the new name
    await page.goto(renameCaseUrl);
    await expect(page.getByRole("heading", { name: newName })).toBeVisible();
  });

  test("deletes the renamed case", async ({ page }) => {
    if (!renameCaseUrl) test.skip();
    await page.goto(renameCaseUrl);
    await page.getByRole("button", { name: /more/i }).click();
    await page.getByRole("button", { name: /settings/i }).click();
    await expect(page.getByText(/danger zone/i)).toBeVisible();
    const caseName = await page.locator("p.font-mono").textContent();
    expect(caseName).toBeTruthy();
    await page.getByPlaceholder(/type the case name/i).fill(caseName!.trim());
    await page.getByRole("button", { name: /permanently delete/i }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 15_000 });
  });
});

test.describe("Case cleanup", () => {
  test("deletes the test case", async ({ page }) => {
    if (!caseUrl) test.skip();
    await page.goto(caseUrl);

    await page.getByRole("button", { name: /more/i }).click();
    await page.getByRole("button", { name: /settings/i }).click();
    await expect(page.getByText(/danger zone/i)).toBeVisible();

    // Read the exact case name from the monospace confirmation hint
    const caseName = await page.locator("p.font-mono").textContent();
    expect(caseName).toBeTruthy();

    // Type the case name to enable the delete button
    await page.getByPlaceholder(/type the case name/i).fill(caseName!.trim());
    await page.getByRole("button", { name: /permanently delete/i }).click();

    await page.waitForURL(/\/dashboard/, { timeout: 15_000 });
    await expect(page).toHaveURL(/\/dashboard/);
  });
});
