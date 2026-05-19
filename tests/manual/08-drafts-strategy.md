# 08 — Drafts & Strategy

**Pre-conditions:** Unlocked case with some data (timeline entries, evidence). Navigate via left nav AI → Drafts or Case File → Strategy.

---

## DRAFT-01 · Generate a draft · P0

1. Go to **Drafts** tab (AI group in left nav)
2. Select **"Police statement"** from the dropdown
3. Click **Generate**

**Expected:**
- Button shows "Generating…" while loading
- After completion (may take 15–30 seconds), a formatted document appears in the textarea
- Document begins with "DRAFT — Review carefully before use. Not legal advice."
- Document references actual facts from the case (names, dates, events) — not generic placeholders
- Document is NOT truncated mid-sentence (max_tokens is 4096)

---

## DRAFT-02 · Draft saves and persists per type · P0

1. Generate a "Police statement" draft
2. Make a small edit to the text (add a word)
3. Wait 2 seconds for autosave
4. Switch the dropdown to **"Demand letter"**
5. Verify the textarea clears / shows the demand letter draft (or blank if not generated)
6. Switch back to **"Police statement"**

**Expected:** Your edited police statement text returns exactly as you left it. Each draft type saves independently. Switching types does not overwrite other types.

---

## DRAFT-03 · Drafts locked for unpaid case · P1

1. Open a locked (unpaid) case
2. Navigate to Drafts tab

**Expected:** Lock CTA appears: "Your case is ready for Vera's full analysis" with $49 unlock button. No draft textarea or Generate button visible.

---

## DRAFT-04 · All 5 draft types work · P1

Test each draft type generates without error:
- [ ] Police statement
- [ ] Letter to opposing counsel
- [ ] Declaration for court
- [ ] Demand letter
- [ ] Incident narrative

**Expected:** All generate successfully. Each produces a distinct document appropriate to the type. No 500 errors.

---

## STRAT-01 · Strategy notes save and reload · P0

1. Go to **Strategy** tab (Case File group)
2. Type several sentences: "My strongest argument is X because Y..."
3. Wait 2 seconds (autosave triggers after 1.5s)
4. Verify "Saved ✓" appears briefly
5. Navigate to Timeline tab
6. Navigate back to Strategy

**Expected:** Your text is still there exactly as typed. "Saved ✓" appeared after typing stopped. Loading the tab again fetches fresh content (not the stale initial load).

---

## STRAT-02 · Strategy placeholder is clear · P2

1. Open a case with no strategy notes
2. Navigate to Strategy tab

**Expected:** Placeholder text reads "What is your argument? What do you believe happened and why does it matter?..." — gives clear guidance. Header says "Case strategy" with the sub-text "Your argument, case theory, and private thinking."
