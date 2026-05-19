# 12 — Admin Panel

**Pre-conditions:** Signed in as admin (pshadaram@gmail.com or any email in ADMIN_EMAILS env var).

---

## ADM-01 · Admin link visible in nav · P1

1. Sign in as admin
2. Check the top navigation bar

**Expected:** "Admin" link visible in the header nav. Not visible when signed in as a non-admin account.

---

## ADM-02 · Admin stats load · P0

1. Navigate to `/admin`
2. Verify the stats dashboard loads

**Expected:**
- Key metrics visible: total users, cases, processed documents, revenue
- No "Access denied" or 403 error for admin user
- Stats exclude test accounts (+clerk_test@ and @vera-user.local emails)

---

## ADM-03 · Non-admin cannot access admin · P0

1. Sign in as a non-admin test account
2. Navigate to `/admin`

**Expected:** Page shows "Access denied" or redirects. API calls to `/api/admin/*` return 403.

---

## ADM-04 · Admin does not pay for case unlocks · P0

1. Sign in as admin
2. Create a new case
3. Check if Vera's Take shows the full analysis without paying
4. Check if Ask Vera FAB opens chat (not lock screen)

**Expected:** Admin account has `is_admin = true` in DB — all AI features work without payment. No $49 prompt shown.

---

## ADM-05 · Account page loads · P2

1. Navigate to `/account` from the nav
2. Verify the account management page loads

**Expected:** Account page renders. Clerk user profile info visible. No errors.
