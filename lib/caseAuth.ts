import { auth } from "@clerk/nextjs/server";
import sql from "@/lib/db";

export async function verifyCase(caseId: string) {
  const { userId } = await auth();
  if (!userId) return null;
  const [c] = await sql`SELECT id FROM cases WHERE id = ${caseId} AND user_id = ${userId}`;
  return c ? userId : null;
}
