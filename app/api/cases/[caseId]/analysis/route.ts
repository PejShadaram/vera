import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import sql from "@/lib/db";
import { verifyCase } from "@/lib/caseAuth";
import { isCaseUnlocked } from "@/lib/subscription";
import { canRegenerateAnalysis } from "@/lib/analysisCache";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const CACHE_KEY    = "__vera_analysis__";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h — non-bust requests served from cache
const MIN_REGEN_MS =  2 * 60 * 60 * 1000; // 2h  — auto-bust won't regenerate more than once per 2h

const CASE_TYPE_GAPS: Record<string, string[]> = {
  divorce: [
    "financial disclosure / inventory of all marital assets and debts",
    "bank statements for the past 3 years",
    "tax returns for the past 3 years",
    "proof of income / recent pay stubs",
    "retirement and investment account statements",
    "property appraisal or current market valuation",
  ],
  custody: [
    "documentation of specific incidents with dates and details",
    "record of all communications with the other parent",
    "existing custody order or parenting plan",
    "school and medical records showing your involvement",
    "witness statements from people who have observed parenting",
  ],
  landlord_tenant: [
    "signed lease agreement",
    "move-in condition checklist or photos",
    "all written communications with landlord or tenant",
    "receipts or records of rent payments",
    "photos documenting current property condition",
  ],
  employment: [
    "employment contract or offer letter",
    "performance reviews and written evaluations",
    "HR complaint records or internal reports",
    "documentation of the specific incident with dates",
    "communications with your employer about the issue",
  ],
  small_claims: [
    "original contract or written agreement",
    "proof of payment you made",
    "all communications demanding repayment",
    "receipts or invoices documenting what is owed",
  ],
  other: [
    "all written communications related to the dispute",
    "any contracts, agreements, or relevant documents",
    "a chronological narrative of what happened",
  ],
};

function buildResponse(analysis: Record<string, unknown>, unlocked: boolean) {
  if (unlocked) return { ...analysis, unlocked };
  return {
    summary:   analysis.summary ?? "",
    obsCount:  Array.isArray(analysis.observations) ? (analysis.observations as unknown[]).length : 0,
    gapsCount: Array.isArray(analysis.gaps)         ? (analysis.gaps as unknown[]).length         : 0,
    unlocked:  false,
  };
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ caseId: string }> }
) {
  const { caseId } = await params;
  const userId = await verifyCase(caseId);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  // ?force=1  → manual Refresh button — always regenerates
  // ?bust=*   → automatic vera:case-updated — regenerates only if cache > 2h old
  const isForce = url.searchParams.has("force");
  const isBust  = url.searchParams.has("bust");

  const unlocked = await isCaseUnlocked(caseId, userId);
  const [{ count: processedCount }] = await sql`SELECT COUNT(*) AS count FROM documents WHERE case_id = ${caseId} AND processed = true`;
  const hasProcessedDocs = Number(processedCount) >= 1;

  // No processed docs and not unlocked — nothing to analyze yet
  if (!unlocked && !hasProcessedDocs) {
    return NextResponse.json({ error: "unlock_required" }, { status: 403 });
  }

  // Cache logic (no hard generation cap):
  // - force=1:  always regenerate
  // - bust:     regenerate only if cache is > 2h old (prevents burst on rapid case updates)
  // - neither:  regenerate only if cache is > 24h old
  const cached = await sql`SELECT content, updated_at FROM notes WHERE case_id = ${caseId} AND key = ${CACHE_KEY} LIMIT 1`;
  if (cached.length > 0 && !isForce) {
    const age = Date.now() - new Date(cached[0].updated_at as string).getTime();
    const serveFromCache = isBust ? age < MIN_REGEN_MS : age < CACHE_TTL_MS;
    if (serveFromCache) {
      const analysis = JSON.parse(cached[0].content as string);
      return NextResponse.json(buildResponse(analysis, unlocked));
    }
  }

  // Gather all case data
  const [
    [caseRow],
    timeline,
    evidence,
    documents,
    tasks,
    deadlines,
    finances,
    captures,
  ] = await Promise.all([
    sql`SELECT * FROM cases WHERE id = ${caseId}`,
    sql`SELECT date, event FROM timeline_entries WHERE case_id = ${caseId} ORDER BY date`,
    sql`SELECT ref, title, source_type FROM evidence WHERE case_id = ${caseId} ORDER BY created_at`,
    sql`SELECT filename, processed FROM documents WHERE case_id = ${caseId} ORDER BY created_at`,
    sql`SELECT title, col, priority FROM tasks WHERE case_id = ${caseId} ORDER BY created_at`,
    sql`SELECT label, date, completed FROM deadlines WHERE case_id = ${caseId} ORDER BY date`,
    sql`SELECT category, SUM(amount) as total, COUNT(*) as count FROM financial_items WHERE case_id = ${caseId} GROUP BY category`,
    sql`SELECT content FROM captures WHERE case_id = ${caseId} ORDER BY created_at DESC LIMIT 5`,
  ]);

  if (!caseRow) return NextResponse.json({ error: "Case not found" }, { status: 404 });

  const caseType = caseRow.case_type as string;
  const typicalGaps = CASE_TYPE_GAPS[caseType] ?? CASE_TYPE_GAPS.other;

  const finSummary = (finances as Array<Record<string, unknown>>)
    .map(f => `${f.category}: $${Number(f.total).toLocaleString()} (${f.count} items)`)
    .join(", ");

  const tasksByCol = {
    todo:       (tasks as Array<Record<string, unknown>>).filter(t => t.col === "todo").map(t => t.title),
    inprogress: (tasks as Array<Record<string, unknown>>).filter(t => t.col === "inprogress").map(t => t.title),
    done:       (tasks as Array<Record<string, unknown>>).filter(t => t.col === "done").map(t => t.title),
  };

  const upcomingDeadlines = (deadlines as Array<Record<string, unknown>>)
    .filter(d => !d.completed)
    .slice(0, 5)
    .map(d => `${d.label} (${d.date})`);

  const context = `
CASE: ${caseRow.name}
TYPE: ${caseType.replace("_", " ")}
OPPOSING PARTY: ${caseRow.opposing_party || "not specified"}
JURISDICTION: ${caseRow.jurisdiction || "not specified"}

TIMELINE (${timeline.length} entries):
${timeline.slice(0, 40).map((t: Record<string, unknown>) => `• ${t.date}: ${t.event}`).join("\n") || "None yet"}

DOCUMENTS UPLOADED (${documents.length} total, ${(documents as Array<Record<string, unknown>>).filter(d => !d.processed).length} unprocessed):
${(documents as Array<Record<string, unknown>>).map(d => `• ${d.filename} [${d.processed ? "processed" : "pending"}]`).join("\n") || "None"}

EVIDENCE LOG (${evidence.length} items):
${(evidence as Array<Record<string, unknown>>).map(e => `• ${e.ref}: ${e.title} (${e.source_type || "unknown type"})`).join("\n") || "None"}

TASKS:
To Do: ${tasksByCol.todo.join(", ") || "none"}
In Progress: ${tasksByCol.inprogress.join(", ") || "none"}
Done: ${tasksByCol.done.join(", ") || "none"}

FINANCES:
${finSummary || "No financial data entered"}

UPCOMING DEADLINES:
${upcomingDeadlines.join("\n") || "None set"}

RECENT LOG ENTRIES:
${(captures as Array<Record<string, unknown>>).map(c => `• ${c.content}`).join("\n") || "None"}

TYPICAL DOCUMENTS NEEDED FOR THIS CASE TYPE:
${typicalGaps.map(g => `• ${g}`).join("\n")}`.trim();

  const caseTypeGuidance: Record<string, string> = {
    divorce: `
DIVORCE-SPECIFIC ANALYSIS LENS:
- Community property vs separate property: flag any pre-marital assets, inheritances, or gifts mentioned. These are separate property in most states.
- Reimbursement claims: if separate property funds were used for marital purposes (down payment from pre-marital savings, improvements paid by one party), flag this — it's a significant financial claim.
- Financial disclosure compliance: both parties must exchange full financial disclosures. Flag if this hasn't happened or appears incomplete.
- Title and deed issues: note any discrepancies in how property is titled vs when it was acquired vs who funded it.
- Pattern of conduct: if there are allegations of misconduct (financial fraud, identity theft, false police reports), note the pattern across events — courts weigh patterns more than isolated incidents.
- Settlement stage: is there a pending offer, a Rule 11 agreement, mediation scheduled? Identify where the case is in the settlement process.
- Protective orders: any existing orders limit what parties can do with assets or contact each other.
- Criminal charges tied to the marriage: note if any criminal cases are referenced and their disposition.`,

    custody: `
CUSTODY-SPECIFIC ANALYSIS LENS:
- Existing orders: is there a current custody order or parenting plan in place? Violations of existing orders are significant.
- Communication record: do the documents show the quality and pattern of co-parenting communication? Hostile or absent communication matters.
- Parental involvement: look for evidence of school involvement, medical appointments, daily care.
- Safety concerns: any references to substance abuse, domestic violence, or unsafe environments — flag them explicitly.
- Best interest factors: stability, relationship history, each parent's ability to support the child's relationship with the other parent.
- Modification threshold: if there's an existing order, a material change in circumstances is required to modify it.`,

    landlord_tenant: `
LANDLORD/TENANT-SPECIFIC ANALYSIS LENS:
- Lease terms: what does the lease actually say vs what's being disputed?
- Notice requirements: were proper written notices given and documented? Most states require specific notice periods.
- Security deposit: what are the documented move-in and move-out conditions? Photos matter.
- Habitability: if repairs were requested, document the request dates and the landlord's response times.
- Payment history: any documented evidence of rent payments made or withheld?
- Retaliation: if action followed a complaint, note the timing — it may constitute unlawful retaliation.`,

    employment: `
EMPLOYMENT-SPECIFIC ANALYSIS LENS:
- Documentation timeline: what was documented before vs after the adverse action? Contemporaneous records are more credible.
- HR record: was the issue formally reported internally? If not, that's typically a gap.
- Protected class or activity: if there's a discrimination or retaliation angle, the protected class or activity needs to be clearly identified.
- Performance record: does the file contain reviews that contradict the stated reason for termination or adverse action?
- Witness identification: are there colleagues who observed key events?
- EEOC/agency deadline: employment claims have strict filing deadlines (180-300 days in most states).`,

    small_claims: `
SMALL CLAIMS-SPECIFIC ANALYSIS LENS:
- Written agreement: is there a contract, invoice, or written agreement establishing the obligation?
- Demand history: were written demands for payment made before filing? Courts want to see an attempt to resolve.
- Proof of payment: if you paid and didn't receive, document both the payment and the failure to deliver.
- Amount calculation: is the claimed amount exact and documented? Include any interest if your state allows it.
- Statute of limitations: check that the claim is within the filing window for your state and claim type.`,

    other: `
GENERAL ANALYSIS LENS:
- Establish the core dispute clearly from the documents on file.
- Look for a documented chronology of events.
- Identify what the person is seeking and what they have to support that claim.
- Flag any deadlines or legal notice requirements that may be relevant.`,
  };

  const guidance = caseTypeGuidance[caseType] ?? caseTypeGuidance.other;

  const prompt = `You are Vera, an AI legal case companion. You help self-represented individuals organize and understand their legal situation. You are NOT an attorney and you do NOT give legal advice. You read case files carefully and tell people what you observe — specifically and factually.

${context}

${guidance}

Write a case briefing with four parts. Use real names, dates, and dollar amounts from the file. Sound like someone who has genuinely read every entry — not a generic template. Be direct and specific.

SUMMARY: 2-3 sentences capturing the essential situation right now. Name the parties, the core dispute, and the current stage. Use specifics.

OBSERVATIONS: 2-4 things you notice after reading the full file. Look for:
- Patterns across multiple entries (same behavior repeating, escalating conduct)
- Financial figures that stand out or raise questions
- Contradictions between what documents say and what entries say
- Timing patterns (actions taken right after or before key events)
- Strengths in the case that are well-documented
Be specific — reference actual entries, dates, amounts.

GAPS: 1-3 genuine gaps you see. Compare what's uploaded against what's typically needed. Do not flag things that might just be named differently. Only flag things that are genuinely absent and would matter.

NEXT: One concrete action this person should take right now given where the case stands. Be specific about what to do, not just a category of thing ("file your financial disclosure with the court before the [specific date] deadline" not "gather financial documents").

Respond in this exact JSON format with no other text:
{
  "summary": "...",
  "observations": ["...", "..."],
  "gaps": ["...", "..."],
  "next": "..."
}`;

  // Enforce per-case regeneration cap before calling the LLM
  const allowed = await canRegenerateAnalysis(caseId);
  if (!allowed) {
    return NextResponse.json({ error: "Analysis generation limit reached for this case" }, { status: 429 });
  }

  let raw: string;
  try {
    const anthropic = new Anthropic();
    const msg = await anthropic.messages.create({
      model: "claude-opus-4-7",
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    });
    raw = (msg.content[0] as { text: string }).text ?? "{}";
  } catch (e) {
    return NextResponse.json({ error: `AI unavailable: ${(e as Error).message}` }, { status: 500 });
  }

  // Strip markdown code fences if Claude wrapped the JSON
  const _s = raw.indexOf("{"), _e = raw.lastIndexOf("}");
  const cleaned = _s !== -1 && _e > _s ? raw.slice(_s, _e + 1) : raw.trim();

  let analysis: Record<string, unknown>;
  try { analysis = JSON.parse(cleaned); }
  catch { return NextResponse.json({ error: "Failed to parse analysis response" }, { status: 500 }); }

  // Cache result
  await sql`
    INSERT INTO notes (case_id, key, content) VALUES (${caseId}, ${CACHE_KEY}, ${JSON.stringify(analysis)})
    ON CONFLICT (case_id, key) DO UPDATE SET content = ${JSON.stringify(analysis)}, updated_at = now()`;

  return NextResponse.json(buildResponse(analysis, unlocked));
}
