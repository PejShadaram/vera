import sql from "@/lib/db";

export async function trackEvent(
  userId: string,
  event: string,
  caseId?: string | null
): Promise<void> {
  try {
    await sql`
      INSERT INTO events (user_id, case_id, event)
      VALUES (${userId}, ${caseId ?? null}, ${event})`;
  } catch { /* non-blocking — never fail a request over analytics */ }
}
