# 10 — Settings & Export

**Pre-conditions:** Any case open. Navigate to Settings via left nav bottom.

---

## SET-01 · All case detail fields save · P0

1. Go to Settings tab
2. Fill in or update each field:
   - Case name
   - Your full legal name (petitioner)
   - Opposing party
   - State / jurisdiction
   - Court name
   - Case / cause number
   - Hearing date (use date picker)
3. Click **Save changes**
4. Reload the page

**Expected:** All fields retain their values after reload. Hearing date shows correctly (YYYY-MM-DD in the input, badge in header). No "Mon May 19" format bugs.

---

## SET-02 · Clear hearing date · P1

1. Set a hearing date
2. Return to Settings, clear the hearing date field (delete the value)
3. Click Save changes
4. Reload

**Expected:** Hearing date is cleared. The hearing badge no longer appears in the case header.

---

## SET-03 · Case lifecycle status · P1

1. In Settings, click **Closed** in the Case Lifecycle section
2. Verify the status saves immediately (no save button needed)
3. Navigate away and back

**Expected:** Case shows "Closed" badge in the header. The "This case is closed" banner appears on the case page. Status persists after reload.

---

## SET-04 · Case deletion requires name confirmation · P0

1. Scroll to the Danger Zone in Settings
2. Try clicking "Permanently delete" without typing the case name

**Expected:** Button is disabled (greyed out) until the correct case name is typed. Once typed correctly, button activates and turns red.

3. Type the correct case name
4. Click **Permanently delete**

**Expected:** Redirects to `/dashboard`. Case no longer appears in the dashboard list.

---

## EXP-01 · Export renders all sections · P0

1. Open the demo divorce case (Chen v. Chen) or any fully populated case
2. Click **Export** in the header
3. Verify each section is present:
   - [ ] Case header with name, opposing party, jurisdiction, court, case number
   - [ ] Timeline (up to 10 most recent events)
   - [ ] Evidence log with all items
   - [ ] Documents on file
   - [ ] Financial Summary with totals
   - [ ] Tasks (grouped by To Do / In Progress / Done)
   - [ ] Upcoming Deadlines
   - [ ] Notes (if any)
   - [ ] Footer with "Not legal advice"

**Expected:** All sections with data appear. Empty sections are omitted cleanly.

---

## EXP-02 · Deadline dates format correctly · P0

1. Add a deadline to a case
2. Open the Export page

**Expected:** Deadline date shows as YYYY-MM-DD (e.g. "2026-07-15"), not as a JavaScript Date object string ("Mon Jul 15 2026...").

---

## EXP-03 · Print button triggers browser print · P2

1. On the Export page, click **Print**

**Expected:** Browser print dialog opens. Nav buttons and action elements are hidden in the print preview.
