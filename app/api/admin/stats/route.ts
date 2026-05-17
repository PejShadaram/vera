import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import sql from "@/lib/db";
import { isAdminUser } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

// Exclude E2E test accounts and placeholder users created by ensureUser()
const REAL_USER = sql`
  email NOT LIKE '%+clerk_test@%'
  AND email NOT LIKE '%@vera-user.local'
  AND email NOT LIKE '%mailinator.com%'
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
  ]);

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
  });
}
