/**
 * CRON ROUTE — /api/cron/deadlines
 * =============================================================================
 * WHAT IT DOES
 * ------------
 * Runs once daily at 09:00 UTC (see vercel.json: "0 9 * * *").
 * Queries the `deadlines` table for any incomplete deadline whose date falls on
 * today, tomorrow, or exactly 7 days from now. Groups results by user + case,
 * then sends one Resend email per (user, case) pair listing all upcoming items.
 * Emails are skipped for placeholder addresses ending in @vera-user.local.
 *
 * HOW TO MANUALLY TRIGGER (local or production)
 * -----------------------------------------------
 * You need the CRON_SECRET environment variable. Pull it with:
 *   vercel env pull .env.local
 *
 * Then trigger locally (with `vercel dev` or `next dev` running on port 3000):
 *   curl -i -H "Authorization: Bearer $CRON_SECRET" \
 *     http://localhost:3000/api/cron/deadlines
 *
 * To trigger against the production deployment:
 *   curl -i -H "Authorization: Bearer $CRON_SECRET" \
 *     https://vera-opal-zeta.vercel.app/api/cron/deadlines
 *
 * Replace $CRON_SECRET with the actual value if your shell does not have it set.
 *
 * SUCCESSFUL RESPONSE
 * --------------------
 * HTTP 200 with a JSON body:
 *   { "sent": <number of emails dispatched>, "total": <number of deadline rows matched> }
 *
 * Example:
 *   { "sent": 3, "total": 5 }
 *   → 3 emails sent (one per user/case pair), covering 5 individual deadline rows.
 *
 * A response of { "sent": 0, "total": 0 } is valid and means no deadlines fall
 * on today / tomorrow / 7 days out — not an error.
 *
 * UNAUTHORIZED RESPONSE
 * ----------------------
 * Missing or incorrect Authorization header returns HTTP 401:
 *   { "error": "Unauthorized" }
 *
 * VERIFYING DELIVERY IN RESEND DASHBOARD
 * ----------------------------------------
 * 1. Log in at https://resend.com/emails
 * 2. Filter by From: "reminders@vera-opal-zeta.vercel.app" or search by
 *    the recipient address you expect.
 * 3. Each delivered email will show status "Delivered" with a timestamp.
 *    Click into the email to see the rendered HTML and confirm case name /
 *    deadline rows are correct.
 * 4. If status is "Bounced" or "Failed", check that RESEND_API_KEY is valid
 *    and that the sending domain is verified in Resend → Domains.
 * 5. Resend logs are retained for 3 days on the free plan; 30 days on paid.
 * =============================================================================
 */
import { NextResponse } from "next/server";
import { Resend } from "resend";
import sql from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Instantiated per-request to avoid build-time errors when env var is absent

function deadlineEmailHtml(caseId: string, caseName: string, deadlines: Array<{ label: string; date: string; days: number }>) {
  const rows = deadlines.map(d => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #E8E2D9;color:#1C1917;font-size:14px">${d.label}</td>
      <td style="padding:10px 0;border-bottom:1px solid #E8E2D9;color:#78716C;font-size:14px;text-align:right">${d.date}</td>
      <td style="padding:10px 0;border-bottom:1px solid #E8E2D9;text-align:right">
        <span style="font-size:12px;font-weight:700;padding:2px 8px;border-radius:99px;background:${d.days <= 1 ? "#FEE2E2" : "#FDF4E6"};color:${d.days <= 1 ? "#DC2626" : "#C2853A"}">
          ${d.days === 0 ? "TODAY" : d.days === 1 ? "TOMORROW" : `${d.days} days`}
        </span>
      </td>
    </tr>`).join("");

  return `
<!DOCTYPE html><html><body style="margin:0;padding:0;background:#FAF7F2;font-family:system-ui,-apple-system,sans-serif">
<div style="max-width:520px;margin:40px auto;padding:0 20px">
  <p style="font-size:22px;font-weight:700;color:#1C1917;margin:0 0 4px">Vera</p>
  <p style="font-size:13px;color:#A8A29E;margin:0 0 32px">Deadline reminder</p>
  <div style="background:#fff;border:1px solid #E8E2D9;border-radius:16px;padding:24px">
    <p style="font-size:13px;color:#78716C;margin:0 0 4px">Case</p>
    <p style="font-size:16px;font-weight:600;color:#1C1917;margin:0 0 20px">${caseName}</p>
    <table style="width:100%;border-collapse:collapse">${rows}</table>
  </div>
  <p style="font-size:12px;color:#A8A29E;margin:24px 0 0;text-align:center">
    Vera — not legal advice. <a href="https://veracase.app/cases/${caseId}" style="color:#C2853A">Open your case →</a>
  </p>
</div>
</body></html>`;
}

export async function GET(req: Request) {
  // Verify cron secret so this can't be triggered externally
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const in1   = new Date(today); in1.setDate(in1.getDate() + 1);
  const in7   = new Date(today); in7.setDate(in7.getDate() + 7);
  const fmt   = (d: Date) => d.toISOString().slice(0, 10);

  // Fetch upcoming deadlines due today, tomorrow, or in 7 days
  const rows = await sql`
    SELECT
      d.id, d.label, d.date, d.case_id,
      c.name  AS case_name,
      c.user_id,
      u.email
    FROM deadlines d
    JOIN cases     c ON c.id = d.case_id
    JOIN users     u ON u.id = c.user_id
    WHERE d.completed = false
      AND d.date IN (${fmt(today)}, ${fmt(in1)}, ${fmt(in7)})
      AND u.email NOT LIKE '%@vera-user.local'
    ORDER BY u.email, c.id, d.date`;

  // Group by user + case
  const grouped = new Map<string, { email: string; caseName: string; caseId: string; items: Array<{ label: string; date: string; days: number }> }>();
  for (const r of rows) {
    const key = `${r.email}|${r.case_id}`;
    const dueDate = new Date(r.date as string); dueDate.setHours(0,0,0,0);
    const days = Math.round((dueDate.getTime() - today.getTime()) / 86400000);
    if (!grouped.has(key)) grouped.set(key, { email: r.email as string, caseName: r.case_name as string, caseId: r.case_id as string, items: [] });
    grouped.get(key)!.items.push({ label: r.label as string, date: r.date as string, days });
  }

  const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
  let sent = 0;
  for (const { email, caseId: cId, caseName, items } of grouped.values()) {
    if (!resend) continue;
    try {
      await resend.emails.send({
        from:    "Vera <support@veracase.app>",
        to:      email,
        subject: `Deadline reminder — ${items[0].days <= 1 ? "urgent" : "upcoming"}: ${caseName}`,
        html:    deadlineEmailHtml(cId, caseName, items),
      });
      sent++;
    } catch (err) {
      console.error("[cron/deadlines] email failed for", email, err);
    }
  }

  return NextResponse.json({ sent, total: rows.length });
}
