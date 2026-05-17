import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import sql from "@/lib/db";

export const dynamic = "force-dynamic";

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "pshadaram@gmail.com").split(",").map(e => e.trim());

export async function GET() {
  const { userId, sessionClaims } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const email = sessionClaims?.email as string | undefined;
  if (!email || !ADMIN_EMAILS.includes(email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const now = new Date();
  const day7  = new Date(now.getTime() - 7  * 86400000).toISOString();
  const day30 = new Date(now.getTime() - 30 * 86400000).toISOString();

  const [
    totalUsers, newUsers7d, newUsers30d,
    totalCases, newCases7d, newCases30d,
    totalUnlocks, newUnlocks7d, revenue,
    caseTypes, recentUnlocks,
  ] = await Promise.all([
    sql`SELECT COUNT(*) AS n FROM users`,
    sql`SELECT COUNT(*) AS n FROM users WHERE created_at >= ${day7}`,
    sql`SELECT COUNT(*) AS n FROM users WHERE created_at >= ${day30}`,
    sql`SELECT COUNT(*) AS n FROM cases`,
    sql`SELECT COUNT(*) AS n FROM cases WHERE created_at >= ${day7}`,
    sql`SELECT COUNT(*) AS n FROM cases WHERE created_at >= ${day30}`,
    sql`SELECT COUNT(*) AS n FROM purchases WHERE tier = 'case_unlock'`,
    sql`SELECT COUNT(*) AS n FROM purchases WHERE tier = 'case_unlock' AND created_at >= ${day7}`,
    sql`SELECT COALESCE(SUM(amount_cents),0) AS total FROM purchases WHERE tier = 'case_unlock'`,
    sql`SELECT case_type, COUNT(*) AS n FROM cases GROUP BY case_type ORDER BY n DESC`,
    sql`SELECT p.created_at, p.amount_cents, c.name AS case_name, u.email
        FROM purchases p
        JOIN cases c ON c.id = p.case_id
        JOIN users u ON u.id = p.user_id
        WHERE p.tier = 'case_unlock'
        ORDER BY p.created_at DESC LIMIT 10`,
  ]);

  return NextResponse.json({
    users: {
      total: Number(totalUsers[0].n),
      last7d: Number(newUsers7d[0].n),
      last30d: Number(newUsers30d[0].n),
    },
    cases: {
      total: Number(totalCases[0].n),
      last7d: Number(newCases7d[0].n),
      last30d: Number(newCases30d[0].n),
      byType: caseTypes,
    },
    revenue: {
      totalUnlocks: Number(totalUnlocks[0].n),
      last7d: Number(newUnlocks7d[0].n),
      totalCents: Number(revenue[0].total),
    },
    recentUnlocks,
  });
}
