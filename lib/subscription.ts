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

// Auto-apply a bundle credit (case_id IS NULL purchase) to unlock this case.
// Returns true if a credit was successfully applied, false if already unlocked or no credits.
export async function autoApplyBundleCredit(caseId: string, userId: string): Promise<boolean> {
  const already = await isCaseUnlocked(caseId, userId);
  if (already) return false;

  // Atomically claim one bundle credit by associating it with this case
  const result = await sql`
    UPDATE purchases
    SET case_id = ${caseId}
    WHERE id = (
      SELECT id FROM purchases
      WHERE user_id = ${userId} AND tier = 'case_unlock' AND case_id IS NULL
      LIMIT 1
    )
    RETURNING id`;
  return result.length > 0;
}
