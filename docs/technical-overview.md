# Vera — Technical Overview

**Last updated:** May 2026  
**Product:** veracase.app  
**Audience:** Internal reference · Investors · Technical due diligence

---

## 1. Tech Stack

### Frontend
| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript |
| Styling | Tailwind CSS with CSS custom properties |
| Deployment | Vercel (serverless, edge-aware) |

### Backend
| Layer | Technology |
|---|---|
| API | Next.js Route Handlers (serverless functions) |
| Database | Neon PostgreSQL (serverless, branching) |
| File storage | Vercel Blob (private, signed URLs) |
| Authentication | Clerk (Google OAuth + email/password) |
| Email | Resend |
| Payments | Stripe (live mode) |
| Error monitoring | Sentry (configured, opt-in via env var) |

### AI / ML
| Capability | Provider & Model |
|---|---|
| Document extraction & timeline/evidence parsing | Anthropic Claude Sonnet 4.6 |
| Case analysis (Vera's Take) | Anthropic Claude Opus 4.7 |
| Ask Vera chat | Anthropic Claude Sonnet 4.6 |
| Legal draft generation | Anthropic Claude Opus 4.7 |
| Audio & video transcription | OpenAI Whisper |

### Infrastructure
- **Hosting:** Vercel (Washington D.C. — `iad1` region)
- **Database:** Neon (`us-east-1`), production and dev branches isolated
- **CI/CD:** GitHub Actions (typecheck on every push), Vercel preview deployments
- **Branch strategy:** `main` is protected; all work merges via PR from `dev`

---

## 2. Privacy & Security

### Authentication
- All authentication is handled by **Clerk**, a SOC 2 Type II certified provider
- Vera never stores passwords — login is via Google OAuth or Clerk-managed email
- Sessions are short-lived JWTs verified server-side on every API request
- User IDs are Clerk-issued, immutable, and used as the primary foreign key throughout

### Data storage
- **Documents** are stored in Vercel Blob under private access — files are never publicly accessible. All retrieval requires a signed Bearer token
- **Database** uses Neon PostgreSQL with SSL (`sslmode=require`) enforced on all connections
- Each case is tied to a `user_id`; every API route verifies ownership before returning data (`verifyCase()` middleware)
- No case data is shared between users under any circumstances

### AI processing
- Document content is sent to Anthropic's API for processing. Anthropic's API does not use customer data for model training (under standard API terms)
- Audio and video are sent to OpenAI Whisper for transcription under the same no-training-use terms
- No document content is logged, cached externally, or retained beyond the immediate API response

### Email
- Sent via Resend from `support@veracase.app`
- Test and placeholder accounts (`@vera-user.local`, `+clerk_test@`) are automatically skipped — no real email is ever sent to synthetic users
- An unsubscribe link is included in all marketing and reminder emails

### Admin access
- The admin dashboard (`/admin`) is restricted to a hardcoded allowlist of email addresses checked server-side via Clerk
- No admin capability is exposed client-side

### What Vera does not do
- Does not sell or share user data with third parties
- Does not use case content for advertising or profiling
- Does not store payment card data (Stripe handles all PCI scope)

---

## 3. Payment Model

### Structure
Vera uses a **one-time per-case unlock** model. There is no subscription.

| Tier | Price | What's included |
|---|---|---|
| Free | $0 | Create a case, upload documents, process up to 3 documents with AI, partial Vera's Take (summary only) |
| Unlocked | $49 one-time per case | Unlimited document processing, full Vera's Take (analysis, observations, gaps, next action), Ask Vera chat, AI draft generation |

### Key design decisions
- **Per-case, not per-account.** A user with three active cases pays $49 per case they want to unlock. This aligns price with value — a custody case and a divorce case are independent matters.
- **Permanent.** Once a case is unlocked, it stays unlocked. There is no expiry, no renewal, and no subscription to cancel.
- **Free hook is real.** The first 3 document processes run on real AI (Sonnet). The partial Vera's Take shows a genuine summary of the case. Users see actual value before paying.

### Payment infrastructure
- Stripe live mode, Checkout Sessions (`mode: "payment"`)
- On successful payment, Stripe webhook (`checkout.session.completed`) inserts a `purchases` row (`tier = 'case_unlock'`, `case_id`)
- The `isCaseUnlocked(caseId, userId)` function is the single source of truth — it queries the purchases table and is called on every gated route

---

## 4. AI Usage & Limits

### Why limits exist
Vera uses large language models billed per token. Without controls, a single heavy user could generate API costs that exceed their $49 payment. The limits below ensure unit economics are sound at scale.

### Document processing limits

| Limit | Value | Reason |
|---|---|---|
| Free document processes per case | 3 | Freemium hook — enough to demonstrate value |
| Max PDF pages per document | 150 | A 1,000-page PDF costs ~$9 in Opus tokens alone; 150 pages covers virtually all legal documents |
| Model used | Claude Sonnet 4.6 | 5× cheaper than Opus; extraction quality is equivalent for timeline/evidence parsing |

Documents over 150 pages are truncated to the first 150 pages with a visible progress message. The user is informed.

### Vera's Take (case analysis) limits

| Limit | Value | Reason |
|---|---|---|
| Lifetime Opus generations per case | 5 | Caps worst-case cost at ~$1/case while covering all realistic usage |
| Model used | Claude Opus 4.7 | Premium model reserved for this single high-value call |
| Cache TTL | 24 hours (bypassed at cap) | Avoids redundant calls on page reload |
| Refresh trigger | Any write to timeline, evidence, deadlines, captures, or finances | Keeps analysis current without manual refresh |

Once a case hits 5 Opus generations, the most recent analysis is served permanently — it does not go stale, it simply freezes. The user always has a complete analysis; it just stops auto-updating.

### Ask Vera (chat) limits

| Limit | Value |
|---|---|
| Model | Claude Sonnet 4.6 |
| Context | Full case file (timeline, evidence, documents, finances, deadlines) sent on every message |
| Rate limiting | None currently — monitored for abuse |

### Draft generation

| Limit | Value |
|---|---|
| Model | Claude Opus 4.7 |
| Scope | One draft per request; user-editable after generation |
| Gating | Requires unlocked case |

### Cost model (approximate, per unlocked case)
| Operation | Estimated cost |
|---|---|
| 3 free Sonnet document processes | ~$0.10–0.30 |
| Up to 5 Opus case analyses | ~$0.50–1.00 |
| Ask Vera chat (moderate use) | ~$0.20–0.50 |
| Draft generation (1–2 drafts) | ~$0.20–0.40 |
| **Total worst-case per case** | **~$2.20** |
| **Revenue per case** | **$49.00** |
| **Gross margin** | **~95%** |

---

## 5. Database Schema (summary)

| Table | Purpose |
|---|---|
| `users` | Clerk user ID + email |
| `cases` | Case metadata (type, name, opposing party, jurisdiction) |
| `documents` | Uploaded file references (blob URL, processed flag) |
| `timeline_entries` | Extracted and manual timeline events |
| `evidence` | Evidence log with source type and summary |
| `tasks` | Kanban tasks (todo / in-progress / done) |
| `deadlines` | Upcoming legal deadlines with completion tracking |
| `financial_items` | Asset / debt / income / expense line items |
| `captures` | FloatingCapture log entries |
| `notes` | Key-value store — used for Vera's Take cache and generation counter |
| `purchases` | Stripe payment records (case_id, user_id, tier) |
| `events` | Funnel tracking (unlock_wall_hit, checkout_started, etc.) |

---

*Vera is not a law firm and does not provide legal advice. It is a case organization and AI analysis tool for self-represented individuals.*
