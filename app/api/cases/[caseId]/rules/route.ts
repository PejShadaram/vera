import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import sql from "@/lib/db";
import { verifyCase } from "@/lib/caseAuth";

export const dynamic  = "force-dynamic";
export const maxDuration = 120;

const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days — laws don't change weekly

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ caseId: string }> }
) {
  const { caseId } = await params;
  const userId = await verifyCase(caseId);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [caseRow] = await sql`SELECT case_type, jurisdiction FROM cases WHERE id = ${caseId}`;
  if (!caseRow) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const jurisdiction = String(caseRow.jurisdiction || "").trim() || "not specified";
  const caseType     = String(caseRow.case_type || "other").replace("_", " ");

  // Global cache — shared across every case with the same type+jurisdiction
  try {
    const [cached] = await sql`
      SELECT content, updated_at FROM rules_cache
      WHERE case_type = ${caseType} AND jurisdiction = ${jurisdiction} LIMIT 1`;
    if (cached) {
      const age = Date.now() - new Date(cached.updated_at as string).getTime();
      if (age < CACHE_TTL_MS) return NextResponse.json(JSON.parse(cached.content as string));
    }
  } catch (e) {
    console.error("[rules] cache read error:", e);
  }

  const prompt = `You are a legal rules expert. A self-represented litigant has a ${caseType} case in ${jurisdiction}.

List ONLY the most critical procedural rules and statutes — limit to 5 statutes, 5 deadlines, 3 mandatory disclosures, and 5 key warnings maximum.

Respond ONLY with valid JSON (no markdown, no explanation):
{
  "disclaimer": "One sentence: this is general information, not legal advice",
  "statutes": [
    { "name": "Statute or rule name", "cite": "Citation e.g. TX Fam. Code § 6.001", "summary": "Plain English, 1-2 sentences" }
  ],
  "deadlines": [
    { "event": "What must happen", "timing": "When", "consequence": "What happens if missed" }
  ],
  "service_requirements": "Plain-English, 2-3 sentences max",
  "mandatory_disclosures": ["What must be disclosed and when"],
  "key_warnings": ["Critical trap or common mistake, 1 sentence each"]
}`;

  let raw: string;
  try {
    const anthropic = new Anthropic();
    const msg = await anthropic.messages.create({
      model:      "claude-sonnet-4-6",
      max_tokens: 3000,
      messages:   [{ role: "user", content: prompt }],
    });
    raw = (msg.content[0] as { text: string }).text ?? "{}";
  } catch (e) {
    console.error("[rules] AI error:", e);
    return NextResponse.json({ error: `AI unavailable: ${(e as Error).message}` }, { status: 500 });
  }

  const start = raw.indexOf("{");
  const end   = raw.lastIndexOf("}");
  const cleaned = start !== -1 && end > start ? raw.slice(start, end + 1) : raw.trim();
  let rules: Record<string, unknown>;
  try { rules = JSON.parse(cleaned); }
  catch (e) {
    console.error("[rules] JSON parse error:", e, "raw:", raw.slice(0, 300));
    return NextResponse.json({ error: "Failed to parse response" }, { status: 500 });
  }

  try {
    await sql`
      INSERT INTO rules_cache (case_type, jurisdiction, content)
      VALUES (${caseType}, ${jurisdiction}, ${JSON.stringify(rules)})
      ON CONFLICT (case_type, jurisdiction)
      DO UPDATE SET content = ${JSON.stringify(rules)}, updated_at = now()`;
  } catch (e) {
    console.error("[rules] cache write error:", e);
  }

  return NextResponse.json(rules);
}
