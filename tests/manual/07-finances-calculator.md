# 07 — Finances & Calculator

**Pre-conditions:** A divorce, custody, employment, or small claims case (Calculator only shows for these types).

---

## FIN-01 · Add financial items · P0

1. Go to Finances tab
2. Add an Asset: description "Test house", amount $400,000
3. Add a Debt: description "Test mortgage", amount $250,000
4. Add an Income item: description "Annual salary", amount $95,000

**Expected:**
- Each item appears in the list with the correct category badge (green for Asset, red for Debt, blue for Income)
- Badge background color renders correctly (not invisible/white)
- Summary cards at top show correct totals: Assets $400k, Debts $250k

---

## FIN-02 · Delete a financial item · P1

1. Click **✕** on any financial item

**Expected:** Item removed immediately. Summary totals update.

---

## FIN-03 · Calculator shows for correct case types · P1

1. Check that Calculator tab appears in the nav for: divorce, custody, employment, small claims
2. Open a landlord/tenant or "other" case
3. Check the nav

**Expected:** Calculator is present for divorce/custody/employment/small claims. Absent for landlord/tenant and other.

---

## FIN-04 · Calculator outcome comparison · P0

1. Open a divorce or custody case with financial items added
2. Go to Calculator tab
3. Verify the "Outcome comparison" section is visible
4. Toggle between "I'm making an offer" and "I received an offer"

**Expected:** Calculator renders without errors. Outcome comparison section visible. No divide-by-zero errors when fields are zero.

---

## FIN-05 · Finances on export · P2

1. Add assets and debts to a case
2. Open the Export page
3. Check the Financial Summary section

**Expected:** Total assets and total debts shown. Net calculation correct. Income/Expense items are listed in the table but only Asset/Debt appear in the summary totals (known limitation).
