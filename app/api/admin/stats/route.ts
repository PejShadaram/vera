import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import sql from "@/lib/db";
import { isAdminUser } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

// Exclude E2E test accounts, placeholder users, and admin accounts
const adminEmails = (process.env.ADMIN_EMAILS ?? "").split(",").map(e => e.trim()).filter(Boolean);
const REAL_USER = sql`
  email NOT LIKE '%+clerk_test@%'
  AND email NOT LIKE '%@vera-user.local'
  AND email NOT LIKE '%mailinator.com%'
  ${adminEmails.length > 0 ? sql`AND email != ALL(${adminEmails}::text[])` : sql``}
`;

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!await isAdminUser(userId)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const now  = new Date();
  const day7  = new Date(now.getTime() - 7  * 86400000).toISOString();
  const day30 = new Date(now.getTime() - 30 * 86400000).toISOString();

  const [
    totalUsers, newUsers7d, newUsers30d,
    totalCases, newCases7d, newCases30d,
    totalUnlocks, newUnlocks7d, revenue,
    caseTypes, recentUnlocks,
    funnelCases, funnelDocs, funnelWall, funnelCheckout, funnelPaid,
  ] = await Promise.all([
    sql`SELECT COUNT(*) AS n FROM users WHERE ${REAL_USER}`,
    sql`SELECT COUNT(*) AS n FROM users WHERE ${REAL_USER} AND created_at >= ${day7}`,
    sql`SELECT COUNT(*) AS n FROM users WHERE ${REAL_USER} AND created_at >= ${day30}`,
    sql`SELECT COUNT(*) AS n FROM cases c JOIN users u ON u.id = c.user_id WHERE ${REAL_USER}`,
    sql`SELECT COUNT(*) AS n FROM cases c JOIN users u ON u.id = c.user_id WHERE ${REAL_USER} AND c.created_at >= ${day7}`,
    sql`SELECT COUNT(*) AS n FROM cases c JOIN users u ON u.id = c.user_id WHERE ${REAL_USER} AND c.created_at >= ${day30}`,
    sql`SELECT COUNT(*) AS n FROM purchases p JOIN users u ON u.id = p.user_id WHERE p.tier = 'case_unlock' AND ${REAL_USER}`,
    sql`SELECT COUNT(*) AS n FROM purchases p JOIN users u ON u.id = p.user_id WHERE p.tier = 'case_unlock' AND ${REAL_USER} AND p.created_at >= ${day7}`,
    sql`SELECT COALESCE(SUM(p.amount_cents),0) AS total FROM purchases p JOIN users u ON u.id = p.user_id WHERE p.tier = 'case_unlock' AND ${REAL_USER}`,
    sql`SELECT c.case_type, COUNT(*) AS n FROM cases c JOIN users u ON u.id = c.user_id WHERE ${REAL_USER} GROUP BY c.case_type ORDER BY n DESC`,
    sql`SELECT p.created_at, p.amount_cents, c.name AS case_name, u.email
        FROM purchases p
        JOIN cases c ON c.id = p.case_id
        JOIN users u ON u.id = p.user_id
        WHERE p.tier = 'case_unlock' AND ${REAL_USER}
        ORDER BY p.created_at DESC LIMIT 10`,
    // Funnel: distinct real users at each step
    sql`SELECT COUNT(DISTINCT c.user_id) AS n FROM cases c JOIN users u ON u.id = c.user_id WHERE ${REAL_USER}`,
    sql`SELECT COUNT(DISTINCT c.user_id) AS n FROM documents d JOIN cases c ON c.id = d.case_id JOIN users u ON u.id = c.user_id WHERE d.processed = true AND ${REAL_USER}`,
    sql`SELECT COUNT(DISTINCT e.user_id) AS n FROM events e JOIN users u ON u.id = e.user_id WHERE e.event = 'unlock_wall_hit' AND ${REAL_USER}`,
    sql`SELECT COUNT(DISTINCT e.user_id) AS n FROM events e JOIN users u ON u.id = e.user_id WHERE e.event = 'checkout_started' AND ${REAL_USER}`,
    sql`SELECT COUNT(DISTINCT p.user_id) AS n FROM purchases p JOIN users u ON u.id = p.user_id WHERE p.tier = 'case_unlock' AND ${REAL_USER}`,
  ]);

  const signups = Number(totalUsers[0].n);
  const funnel = [
    { label: "Signed up",           n: signups },
    { label: "Created a case",      n: Number(funnelCases[0].n) },
    { label: "Processed a doc",     n: Number(funnelDocs[0].n) },
    { label: "Hit unlock wall",     n: Number(funnelWall[0].n) },
    { label: "Started checkout",    n: Number(funnelCheckout[0].n) },
    { label: "Paid",                n: Number(funnelPaid[0].n) },
  ].map((step, i, arr) => ({
    ...step,
    pctOfTop:  signups > 0 ? Math.round((step.n / signups) * 100) : 0,
    pctOfPrev: i > 0 && arr[i-1].n > 0 ? Math.round((step.n / arr[i-1].n) * 100) : 100,
  }));

  return NextResponse.json({
    users: {
      total:   Number(totalUsers[0].n),
      last7d:  Number(newUsers7d[0].n),
      last30d: Number(newUsers30d[0].n),
    },
    cases: {
      total:   Number(totalCases[0].n),
      last7d:  Number(newCases7d[0].n),
      last30d: Number(newCases30d[0].n),
      byType:  caseTypes,
    },
    revenue: {
      totalUnlocks: Number(totalUnlocks[0].n),
      last7d:       Number(newUnlocks7d[0].n),
      totalCents:   Number(revenue[0].total),
    },
    recentUnlocks,
    funnel,
  });
}
