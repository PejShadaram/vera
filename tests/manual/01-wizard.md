# 01 — Case Creation Wizard

**Pre-conditions:** Signed in. No existing cases (or use a fresh account).

---

## WIZ-01 · Case type selection auto-advances · P0

1. Go to `/cases/new`
2. Click **"My marriage is ending"**
3. Observe the card highlights with a checkmark and slight scale animation

**Expected:** After ~300ms the card remains selected and the page advances to Step 2 automatically without a second click.

---

## WIZ-02 · Back navigation works correctly · P0

1. Complete Step 1 (select any case type)
2. On Step 2, click **← Back**
3. Verify you are back on Step 1 with the case type still selected
4. Click a different case type
5. Verify you advance to Step 2 again

**Expected:** Back returns to Step 1. Selecting a different type works. No state corruption.

---

## WIZ-03 · Opposing party is optional · P1

1. Complete Step 1 (select "Something else")
2. On Step 2, leave the opposing party field empty
3. Verify the **Continue →** button is enabled
4. Verify a **"I don't know yet — skip for now"** link appears below
5. Click Continue with empty field
6. Verify you advance to Step 3 (state) for "other" type

**Expected:** Can proceed without opposing party. No validation error.

---

## WIZ-04 · Context questions show per case type · P1

1. Start wizard, select **"My marriage is ending"** (divorce)
2. On Step 2, enter an opposing party name and click Continue
3. On Step 3 verify these questions appear:
   - "Do you have children together?" (radio: Yes/No)
   - "Is there property to divide?" (radio: Yes/No)
   - "Is this contested?" (radio: Yes/No/Not sure)
4. Answer all three
5. Click **Continue →**
6. Verify you reach Step 4 (state)

**Expected:** All three questions appear for divorce. Continue is disabled until all answered. Advancing to state works.

---

## WIZ-05 · Case creation and navigation to case page · P0

1. Complete all 4 wizard steps for "other" case type:
   - Step 1: Something else
   - Step 2: Continue (empty opposing is fine)
   - Step 3: State = "California"
   - Click **Create my case →**
2. Wait for the green **"Your case is set up ✓"** banner
3. Click **Go to my case →**

**Expected:** Redirected to `/cases/[uuid]`. Case page loads. Case name appears in header. No error.

---

## WIZ-06 · Progress bar shows correct step count · P1

1. Start wizard with "other" case type (no context questions)
2. Observe progress bar at Step 1, 2, 4
3. Repeat with "divorce" case type
4. Observe progress bar at steps 1, 2, 3, 4

**Expected:**
- "Other": bar shows "Step 1 of 3", "Step 2 of 3", "Step 3 of 3" (no jump)
- "Divorce": bar shows "Step 1 of 4" through "Step 4 of 4"
- "You can change everything later" appears under bar on all steps

---

## WIZ-07 · Upload + autoprocess on case page · P0

1. Complete wizard through case creation (step 4)
2. On the upload screen (step 5), upload a `.txt` file from `/test-data/`
3. Wait for upload to complete (shows "Done" badge)
4. Verify **"Analyze X document with AI — $49"** button appears (or "Apply credit — unlock free" if credits available)
5. Click **"Skip for now — go to my case"**

**Expected:** Navigates to case page with `?autoprocess=1` in URL. If case is unlocked, an amber progress banner appears: "Vera is reading your documents…". Processing runs automatically.

---

## WIZ-08 · Case-type specific upload hint · P2

1. Complete wizard for "custody" case type through to upload screen
2. Check for the amber 💡 tip box above the drop zone

**Expected:** Shows "Courts care about demonstrated daily involvement. School records, medical appointments…" (custody-specific tip, not the generic one).
