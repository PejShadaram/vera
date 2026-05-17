# Vera — User Acquisition Playbook

## One-Liner Pitch

> "I built this after going through my own divorce without an attorney. $49 unlocks AI that reads your documents — no subscription."

---

## Target Communities

| Priority | Community | Platform | Members | Why |
|----------|-----------|----------|---------|-----|
| 1 | r/legaladvice | Reddit | 2.1M | High-intent; users actively seeking help, frequently mention going pro se |
| 2 | r/Divorce | Reddit | 320K | Emotionally engaged; strong overlap with first-time self-reps |
| 3 | r/ProSe | Reddit | 22K | Core audience; already self-representing, actively looking for tools |
| 4 | r/TenantRights | Reddit | 160K | Second-largest case type after divorce; landlord disputes are common pro se territory |
| 5 | Facebook Groups: "Pro Se Legal Help" / "Self-Help Legal Resources" | Facebook | ~85K combined | Older demographic, less Reddit-savvy, high engagement on personal stories |

---

## Founder Post Template

Use this when posting in communities that allow founder/tool introductions. Do not use in r/legaladvice — that community prohibits self-promotion. Post as a regular member sharing a resource in appropriate weekly threads or subreddits that allow it (r/ProSe, r/Divorce, r/TenantRights).

---

**Title:** I went through my divorce without a lawyer. I built a tool to help others do the same.

**Body:**

Two years ago I went through a divorce without an attorney. Not because I wanted to — because I couldn't afford one.

I spent hundreds of hours organizing texts, emails, court filings, and financial records into a binder I could understand. I missed things that mattered. I made mistakes I couldn't undo.

After it was over, I kept thinking: there should be a better way to do this.

So I built it.

It's called Vera. It's a case management tool specifically for people representing themselves in court — not a law firm, not legal advice, just organization and AI-powered clarity.

You upload your documents — texts, PDFs, emails, voicemails — and Vera reads them, builds a timeline, flags evidence, and lets you ask questions in plain English. One-time $49 to unlock the AI. No subscription, no monthly fee. Your case file is yours.

I've been using it on my own post-divorce matters. It would have saved me months of confusion when I was starting out.

If you're going through something similar and want to try it: [vera.legal]

Happy to answer any questions about how it works.

---

*Note: Vera is not a law firm and does not provide legal advice. It is an organizational and AI-analysis tool.*

---

## Launch Sequence

### Week 1 — Soft Launch (Warm Audiences)

**Post 1: r/ProSe**
- Why first: Smallest but highest-intent community. These users are already self-representing. Early feedback will be actionable. Low risk of backlash.
- What to post: Founder story post (template above).
- What to watch: Upvote ratio, comments asking how it works, DMs from users wanting access.

**Post 2: r/Divorce**
- Why second: High volume, emotionally resonant. Users in early stages of divorce are exactly the right moment of need.
- What to post: Variant of founder post, open with the divorce-specific angle.
- What to watch: How many users click through to sign up vs. ask clarifying questions. Watch for friction signals ("does it work for [specific situation]?").

### Week 2 — Broader Reach

**Post 3: r/TenantRights**
- Why third: Validates that Vera works across case types, not just divorce. Opens a second acquisition channel.
- What to post: Reframe the story around landlord dispute instead of divorce. Same emotional arc — overwhelmed tenant, mountains of documents, no attorney.
- What to watch: Whether tenant users activate differently than divorce users (case type breakdown in analytics).

**Post 4: Facebook Groups**
- Why fourth: Different demographic. Validates whether the product resonates outside Reddit's younger user base.
- What to post: Shorter, warmer version of the founder story. Facebook audiences respond to personal narrative, less to product specs.
- What to watch: Shares, comments from people tagging friends in similar situations.

### Ongoing

- Respond to every comment in r/legaladvice threads where users say "I can't afford a lawyer" or "I'm representing myself" — provide genuine help first, mention Vera only if directly relevant and the community rules allow it.
- Set up a Google Alert for "pro se" + "overwhelmed" to find real-time conversations across the web.

---

## Metrics to Measure After Each Post

For each community post, track the following over a 72-hour window:

| Metric | What It Tells You |
|--------|-------------------|
| Pageviews (Vercel Analytics) | Raw traffic driven by the post |
| Sign-up rate (pageviews → accounts created) | Whether the landing page converts the audience |
| `case_created` events (Vercel Analytics) | Whether signed-up users are completing onboarding |
| `unlock_clicked` events (Vercel Analytics) | Whether users are reaching the paywall and engaging with it |
| Payment conversions (Stripe dashboard) | Actual revenue per channel |
| Comments/DMs asking clarifying questions | Which objections or confusions are most common — use to improve copy |

### Target Benchmarks (First 30 Days)

- 500 unique visitors from organic community posts
- 15% sign-up rate (75 accounts)
- 60% case creation rate among signed-up users (45 cases)
- 20% unlock rate among case creators (9 paid unlocks = $441 revenue)

These are conservative. The goal in month 1 is signal, not scale: confirm that the community → sign-up → case created → paid conversion funnel works, then optimize each step.

---

## What Not to Do

- Do not spam multiple subreddits with the same post on the same day. Reddit users cross-post shame and moderators ban repeat promotional posts.
- Do not lead with the price or the product. Lead with the story. The product is the solution to the story, not the headline.
- Do not post in r/legaladvice as a product pitch. Engage there genuinely. Goodwill in that community is worth more than any ad spend.
