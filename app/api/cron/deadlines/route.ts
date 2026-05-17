import { NextResponse } from "next/server";
import { Resend } from "resend";
import sql from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const resend = new Resend(process.env.RESEND_API_KEY);

function deadlineEmailHtml(caseName: string, deadlines: Array<{ label: string; date: string; days: number }>) {
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
    Vera — not legal advice. <a href="https://vera-opal-zeta.vercel.app/dashboard" style="color:#C2853A">Open your case →</a>
  </p>
</div>
</body></html>`;
}

export async function GET(req: Request) {
  // Verify cron secret so this can't be triggered externally
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
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

  let sent = 0;
  for (const { email, caseName, items } of grouped.values()) {
    await resend.emails.send({
      from:    "Vera <reminders@vera-opal-zeta.vercel.app>",
      to:      email,
      subject: `Deadline reminder — ${items[0].days <= 1 ? "urgent" : "upcoming"}: ${caseName}`,
      html:    deadlineEmailHtml(caseName, items),
    });
    sent++;
  }

  return NextResponse.json({ sent, total: rows.length });
}
