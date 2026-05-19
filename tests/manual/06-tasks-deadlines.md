# 06 — Tasks & Deadlines

**Pre-conditions:** Any case. Navigate to Tasks or Deadlines via left nav.

---

## TASK-01 · Add and move a task · P0

1. Go to Tasks tab
2. Enter a task title and click **Add**
3. Verify task appears in the **To Do** column
4. Click **Start** on the task
5. Verify it moves to **In Progress**
6. Click **Done** on the task
7. Verify it moves to **Done** with strikethrough styling

**Expected:** All three column transitions work. Task persists after page reload in the correct column.

---

## TASK-02 · Starter tasks seeded on case creation · P1

1. Create a new divorce case via the wizard
2. Open the case and navigate to Tasks

**Expected:** 4–5 pre-seeded tasks appear in the To Do column relevant to divorce (e.g. "Gather bank and financial statements", "List all marital assets"). Not generic placeholder tasks.

---

## TASK-03 · Delete a task · P1

1. Add a task
2. Click the **✕** delete button on the task row (may appear on hover)
3. Confirm deletion

**Expected:** Task removed immediately. No page reload needed.

---

## TASK-04 · Add a deadline · P0

1. Go to Deadlines tab
2. Enter a label, select a date 30 days from today, and click **Add**
3. Verify the deadline appears in the list
4. Check the case page stats bar

**Expected:** Deadline appears in list. Stats bar "Next deadline" updates to show this deadline if it's the soonest. Label and date both visible.

---

## TASK-05 · Complete a deadline · P0

1. Click the checkbox or **Complete** button on a deadline
2. Verify it moves to a completed/strikethrough state
3. Reload the page

**Expected:** Completed deadline persists as completed. "Next deadline" in stats bar updates to the next uncompleted one.

---

## TASK-06 · Overdue deadlines · P2

1. Add a deadline with a date in the past
2. Check the stats bar

**Expected:** Past uncompleted deadlines do not show in the "Next deadline" stat (filter is `days >= 0`). This is known behavior — they're not surfaced in the header but remain visible in the Deadlines tab.
