# Vera Manual Regression Library

Manual test cases for veracase.app. Run these against production before any significant release or after major feature changes.

## How to run a regression cycle

1. Sign in with a test account (not your personal account — use a separate Clerk test account)
2. Work through each file in order — each builds on the previous
3. Mark each step **PASS**, **FAIL**, or **SKIP** (with reason)
4. For any FAIL, open a GitHub issue before moving on
5. A release is blocked if any P0 or P1 test fails

## Priority levels

| Level | Meaning |
|---|---|
| **P0** | Blocks release — core user journey or data integrity |
| **P1** | Should fix before release — significant UX breakage |
| **P2** | Fix soon — minor UX issue, workaround exists |
| **P3** | Nice to have — polish, edge case |

## Test data

Realistic test documents are in `/test-data/` — one folder per case type. Use these when tests require document uploads.

## Environment

- **URL:** https://veracase.app
- **Browser:** Chrome latest (primary), Safari (secondary for iOS tests)
- **Viewport:** 1280×800 desktop + 390×844 iPhone (test both for any UI change)
- **Test account:** Create a fresh Clerk account — do not use pshadaram@gmail.com

## Files

| File | Area | P0 tests |
|---|---|---|
| 01-wizard.md | Case creation wizard | 6 |
| 02-case-page.md | Case page + header | 4 |
| 03-documents.md | Document upload + processing | 8 |
| 04-timeline.md | Timeline + captures | 5 |
| 05-vera-take-fab.md | Vera's Take + Ask Vera FAB | 7 |
| 06-tasks-deadlines.md | Tasks + Deadlines | 4 |
| 07-finances-calculator.md | Finances + Calculator | 3 |
| 08-drafts-strategy.md | Drafts + Strategy notes | 4 |
| 09-rules.md | Rules & Statutes | 2 |
| 10-settings-export.md | Settings + Export | 4 |
| 11-payments.md | Stripe unlock + bundle credits | 6 |
| 12-admin.md | Admin panel | 2 |
