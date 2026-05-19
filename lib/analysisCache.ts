import sql from "@/lib/db";

const ANALYSIS_KEY = "__vera_analysis__";
const ANALYSIS_COUNT_KEY = "__vera_analysis_count__";
const ANALYSIS_CAP = 5;

export async function invalidateAnalysisCache(caseId: string): Promise<void> {
  const [capRow] = await sql`SELECT content FROM notes WHERE case_id = ${caseId} AND key = ${ANALYSIS_COUNT_KEY} LIMIT 1`;
  if (!capRow || Number(capRow.content) < ANALYSIS_CAP) {
    await sql`DELETE FROM notes WHERE case_id = ${caseId} AND key = ${ANALYSIS_KEY}`;
  }
}
