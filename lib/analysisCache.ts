import sql from "@/lib/db";

const ANALYSIS_KEY = "__vera_analysis__";
const ANALYSIS_COUNT_KEY = "__vera_analysis_count__";
const ANALYSIS_CAP = 5;

export async function invalidateAnalysisCache(caseId: string): Promise<void> {
  await sql`DELETE FROM notes WHERE case_id = ${caseId} AND key = ${ANALYSIS_KEY}`;
}

/**
 * Increments the regeneration counter for a case and returns whether a new
 * generation is still permitted. Returns false if the cap has been reached.
 */
export async function canRegenerateAnalysis(caseId: string): Promise<boolean> {
  const [row] = await sql`
    SELECT content FROM notes WHERE case_id = ${caseId} AND key = ${ANALYSIS_COUNT_KEY} LIMIT 1`;
  const current = row ? Number(row.content) : 0;
  if (current >= ANALYSIS_CAP) return false;

  // Increment counter (upsert)
  await sql`
    INSERT INTO notes (case_id, key, content) VALUES (${caseId}, ${ANALYSIS_COUNT_KEY}, ${String(current + 1)})
    ON CONFLICT (case_id, key) DO UPDATE SET content = ${String(current + 1)}, updated_at = now()`;

  return true;
}
