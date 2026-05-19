/**
 * CRON ROUTE — /api/cron/process-reminder
 * =============================================================================
 * Runs once daily at 10:00 UTC (see vercel.json: "0 10 * * *").
 * Finds users who signed up 20–28 hours ago with 0 processed documents and
 * sends them a reminder to upload and process their first document.
 * Skips placeholder/test addresses.
 *
 * HOW TO MANUALLY TRIGGER
 * -----------------------
 *   curl -i -H "Authorization: Bearer $CRON_SECRET" \
 *     http://localhost:3000/api/cron/process-reminder
 * =============================================================================
 */
import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { sendEmail, buildProcessReminderEmail } from "@/lib/email";

/** Mirrors @vercel/functions isVercelCronRequest — not yet exported by the installed version. */
function isVercelCronRequest(req: Request): boolean {
  // Vercel sets this header on cron-invoked requests; external callers cannot spoof it.
  if (req.headers.get("x-vercel-cron") === "1") return true;
  // Fallback: allow manual trigger with CRON_SECRET (local dev / curl testing)
  const secret = process.env.CRON_SECRET;
  return !!secret && req.headers.get("authorization") === `Bearer ${secret}`;
}

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  if (!isVercelCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Find users whose first case was created 20–28 hours ago and have 0
  // processed documents across all their cases.
  const candidates = await sql`
    SELECT
      u.id        AS user_id,
      u.email,
      MIN(c.created_at) AS first_case_at
    FROM users u
    JOIN cases c ON c.user_id = u.id
    WHERE u.email NOT LIKE '%@vera-user.local'
      AND u.email NOT LIKE '%+clerk_test@%'
    GROUP BY u.id, u.email
    HAVING
      MIN(c.created_at) >= now() - INTERVAL '28 hours'
      AND MIN(c.created_at) <= now() - INTERVAL '20 hours'
      AND (
        SELECT COUNT(*)
        FROM documents d
        JOIN cases c2 ON c2.id = d.case_id
        WHERE c2.user_id = u.id
          AND d.processed = true
      ) = 0
  `;

  let sent = 0;
  for (const row of candidates) {
    await sendEmail(
      row.email as string,
      "Your documents are waiting — Vera is ready to read them",
      buildProcessReminderEmail()
    );
    sent++;
  }

  return NextResponse.json({ sent, total: candidates.length });
}
