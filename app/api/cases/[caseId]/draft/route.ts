import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import sql from "@/lib/db";
import { verifyCase } from "@/lib/caseAuth";
import { isCaseUnlocked } from "@/lib/subscription";

export const maxDuration = 60;

const DRAFT_PROMPTS: Record<string, string> = {
  police_statement: `Write a formal victim statement for law enforcement. Structure it as:
1. Identifying information section (leave placeholders for name/DOB/address)
2. A factual, chronological narrative of events using specific dates and details from the case file
3. List of evidence on file
4. A closing declaration statement

Tone: formal, factual, first-person. No speculation. Use exact dates and dollar amounts where available.`,

  opposing_counsel: `Draft a formal letter to opposing counsel. Structure:
1. Re: [Case name and type]
2. Opening paragraph stating the purpose of the letter
3. A factual summary of the key events and evidence
4. The specific relief or action being requested
5. A professional closing

Tone: firm but professional. Cite specific dates and evidence. No emotional language.`,

  declaration: `Draft a sworn declaration for court filing. Structure:
1. Caption: "DECLARATION OF [YOUR NAME]"
2. Opening: "I, [NAME], declare under penalty of perjury as follows:"
3. Numbered paragraphs — each a single factual assertion with date and context
4. Evidence references where relevant
5. Closing: "I declare under penalty of perjury under the laws of [STATE] that the foregoing is true and correct."

Tone: precise, declarative, first-person. One fact per paragraph.`,

  demand_letter: `Draft a demand letter. Structure:
1. Date and parties
2. Re: line identifying the matter
3. Opening paragraph stating the demand clearly
4. Factual background — what happened and when
5. Legal basis for the demand (describe without citing specific statutes)
6. Specific demand with deadline
7. Consequences if demand is not met
8. Professional closing

Tone: direct and professional. Specific dollar amounts and dates.`,

  narrative: `Write a clear, chronological narrative of the case events. Structure:
1. Brief introduction — who the parties are and the nature of the dispute
2. Chronological body — one paragraph per major phase of events, using specific dates
3. Pattern identification — if the timeline reveals a pattern, describe it factually
4. Current status

Tone: neutral, factual, third-person or first-person as appropriate. No speculation.`,
};

export async function POST(
  req: Request,
  { params }: { params: Promise<{ caseId: string }> }
) {
  const { caseId } = await params;
  const userId = await verifyCase(caseId);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!await isCaseUnlocked(caseId, userId)) return NextResponse.json({ error: "unlock_required" }, { status: 403 });

  const { type } = await req.json();
  const draftPrompt = DRAFT_PROMPTS[type];
  if (!draftPrompt) return NextResponse.json({ error: "Unknown draft type" }, { status: 400 });

  const [[caseRow], timeline, evidence, documents, deadlines] = await Promise.all([
    sql`SELECT * FROM cases WHERE id = ${caseId}`,
    sql`SELECT date, event FROM timeline_entries WHERE case_id = ${caseId} ORDER BY date`,
    sql`SELECT ref, title, source_type, summary FROM evidence WHERE case_id = ${caseId} ORDER BY created_at`,
    sql`SELECT filename, processed FROM documents WHERE case_id = ${caseId} ORDER BY created_at`,
    sql`SELECT label, date FROM deadlines WHERE case_id = ${caseId} AND completed = false ORDER BY date`,
  ]);

  if (!caseRow) return NextResponse.json({ error: "Case not found" }, { status: 404 });

  const context = `
CASE: ${caseRow.name}
TYPE: ${String(caseRow.case_type).replace("_", " ")}
OPPOSING PARTY: ${caseRow.opposing_party ?? "not specified"}
JURISDICTION: ${caseRow.jurisdiction ?? "not specified"}
COURT: ${caseRow.court_name ?? "not specified"}
CASE NUMBER: ${caseRow.case_number ?? "not specified"}

TIMELINE (${timeline.length} events):
${timeline.map((t: Record<string, unknown>) => `• ${t.date}: ${t.event}`).join("\n") || "None"}

EVIDENCE ON FILE (${evidence.length} items):
${evidence.map((e: Record<string, unknown>) => `• ${e.ref}: ${e.title} [${e.source_type}]${e.summary ? ` — ${e.summary}` : ""}`).join("\n") || "None"}

DOCUMENTS UPLOADED:
${documents.map((d: Record<string, unknown>) => `• ${d.filename}`).join("\n") || "None"}

UPCOMING DEADLINES:
${deadlines.map((d: Record<string, unknown>) => `• ${d.label} (${d.date})`).join("\n") || "None"}`.trim();

  let draft: string;
  try {
    const anthropic = new Anthropic();
    const msg = await anthropic.messages.create({
      model: "claude-opus-4-7",
      max_tokens: 2048,
      system: `You are Vera, a legal case documentation assistant helping a self-represented litigant draft formal documents. You have access to their full case file. Write clearly and professionally. Use specific facts from the case file. Leave bracketed placeholders like [YOUR NAME] or [DATE] where personal information is needed but not available. Never invent facts not in the case file. Add a note at the top: "DRAFT — Review carefully before use. Not legal advice."`,
      messages: [{ role: "user", content: `${context}\n\n---\n\n${draftPrompt}` }],
    });
    draft = (msg.content[0] as { text: string }).text ?? "";
  } catch (e) {
    return NextResponse.json({ error: `AI unavailable: ${(e as Error).message}` }, { status: 500 });
  }

  return NextResponse.json({ draft });
}
