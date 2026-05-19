# 04 — Timeline & Captures

**Pre-conditions:** Any case open. Navigate to Timeline tab (default on load).

---

## TL-01 · Add timeline entry · P0

1. Enter a date using the date picker (e.g. 2025-06-15)
2. Enter event text: "Test event for regression"
3. Press Enter or click **Add**

**Expected:**
- Entry appears at the top of the list (newest first)
- Date displays as YYYY-MM-DD format (e.g. "2025-06-15"), NOT "Jun 15" or "June 15, 2025"
- `vera:case-updated` fires — Vera's Take dot pulses/refreshes

---

## TL-02 · Timeline sorts descending · P0

1. Add an entry with date 2020-01-01
2. Add an entry with date 2025-12-31
3. Add an entry with date 2022-06-15

**Expected:** Entries appear in order: 2025-12-31 at top, 2022-06-15 in middle, 2020-01-01 at bottom.

---

## TL-03 · Add and edit note on timeline entry · P1

1. Click **+ note** on any timeline entry
2. Type a note and press Cmd+Enter (or click Save)
3. Verify note appears in an amber box below the event text
4. Click **edit note**, change the text, save again

**Expected:** Note saves and persists on page reload. Edit updates in place. No page refresh required.

---

## TL-04 · Delete timeline entry · P1

1. Hover over a timeline entry
2. Click **delete**
3. Confirm the browser dialog

**Expected:** Entry disappears from list immediately. Count in stats bar decrements.

---

## TL-05 · Quick captures appear in Timeline · P0

1. Click the Vera dot FAB (bottom right)
2. Click **Log a note**
3. Enter text: "Quick capture test entry"
4. Click **Log it** or press Cmd+Enter

**Expected:**
- Capture panel closes with a brief "Saved ✓" confirmation
- The Timeline tab (if open) immediately shows "Quick capture test entry" with a grey dot and "Quick note" chip
- If Timeline tab is not open, navigate to it — entry is visible
- Date shown is today's date in YYYY-MM-DD format

---

## TL-06 · Captures and entries sort together correctly · P1

1. Add a timeline entry with date 2025-01-01
2. Add a quick capture (shows today's date)
3. Check sort order

**Expected:** If today is after 2025-01-01, the quick capture appears above the 2025-01-01 entry. Dates display correctly for both types.
