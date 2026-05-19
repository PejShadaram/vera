import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import sql from "@/lib/db";
import { verifyCase } from "@/lib/caseAuth";
import { isCaseUnlocked } from "@/lib/subscription";

export const dynamic  = "force-dynamic";
export const maxDuration = 300;

const CACHE_KEY    = "__vera_forms__";
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export async function GET(
  req: Request,
  { params }: { params: Promise<{ caseId: string }> }
) {
  const { caseId } = await params;
  const forceRefresh = new URL(req.url).searchParams.has("refresh");
  const userId = await verifyCase(caseId);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!await isCaseUnlocked(caseId, userId))
    return NextResponse.json({ error: "unlock_required" }, { status: 403 });

  if (!forceRefresh) {
    try {
      const cached = await sql`SELECT content, updated_at FROM notes WHERE case_id = ${caseId} AND key = ${CACHE_KEY} LIMIT 1`;
      if (cached.length > 0) {
        const age = Date.now() - new Date(cached[0].updated_at as string).getTime();
        if (age < CACHE_TTL_MS) return NextResponse.json(JSON.parse(cached[0].content as string));
      }
    } catch (e) {
      console.error("[forms] cache read error:", e);
    }
  }

  const [[caseRow], timeline, evidence, finances] = await Promise.all([
    sql`SELECT * FROM cases WHERE id = ${caseId}`,
    sql`SELECT date, event FROM timeline_entries WHERE case_id = ${caseId} ORDER BY date LIMIT 20`,
    sql`SELECT ref, title, source_type FROM evidence WHERE case_id = ${caseId}`,
    sql`SELECT category, SUM(amount) AS total FROM financial_items WHERE case_id = ${caseId} GROUP BY category`,
  ]);
  if (!caseRow) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const jurisdiction = String(caseRow.jurisdiction || "").trim() || "not specified";
  const caseType     = String(caseRow.case_type || "other").replace("_", " ");
  const opposing     = String(caseRow.opposing_party || "").trim() || "opposing party";
  const courtName    = String(caseRow.court_name || "").trim() || "not specified";
  const caseNumber   = String(caseRow.case_number || "").trim() || "not assigned";
  const hearingDate  = caseRow.hearing_date
    ? (caseRow.hearing_date instanceof Date ? caseRow.hearing_date.toISOString().slice(0, 10) : String(caseRow.hearing_date).slice(0, 10))
    : "not set";
  const finSummary   = (finances as Array<Record<string, unknown>>)
    .map(f => `${f.category}: $${Number(f.total).toLocaleString()}`).join(", ") || "none";

  const prompt = `You are a legal forms expert helping a self-represented litigant in ${jurisdiction}.

CASE:
- Case name: ${caseRow.name}
- Case type: ${caseType}
- Petitioner / Plaintiff full legal name: ${String(caseRow.petitioner_name || "").trim() || "[NEEDED: petitioner's full legal name]"}
- Respondent / Defendant (opposing party): ${opposing}
- State / Jurisdiction: ${jurisdiction}
- Court: ${courtName}
- Case / Cause number: ${caseNumber}
- Hearing date: ${hearingDate}
- Timeline events on file: ${timeline.length}
- Evidence items: ${evidence.length}
- Financial summary: ${finSummary}

List the most important court forms for a ${caseType} case in ${jurisdiction}, in filing order. Limit to 8 forms maximum.

For each form:
- Use the actual state-specific form name and number (e.g. "FL-100 Petition for Dissolution of Marriage")
- Include only the 8 most critical fields per form — skip obvious/boilerplate fields
- Pre-fill fields you can from the case data above
- Use "[NEEDED: ...]" for missing required fields only

Respond ONLY with valid JSON — no markdown, no explanation:
{
  "jurisdiction_note": "One sentence about ${jurisdiction}-specific requirements",
  "filing_sequence": "Plain-English summary of the order to file these forms",
  "forms": [
    {
      "name": "Full form name",
      "number": "Form number or null",
      "when_to_file": "At what stage",
      "purpose": "One sentence",
      "fields": [
        { "label": "Field label", "value": "Pre-filled value or [NEEDED: what]", "instruction": "Brief note or null" }
      ]
    }
  ],
  "important_notes": ["Critical warnings or deadlines only — max 5"]
}`;

  let raw: string;
  try {
    const anthropic = new Anthropic();
    const msg = await anthropic.messages.create({
      model:      "claude-sonnet-4-6",
      max_tokens: 8000,
      messages:   [{ role: "user", content: prompt }],
    });
    raw = (msg.content[0] as { text: string }).text ?? "{}";
  } catch (e) {
    return NextResponse.json({ error: `AI unavailable: ${(e as Error).message}` }, { status: 500 });
  }

  const start = raw.indexOf("{");
  const end   = raw.lastIndexOf("}");
  const cleaned = start !== -1 && end > start ? raw.slice(start, end + 1) : raw.trim();
  let forms: Record<string, unknown>;
  try { forms = JSON.parse(cleaned); }
  catch { return NextResponse.json({ error: "Failed to parse response" }, { status: 500 }); }

  await sql`
    INSERT INTO notes (case_id, key, content) VALUES (${caseId}, ${CACHE_KEY}, ${JSON.stringify(forms)})
    ON CONFLICT (case_id, key) DO UPDATE SET content = ${JSON.stringify(forms)}, updated_at = now()`;

  return NextResponse.json(forms);
}
