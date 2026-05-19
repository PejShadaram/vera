# 05 — Vera's Take & Ask Vera FAB

**Pre-conditions:** Case with at least some data (timeline entries or processed documents).

---

## VT-01 · Vera's Take teaser for locked case · P0

1. Open a locked (unpaid) case with some data
2. Click the Vera's Take header to expand it

**Expected:**
- Blurred preview content is visible (observations, gaps, next action in blur)
- Overlay shows "Vera has analyzed your case — unlock to read her findings"
- "Unlock full analysis — $49" button visible
- No raw JSON or error text visible

---

## VT-02 · Vera's Take shows full analysis when unlocked · P0

1. Open an unlocked case with processed documents
2. Click Vera's Take header to expand

**Expected:**
- Summary paragraph visible (plain text, no markdown artifacts)
- "What I notice" section with bullet observations
- "What may be missing" section with gap bullets
- "Next" amber box with the most urgent action
- "Vera is not an attorney" disclaimer at bottom

---

## VT-03 · Vera's Take auto-expands after unlock · P0

1. Complete the Stripe payment flow for a locked case
2. Observe the case page as it loads with `?unlocked=1`

**Expected:**
- Green "AI unlocked" banner appears
- Vera's Take is already expanded (no click needed)
- Analysis is loading or complete

---

## VT-04 · Vera's Take refreshes after new data · P1

1. Expand Vera's Take and note the summary text
2. Add a new timeline entry
3. Wait 2–3 seconds

**Expected:** Vera's Take dot pulses (animates). After a short delay, the analysis refreshes automatically with updated content reflecting the new entry.

---

## VT-05 · Refresh button forces new analysis · P1

1. Expand Vera's Take (unlocked case)
2. Click the **Refresh** button in the header

**Expected:** "Updating…" spinner appears. After completion, new analysis text appears. The analysis reflects the latest case data.

---

## VT-06 · FAB opens and closes correctly · P0

1. On any case page, click the amber Vera dot (bottom right)
2. Verify two option pills appear above it: "Ask Vera" and "Log a note"
3. Tap anywhere on the background (outside the pills)

**Expected:** Pills appear with fade-in animation. Tapping outside closes them. The dot rotates to an ✕ when open, back to the V when closed.

---

## VT-07 · Ask Vera drawer opens and chat works · P0

1. Click the FAB → click **Ask Vera**
2. Verify the drawer slides in from the right
3. For an unlocked case: verify suggestion chips are visible ("Summarize the key events", etc.)
4. Click any suggestion chip

**Expected:** Chip immediately sends the message (no second click needed). Vera's response streams in. Response renders as formatted markdown — headers, bold, lists — not raw `##` and `**` syntax.

---

## VT-08 · Ask Vera drawer shows unlock CTA for locked case · P1

1. Open a locked case
2. Click FAB → Ask Vera

**Expected:** Drawer opens but shows "Your case is ready for Vera's full analysis" with the $49 unlock button. No chat input visible.

---

## VT-09 · Hearing prep chip · P1

1. Set a hearing date in Settings (e.g. 2 weeks from today)
2. Open Ask Vera FAB
3. Verify the hearing prep chip shows the date: "⚖️ Prep for hearing on [date]"
4. Click the chip

**Expected:** Chip sends the full hearing prep prompt automatically. Vera responds with structured preparation advice.

---

## VT-10 · Log a note via FAB updates Timeline · P0

1. Click FAB → Log a note
2. Enter text and save
3. Without navigating, check if the Timeline tab (if open) updates

**Expected:** The quick note appears in Timeline immediately (via `vera-capture` event). Vera's Take also refreshes (via `vera:case-updated` event).
