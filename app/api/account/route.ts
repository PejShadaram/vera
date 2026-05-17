import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import sql from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [caseCountRows, clerk] = await Promise.all([
    sql`SELECT COUNT(*) FROM cases WHERE user_id = ${userId}`,
    clerkClient().then(c => c.users.getUser(userId)),
  ]);

  const email     = clerk.emailAddresses?.[0]?.emailAddress ?? "";
  const caseCount = Number(caseCountRows[0].count);

  return NextResponse.json({ caseCount, email });
}
