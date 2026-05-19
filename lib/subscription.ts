import sql from "@/lib/db";

export async function isCaseUnlocked(caseId: string, userId: string): Promise<boolean> {
  const [u] = await sql`SELECT is_admin FROM users WHERE id = ${userId} LIMIT 1`;
  if (u?.is_admin) return true;
  // Direct case unlock
  const [direct] = await sql`
    SELECT id FROM purchases
    WHERE case_id = ${caseId} AND user_id = ${userId} AND tier = 'case_unlock'
    LIMIT 1`;
  return !!direct;
}
