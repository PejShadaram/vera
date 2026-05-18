import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import sql from "@/lib/db";
import { verifyCase } from "@/lib/caseAuth";
import { isCaseUnlocked } from "@/lib/subscription";

export const dynamic  = "force-dynamic";
export const maxDuration = 60;

const CACHE_KEY     = "__vera_forms__";
const CACHE_TTL_MS  = 7 * 24 * 60 * 60 * 1000; // 7 days — forms rarely change

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ caseId: string }> }
) {
  const { caseId } = await params;
  const userId = await verifyCase(caseId);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!await isCaseUnlocked(caseId, userId))
    return NextResponse.json({ error: "unlock_required" }, { status: 403 });

  // Check cache
  const cached = await sql`SELECT content, updated_at FROM notes WHERE case_id = ${caseId} AND key = ${CACHE_KEY} LIMIT 1`;
  if (cached.length > 0) {
    const age = Date.now() - new Date(cached[0].updated_at as string).getTime();
    if (age < CACHE_TTL_MS) return NextResponse.json(JSON.parse(cached[0].content as string));
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
  const finSummary   = (finances as Array<Record<string, unknown>>)
    .map(f => `${f.category}: $${Number(f.total).toLocaleString()}`).join(", ") || "none";

  const prompt = `You are a legal forms expert helping a self-represented litigant in ${jurisdiction}.

CASE:
- Type: ${caseType}
- Petitioner / Plaintiff name: ${caseRow.name}
- Opposing party: ${opposing}
- Jurisdiction / State: ${jurisdiction}
- Timeline events on file: ${timeline.length}
- Evidence items: ${evidence.length}
- Financial summary: ${finSummary}

List every court form this person will need for a ${caseType} case in ${jurisdiction}, in filing order.

For each form:
- Use the actual state-specific form name and number if you know it (e.g. "FL-100 Petition for Dissolution of Marriage" in California)
- Pre-fill every field you can with the data above
- Use "[NEEDED: ...]" placeholders for fields missing from the case file
- Note the stage at which to file

Respond ONLY with this JSON — no markdown, no explanation:
{
  "jurisdiction_note": "One sentence about ${jurisdiction}-specific requirements",
  "filing_sequence": "Plain-English summary of the order to file these forms",
  "forms": [
    {
      "name": "Full form name",
      "number": "Form number or null",
      "when_to_file": "At what stage",
      "purpose": "What this accomplishes in one sentence",
      "fields": [
        {
          "label": "Field label as it appears on the form",
          "value": "Pre-filled value or [NEEDED: what to provide]",
          "instruction": "Brief note if non-obvious, or null"
        }
      ]
    }
  ],
  "important_notes": ["Critical warnings, deadlines, or requirements"]
}`;

  let raw: string;
  try {
    const anthropic = new Anthropic();
    const msg = await anthropic.messages.create({
      model:      "claude-opus-4-7",
      max_tokens: 4096,
      messages:   [{ role: "user", content: prompt }],
    });
    raw = (msg.content[0] as { text: string }).text ?? "{}";
  } catch (e) {
    return NextResponse.json({ error: `AI unavailable: ${(e as Error).message}` }, { status: 500 });
  }

  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
  let forms: Record<string, unknown>;
  try { forms = JSON.parse(cleaned); }
  catch { return NextResponse.json({ error: "Failed to parse response" }, { status: 500 }); }

  await sql`
    INSERT INTO notes (case_id, key, content) VALUES (${caseId}, ${CACHE_KEY}, ${JSON.stringify(forms)})
    ON CONFLICT (case_id, key) DO UPDATE SET content = ${JSON.stringify(forms)}, updated_at = now()`;

  return NextResponse.json(forms);
}
