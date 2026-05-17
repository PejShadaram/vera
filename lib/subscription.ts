import sql from "@/lib/db";

export async function isCaseUnlocked(caseId: string, userId: string): Promise<boolean> {
  const rows = await sql`
    SELECT id FROM purchases
    WHERE case_id = ${caseId} AND user_id = ${userId} AND tier = 'case_unlock'
    LIMIT 1`;
  return rows.length > 0;
}
