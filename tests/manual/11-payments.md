# 11 — Payments & Unlock Flow

**Pre-conditions:** A test Stripe card. Use Stripe test card `4242 4242 4242 4242`, any future expiry, any CVC.
⚠️ Do NOT use real payment details for testing. Stripe test mode only.

---

## PAY-01 · UnlockBanner visible on locked case · P0

1. Create a new case (do not pay)
2. Open the case page

**Expected:**
- Amber gradient banner is visible: "Unlock AI for this case"
- Shows "3 free AI document processes included · Vera's Take · Ask Vera"
- "Unlock AI — $49" button visible
- "One-time · $49 · Yours forever · No subscription" text visible

---

## PAY-02 · Unlock button redirects to Stripe · P0

1. Click **Unlock AI — $49** on the UnlockBanner
2. Verify browser navigates away (not a broken redirect)

**Expected:** Stripe checkout page loads with correct product ($49). URL is on checkout.stripe.com. No blank page or error.

---

## PAY-03 · Successful payment unlocks case · P0

1. Complete the Stripe test payment (card: 4242 4242 4242 4242)
2. Wait for redirect back to Vera

**Expected:**
- Redirected to `/cases/[id]?unlocked=1`
- Green "AI unlocked for this case" banner appears
- Vera's Take auto-expands
- UnlockBanner is gone
- Ask Vera FAB opens a chat drawer (not a lock screen)
- Drafts tab shows draft generator (not lock CTA)

---

## PAY-04 · Bundle credit shown in UnlockBanner · P1

*(Requires a pre-purchased bundle credit — NULL case_id in purchases table)*

1. With a bundle credit available, open a locked case
2. Check the UnlockBanner

**Expected:** Banner shows "You have a case credit ready to apply" and button reads "Apply credit — unlock free" instead of "$49".

---

## PAY-05 · Bundle credit auto-applies on unlock click · P1

1. With a bundle credit available, click **Apply credit — unlock free**

**Expected:** Stripe checkout auto-applies the credit and returns a success URL without requiring payment entry. Or: server returns the unlock URL directly without a Stripe session. Case unlocks.

---

## PAY-06 · Already-unlocked case shows no banner · P0

1. Open a case that has been paid for

**Expected:** UnlockBanner is completely absent. No "$49" text visible anywhere on the case page.

---

## PAY-07 · Bundle purchase from dashboard · P2

1. Go to Dashboard
2. Look for a bundle purchase option (may be via Pricing page → `/dashboard?bundle=1`)
3. Complete a bundle purchase ($79 for 2 cases)

**Expected:**
- Redirected to `/dashboard?bundle_success=1`
- Green success banner: "2 case credits purchased"
- Dashboard shows credit count
- Opening any locked case shows "Apply credit — unlock free"

---

## PAY-08 · Pricing page · P2

1. Go to `/pricing`
2. Verify the page loads without auth errors
3. Check that both the single case ($49) and bundle ($79) options are visible
4. Click the single case CTA

**Expected:** Navigates to dashboard or sign-in (if logged out). No broken links.
