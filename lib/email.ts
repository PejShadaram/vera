import { Resend } from "resend";

const FROM = "Vera <support@veracase.app>";

/** Skip test / placeholder accounts */
function isTestEmail(email: string): boolean {
  return email.endsWith("@vera-user.local") || email.includes("+clerk_test@");
}

export async function sendEmail(
  to: string,
  subject: string,
  html: string
): Promise<void> {
  if (isTestEmail(to)) return;
  if (!process.env.RESEND_API_KEY) return;
  const resend = new Resend(process.env.RESEND_API_KEY);
  try {
    await resend.emails.send({ from: FROM, to, subject, html });
  } catch (err) {
    // Non-blocking — log but never throw
    console.error("[email] send failed:", err);
  }
}

// ── Shared layout wrapper ─────────────────────────────────────────────────
function layout(inner: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#FAF7F2;font-family:system-ui,-apple-system,Segoe UI,sans-serif">
<div style="max-width:520px;margin:48px auto;padding:0 24px">

  <!-- Wordmark -->
  <div style="margin-bottom:32px">
    <span style="display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:50%;background:#C2853A;color:#fff;font-weight:700;font-size:18px;font-family:Georgia,serif;vertical-align:middle">V</span>
    <span style="margin-left:10px;font-size:18px;font-weight:700;color:#1C1917;vertical-align:middle">Vera</span>
  </div>

  <!-- Card -->
  <div style="background:#fff;border:1px solid #E8E2D9;border-radius:16px;padding:32px">
    ${inner}
  </div>

  <!-- Footer -->
  <p style="font-size:12px;color:#A8A29E;margin:24px 0 0;text-align:center;line-height:1.6">
    Vera &middot; <a href="https://veracase.app" style="color:#A8A29E;text-decoration:none">veracase.app</a>
    &middot; Not legal advice
    &middot; <a href="https://veracase.app/unsubscribe" style="color:#A8A29E;text-decoration:none">Unsubscribe</a>
  </p>

</div>
</body>
</html>`;
}

function ctaButton(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;margin-top:24px;padding:14px 28px;background:#C2853A;color:#fff;text-decoration:none;border-radius:10px;font-weight:600;font-size:15px">${label}</a>`;
}

// ── Email 1: Welcome ──────────────────────────────────────────────────────
export function buildWelcomeEmail(caseId: string): string {
  const caseUrl = `https://veracase.app/cases/${caseId}`;
  return layout(`
    <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#1C1917">Your case is ready.</h1>
    <p style="margin:0 0 28px;font-size:15px;color:#78716C;line-height:1.6">You've taken the first step. Here's how to get the most out of Vera:</p>

    <ol style="margin:0;padding:0 0 0 20px;list-style:none;counter-reset:steps">
      ${[
        ["Upload your documents", "PDFs, photos, emails, audio — anything you have."],
        ["Hit &ldquo;Process with AI&rdquo;", "Vera reads everything and builds your timeline and evidence log. First 3 documents are free."],
        ["Unlock the full picture", "For $49, Vera gives you a complete case analysis, lets you ask questions, and generates legal drafts."],
      ].map(([title, body], i) => `
        <li style="display:flex;gap:16px;margin-bottom:20px">
          <span style="flex-shrink:0;display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:50%;background:#FDF4E6;color:#C2853A;font-weight:700;font-size:13px">${i + 1}</span>
          <div>
            <p style="margin:0 0 2px;font-size:15px;font-weight:600;color:#1C1917">${title}</p>
            <p style="margin:0;font-size:14px;color:#78716C;line-height:1.5">${body}</p>
          </div>
        </li>`).join("")}
    </ol>

    ${ctaButton(caseUrl, "Go to my case →")}
  `);
}

// ── Email 2: Process reminder ─────────────────────────────────────────────
export function buildProcessReminderEmail(): string {
  return layout(`
    <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#1C1917">Your documents are waiting.</h1>

    <p style="margin:0 0 14px;font-size:15px;color:#78716C;line-height:1.6">You set up your case but haven't uploaded documents yet.</p>

    <p style="margin:0 0 14px;font-size:15px;color:#78716C;line-height:1.6">Vera gets smarter with every file you add — court papers, emails, photos, voice memos.</p>

    <p style="margin:0 0 14px;font-size:15px;color:#78716C;line-height:1.6">Upload your first document and hit <strong style="color:#1C1917">Process</strong>. Vera extracts your timeline and evidence automatically. <strong style="color:#1C1917">First 3 are free.</strong></p>

    ${ctaButton("https://veracase.app/dashboard", "Upload documents →")}

    <p style="margin:28px 0 0;font-size:13px;color:#A8A29E;line-height:1.6">The sooner you build your case file, the better prepared you'll be.</p>
  `);
}

// ── Email 3: Unlock confirmation ─────────────────────────────────────────
export function buildUnlockConfirmationEmail(caseId: string, caseName: string): string {
  const caseUrl = `https://veracase.app/cases/${caseId}`;
  return layout(`
    <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#1C1917">You're unlocked.</h1>
    <p style="margin:0 0 24px;font-size:15px;color:#78716C;line-height:1.6">Payment confirmed for <strong style="color:#1C1917">${caseName}</strong>. Here's everything you now have access to:</p>

    <div style="space-y:12px">
      ${[
        ["Vera's Take — full analysis", "The complete picture: what Vera sees, what's missing, and your single most important next action."],
        ["Unlimited document processing", "Upload and process as many documents as you have. No limits."],
        ["Ask Vera", "Ask anything about your case — timeline gaps, what to prepare, strategy questions."],
        ["AI draft generation", "Generate demand letters, declarations, and other legal documents tailored to your case."],
      ].map(([title, body]) => `
        <div style="display:flex;gap:12px;margin-bottom:16px;align-items:flex-start">
          <span style="flex-shrink:0;margin-top:2px;display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:50%;background:#C2853A;color:#fff;font-size:11px;font-weight:700">✓</span>
          <div>
            <p style="margin:0 0 2px;font-size:15px;font-weight:600;color:#1C1917">${title}</p>
            <p style="margin:0;font-size:14px;color:#78716C;line-height:1.5">${body}</p>
          </div>
        </div>`).join("")}
    </div>

    ${ctaButton(caseUrl, "Open my case →")}

    <p style="margin:24px 0 0;font-size:13px;color:#A8A29E;line-height:1.6">One-time payment. No subscription. This case is yours forever.</p>
  `);
}

// ── Email 4: Unlock nudge ─────────────────────────────────────────────────
export function buildUnlockNudgeEmail(caseId: string): string {
  const unlockUrl = `https://veracase.app/cases/${caseId}`;
  return layout(`
    <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#1C1917">Vera found something in your case.</h1>

    <p style="margin:0 0 14px;font-size:15px;color:#78716C;line-height:1.6">You've processed 3 documents and Vera has been reading your case.</p>

    <div style="margin:20px 0;padding:20px;background:#FDF4E6;border-left:4px solid #C2853A;border-radius:8px">
      <p style="margin:0 0 6px;font-size:13px;font-weight:700;color:#C2853A;letter-spacing:.05em;text-transform:uppercase">Vera&rsquo;s Take</p>
      <p style="margin:0;font-size:14px;color:#1C1917;line-height:1.6">The full analysis of what Vera sees, what&rsquo;s missing, and your most urgent next action — is ready and waiting.</p>
    </div>

    <p style="margin:0 0 6px;font-size:15px;font-weight:600;color:#1C1917">Unlock AI on this case for $49</p>
    <p style="margin:0;font-size:14px;color:#78716C;line-height:1.6">One time. No subscription. Yours forever.</p>

    ${ctaButton(unlockUrl, "Unlock and read Vera’s analysis →")}

    <p style="margin:24px 0 0;font-size:13px;color:#A8A29E;line-height:1.6">Also included: unlimited document processing, Ask Vera chat, and AI draft generation.</p>
  `);
}

// ── Email 5: Bundle confirmation ──────────────────────────────────────────
export function buildBundleConfirmationEmail(qty: number): string {
  return layout(`
    <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#1C1917">${qty} AI unlocks ready to use.</h1>
    <p style="margin:0 0 24px;font-size:15px;color:#78716C;line-height:1.6">
      Your bundle purchase is confirmed. You have <strong style="color:#1C1917">${qty} AI case unlock credits</strong> — use them on any cases, now or later.
    </p>
    <p style="margin:0 0 24px;font-size:15px;color:#78716C;line-height:1.6">
      To use a credit: open any case and click <strong style="color:#1C1917">&ldquo;Unlock AI&rdquo;</strong>. The credit applies automatically — no additional payment needed.
    </p>
    <p style="margin:0 0 24px;font-size:14px;color:#78716C;line-height:1.6">
      Each unlock includes AI document processing, Vera&rsquo;s Take analysis, Ask Vera chat, court form guides, and AI draft generation — for the life of that case.
    </p>
    ${ctaButton("https://veracase.app/dashboard", "Go to my cases →")}
    <p style="margin:24px 0 0;font-size:13px;color:#A8A29E;line-height:1.6">One-time purchase. No subscription. Credits never expire.</p>
  `);
}
