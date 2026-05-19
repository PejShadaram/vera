# 09 — Rules & Statutes

**Pre-conditions:** Any case with jurisdiction set. Navigate to Rules tab (AI group).

---

## RULES-01 · Rules load and disclaimer is prominent · P0

1. Navigate to **Rules** tab
2. Verify the yellow warning box appears immediately (before any data loads)
3. Read the warning

**Expected:** Warning box is visible during loading: "AI-generated — verify before acting on anything here. Deadlines, statute numbers, and procedural rules change. A wrong deadline can lose a case."

---

## RULES-02 · Rules content loads · P0

1. Wait for rules to finish loading (may take 10–20 seconds on first load)
2. Verify at least one section appears: statutes, deadlines, or key warnings

**Expected:** Content appears. At minimum "Key warnings" or "Critical deadlines" section visible. No 500 error or timeout message.

---

## RULES-03 · Rules cached on second visit · P1

1. Visit the Rules tab — wait for it to load
2. Navigate to another tab
3. Navigate back to Rules

**Expected:** Rules load instantly on the second visit (30-day cache). No regeneration delay.

---

## RULES-04 · Rules specific to case type and jurisdiction · P2

1. Check the content of rules for a **divorce** case in **Texas**
2. Check the content for a **landlord/tenant** case in **Florida**

**Expected:** Rules are meaningfully different between the two. Divorce/Texas rules should mention community property, SAPCR, Texas Family Code. Landlord/Florida rules should mention Florida Statute 83.51, security deposit timelines. Generic boilerplate is a failure.
