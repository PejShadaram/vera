import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import sql from "@/lib/db";
import { verifyCase } from "@/lib/caseAuth";

export const dynamic  = "force-dynamic";
export const maxDuration = 60;

const CACHE_KEY    = "__vera_rules__";
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ caseId: string }> }
) {
  const { caseId } = await params;
  const userId = await verifyCase(caseId);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // Rules are available to all users — helps free users understand the value of unlocking

  const cached = await sql`SELECT content, updated_at FROM notes WHERE case_id = ${caseId} AND key = ${CACHE_KEY} LIMIT 1`;
  if (cached.length > 0) {
    const age = Date.now() - new Date(cached[0].updated_at as string).getTime();
    if (age < CACHE_TTL_MS) return NextResponse.json(JSON.parse(cached[0].content as string));
  }

  const [[caseRow]] = await Promise.all([
    sql`SELECT case_type, jurisdiction FROM cases WHERE id = ${caseId}`,
  ]);
  if (!caseRow) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const jurisdiction = String(caseRow.jurisdiction || "").trim() || "not specified";
  const caseType     = String(caseRow.case_type || "other").replace("_", " ");

  const prompt = `You are a legal rules expert. A self-represented litigant has a ${caseType} case in ${jurisdiction}.

Provide the key procedural rules, statutes, and deadlines they need to know. Be specific to ${jurisdiction} where possible. Focus on what they MUST know to avoid losing on procedural grounds.

Respond ONLY with this JSON — no markdown:
{
  "disclaimer": "One sentence: this is general information, not legal advice",
  "statutes": [
    { "name": "Statute or rule name", "cite": "Citation e.g. CA Family Code § 2310", "summary": "What it says in plain English" }
  ],
  "deadlines": [
    { "event": "What must happen", "timing": "When (e.g. within 30 days of filing)", "consequence": "What happens if missed" }
  ],
  "service_requirements": "Plain-English explanation of how to serve the other party",
  "mandatory_disclosures": [
    "What must be disclosed and when"
  ],
  "key_warnings": [
    "Critical traps or common mistakes for self-represented litigants in this case type"
  ]
}`;

  let raw: string;
  try {
    const anthropic = new Anthropic();
    const msg = await anthropic.messages.create({
      model:      "claude-sonnet-4-6",
      max_tokens: 2048,
      messages:   [{ role: "user", content: prompt }],
    });
    raw = (msg.content[0] as { text: string }).text ?? "{}";
  } catch (e) {
    return NextResponse.json({ error: `AI unavailable: ${(e as Error).message}` }, { status: 500 });
  }

  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
  let rules: Record<string, unknown>;
  try { rules = JSON.parse(cleaned); }
  catch { return NextResponse.json({ error: "Failed to parse response" }, { status: 500 }); }

  await sql`
    INSERT INTO notes (case_id, key, content) VALUES (${caseId}, ${CACHE_KEY}, ${JSON.stringify(rules)})
    ON CONFLICT (case_id, key) DO UPDATE SET content = ${JSON.stringify(rules)}, updated_at = now()`;

  return NextResponse.json(rules);
}
