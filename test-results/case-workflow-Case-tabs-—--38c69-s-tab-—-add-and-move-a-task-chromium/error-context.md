# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: case-workflow.spec.ts >> Case tabs — primary >> Tasks tab — add and move a task
- Location: tests/e2e/case-workflow.spec.ts:76:7

# Error details

```
Test timeout of 90000ms exceeded.
```

```
Error: locator.click: Test timeout of 90000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: 'Tasks', exact: true })

```

# Page snapshot

```yaml
- generic [ref=e2]: "{\"errors\":[{\"code\":\"too_many_requests\",\"message\":\"Too many requests. Please try again in a bit.\"}]}"
```

# Test source

```ts
  1   | /**
  2   |  * Full case creation and management workflow.
  3   |  * Creates a real case, exercises all primary tabs, then deletes.
  4   |  */
  5   | import { test, expect } from "@playwright/test";
  6   | import * as path from "path";
  7   | 
  8   | const FIXTURE = path.join(__dirname, "../fixtures/test-document.txt");
  9   | let caseUrl = "";
  10  | 
  11  | test.describe("Case creation wizard", () => {
  12  |   test("completes new case wizard", async ({ page }) => {
  13  |     await page.goto("/cases/new");
  14  | 
  15  |     // Step 1 — pick case type (click the "other" option)
  16  |     await page.getByText(/Something else/i).click();
  17  | 
  18  |     // Step 2 — fill in details
  19  |     await page.getByPlaceholder(/e\.g\. Texas/i).fill("California");
  20  |     await page.getByPlaceholder(/What's happening/i).fill("E2E test dispute");
  21  |     await page.getByPlaceholder(/Name or company/i).fill("Test Opposing Party");
  22  |     await page.getByRole("button", { name: /set up my case/i }).click();
  23  | 
  24  |     // Step 3 — skip document upload
  25  |     await page.waitForURL(/\/cases\/new/);
  26  |     await page.getByRole("button", { name: /continue without documents/i }).click();
  27  | 
  28  |     // Should land on the case page
  29  |     await page.waitForURL(/\/cases\/[a-f0-9-]+$/);
  30  |     caseUrl = page.url();
  31  |     expect(caseUrl).toMatch(/\/cases\/[a-f0-9-]+$/);
  32  |   });
  33  | });
  34  | 
  35  | test.describe("Case tabs — primary", () => {
  36  |   test.beforeEach(async ({ page }) => {
  37  |     if (!caseUrl) test.skip();
  38  |     await page.goto(caseUrl);
  39  |   });
  40  | 
  41  |   test("Timeline tab — add and see entry", async ({ page }) => {
  42  |     await expect(page.getByRole("tab", { name: /timeline/i }).or(
  43  |       page.getByRole("button", { name: /timeline/i })
  44  |     )).toBeVisible();
  45  | 
  46  |     // Add a timeline entry
  47  |     const dateInput = page.locator('input[type="date"]').first();
  48  |     await dateInput.fill("2025-03-15");
  49  |     await page.getByPlaceholder(/describe what happened/i).fill("E2E test event");
  50  |     await page.getByRole("button", { name: /^add$/i }).first().click();
  51  | 
  52  |     await expect(page.getByText("E2E test event")).toBeVisible();
  53  |   });
  54  | 
  55  |   test("Documents tab — upload test file", async ({ page }) => {
  56  |     await page.getByRole("button", { name: "Documents", exact: true }).click();
  57  |     await expect(page.getByText(/upload document/i)).toBeVisible();
  58  | 
  59  |     const [fileChooser] = await Promise.all([
  60  |       page.waitForEvent("filechooser"),
  61  |       page.getByText(/upload document/i).click(),
  62  |     ]);
  63  |     await fileChooser.setFiles(FIXTURE);
  64  | 
  65  |     // File should appear in the list
  66  |     await expect(page.getByText("test-document.txt")).toBeVisible({ timeout: 15_000 });
  67  |   });
  68  | 
  69  |   test("Evidence tab — add manual entry", async ({ page }) => {
  70  |     await page.getByText("Evidence").click();
  71  |     await page.getByPlaceholder(/evidence title/i).fill("E2E test evidence");
  72  |     await page.getByRole("button", { name: /^add$/i }).first().click();
  73  |     await expect(page.getByText("E2E test evidence")).toBeVisible();
  74  |   });
  75  | 
  76  |   test("Tasks tab — add and move a task", async ({ page }) => {
> 77  |     await page.getByRole("button", { name: "Tasks", exact: true }).click();
      |                                                                    ^ Error: locator.click: Test timeout of 90000ms exceeded.
  78  |     await page.getByPlaceholder(/add a task/i).fill("E2E test task");
  79  |     await page.getByRole("button", { name: /^add$/i }).first().click();
  80  |     await expect(page.getByText("E2E test task")).toBeVisible();
  81  | 
  82  |     // Move to In Progress
  83  |     await page.getByRole("button", { name: /start/i }).first().click();
  84  |     await expect(page.getByText("In Progress")).toBeVisible();
  85  |   });
  86  | 
  87  |   test("Deadlines tab — add a deadline", async ({ page }) => {
  88  |     await page.getByText("Deadlines").click();
  89  |     await page.getByPlaceholder(/deadline description/i).fill("E2E test deadline");
  90  |     const datePicker = page.locator('input[type="date"]').first();
  91  |     await datePicker.fill("2025-12-31");
  92  |     await page.getByRole("button", { name: /^add$/i }).first().click();
  93  |     await expect(page.getByText("E2E test deadline")).toBeVisible();
  94  |   });
  95  | });
  96  | 
  97  | test.describe("Case tabs — secondary (More menu)", () => {
  98  |   test.beforeEach(async ({ page }) => {
  99  |     if (!caseUrl) test.skip();
  100 |     await page.goto(caseUrl);
  101 |   });
  102 | 
  103 |   test("opens More dropdown and navigates to Notes", async ({ page }) => {
  104 |     await page.getByRole("button", { name: /more/i }).click();
  105 |     await expect(page.getByRole("button", { name: /notes/i })).toBeVisible();
  106 |     await page.getByRole("button", { name: /^notes$/i }).click();
  107 |     await expect(page.getByPlaceholder(/start writing/i)).toBeVisible();
  108 |   });
  109 | 
  110 |   test("opens Ask Vera tab", async ({ page }) => {
  111 |     await page.getByRole("button", { name: /more/i }).click();
  112 |     await page.getByRole("button", { name: /ask vera/i }).click();
  113 |     // Locked case shows lock CTA; unlocked shows chat input — either is correct
  114 |     await expect(
  115 |       page.getByPlaceholder(/ask about your case/i).or(page.getByText(/unlock.*case/i).first())
  116 |     ).toBeVisible({ timeout: 8_000 });
  117 |   });
  118 | 
  119 |   test("opens Finances tab", async ({ page }) => {
  120 |     await page.getByRole("button", { name: /more/i }).click();
  121 |     await page.getByRole("button", { name: /^finances$/i }).click();
  122 |     await expect(page.getByText(/assets/i)).toBeVisible();
  123 |   });
  124 | 
  125 |   test("opens Calculator tab", async ({ page }) => {
  126 |     await page.getByRole("button", { name: /more/i }).click();
  127 |     await page.getByRole("button", { name: /calculator/i }).click();
  128 |     await expect(page.getByText(/marital estate/i)).toBeVisible();
  129 |   });
  130 | 
  131 |   test("opens Settings and shows case name", async ({ page }) => {
  132 |     await page.getByRole("button", { name: /more/i }).click();
  133 |     await page.getByRole("button", { name: /settings/i }).click();
  134 |     await expect(page.getByText(/case details/i)).toBeVisible();
  135 |     await expect(page.getByText(/danger zone/i)).toBeVisible();
  136 |   });
  137 | });
  138 | 
  139 | test.describe("Vera's Take", () => {
  140 |   test("Vera's Take panel loads", async ({ page }) => {
  141 |     if (!caseUrl) test.skip();
  142 |     await page.goto(caseUrl);
  143 |     // Panel always renders — locked shows unlock prompt, unlocked shows analysis
  144 |     await expect(page.getByText(/vera's take/i)).toBeVisible();
  145 |     await expect(
  146 |       page.getByText(/loading/i)
  147 |         .or(page.getByText(/next/i))
  148 |         .or(page.getByText(/unlock/i).first())
  149 |     ).toBeVisible({ timeout: 15_000 });
  150 |   });
  151 | });
  152 | 
  153 | test.describe("Case cleanup", () => {
  154 |   test("deletes the test case", async ({ page }) => {
  155 |     if (!caseUrl) test.skip();
  156 |     await page.goto(caseUrl);
  157 | 
  158 |     // Go to Settings → delete
  159 |     await page.getByRole("button", { name: /more/i }).click();
  160 |     await page.getByRole("button", { name: /settings/i }).click();
  161 |     await page.getByRole("button", { name: /delete this case/i }).click();
  162 | 
  163 |     // Two confirmation dialogs
  164 |     page.on("dialog", async dialog => { await dialog.accept(); });
  165 | 
  166 |     await page.waitForURL(/\/dashboard/, { timeout: 10_000 });
  167 |     await expect(page).toHaveURL(/\/dashboard/);
  168 |   });
  169 | });
  170 | 
```