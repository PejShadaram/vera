# 02 — Case Page & Header

**Pre-conditions:** At least one case exists. Navigate to that case.

---

## CASE-01 · Stats bar shows correct counts · P0

1. Open any case with at least 1 timeline entry, 1 document, 1 task, and 1 deadline
2. Check the 4 stat cards at the top:
   - "Timeline events" — count matches what's in Timeline tab
   - "Documents" — count matches. Sub-label shows "X pending AI" if unprocessed
   - "Active tasks" — count of non-done tasks
   - "Next deadline" — shows soonest uncompleted deadline in days, or "None"

**Expected:** All counts accurate. "Next deadline" shows "Today" when due today, turns amber/red when ≤7 days out.

---

## CASE-02 · Hearing date badge · P0

1. Go to Settings tab and set a hearing date 10 days from today
2. Navigate back to the case page header

**Expected:** A colored badge appears near the case name: "Hearing in 10 days" in amber. Verify it turns red when ≤14 days (set hearing date 5 days out and reload).

3. Set hearing date to yesterday
4. Reload case page

**Expected:** Badge reads "Hearing was [date]" in grey.

---

## CASE-03 · ReadinessWidget disappears when complete · P1

1. Open a fresh case with nothing added yet
2. Verify "Strengthen Vera's analysis" widget is visible with 4 items unchecked
3. Add a timeline entry → verify that item checks off
4. Add an evidence item → verify
5. Set hearing date in Settings → verify
6. Upload and process a document → verify final item checks off

**Expected:** After all 4 are done the widget disappears entirely from the page.

---

## CASE-04 · Case type badge and opposing party in header · P1

1. Create a custody case with opposing party "Jane Smith"
2. Open the case page

**Expected:** "Child Custody" badge visible near the title. "vs. Jane Smith" visible in the sub-header.

---

## CASE-05 · Closed case banner · P2

1. Go to Settings → Case Lifecycle → click **Closed**
2. Navigate back to the case page

**Expected:** Amber "This case is closed" banner appears at top with "Export case file" and "Start new case" buttons. Case still fully accessible.

---

## CASE-06 · Export button opens print view · P2

1. On any populated case, click **Export** in the top-right header
2. Verify the export page loads at `/cases/[id]/export`
3. Check that all sections with data appear: Timeline, Evidence, Documents, Tasks, Deadlines, Finances

**Expected:** Print-ready view loads. "Not legal advice" footer present. Deadline dates display as YYYY-MM-DD (not "Mon May 19").
