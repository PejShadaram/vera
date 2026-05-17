import { auth } from "@clerk/nextjs/server";
import sql from "@/lib/db";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function verifyCase(caseId: string) {
  const { userId } = await auth();
  if (!userId) return null;
  if (!UUID_RE.test(caseId)) return null;
  const [c] = await sql`SELECT id FROM cases WHERE id = ${caseId} AND user_id = ${userId}`;
  return c ? userId : null;
}
