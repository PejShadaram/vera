import Anthropic from "@anthropic-ai/sdk";
import sql from "@/lib/db";
import { verifyCase } from "@/lib/caseAuth";
import { isCaseUnlocked } from "@/lib/subscription";

export const dynamic  = "force-dynamic";
export const maxDuration = 60;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ caseId: string }> }
) {
  const { caseId } = await params;
  const userId = await verifyCase(caseId);
  if (!userId) return new Response("Unauthorized", { status: 401 });
  if (!await isCaseUnlocked(caseId, userId)) return new Response(JSON.stringify({ error: "unlock_required" }), { status: 403, headers: { "Content-Type": "application/json" } });

  const { messages } = await request.json() as {
    messages: Array<{ role: "user" | "assistant"; content: string }>;
  };
  if (!messages?.length) return new Response("No messages", { status: 400 });

  const [[caseRow], timeline, evidence, documents, captures] = await Promise.all([
    sql`SELECT * FROM cases WHERE id = ${caseId}`,
    sql`SELECT date, event, note FROM timeline_entries WHERE case_id = ${caseId} ORDER BY date`,
    sql`SELECT ref, title, source_type, summary FROM evidence WHERE case_id = ${caseId} ORDER BY created_at`,
    sql`SELECT filename, processed, is_opposing FROM documents WHERE case_id = ${caseId} ORDER BY created_at`,
    sql`SELECT content, created_at FROM captures WHERE case_id = ${caseId} ORDER BY created_at DESC LIMIT 20`,
  ]);

  // Load related cases for cross-case context
  const relatedIds = (caseRow?.related_case_ids as string[]) ?? [];
  const relatedContext = relatedIds.length > 0
    ? await sql`SELECT name, case_type FROM cases WHERE id = ANY(${relatedIds}::uuid[]) AND user_id = ${userId}`
    : [];

  if (!caseRow) return new Response("Not found", { status: 404 });

  const hearingDate = caseRow.hearing_date ? `\nUPCOMING HEARING: ${String(caseRow.hearing_date).slice(0,10)}` : "";

  const context = `
CASE: ${caseRow.name}
TYPE: ${String(caseRow.case_type).replace("_", " ")}
OPPOSING PARTY: ${caseRow.opposing_party || "not specified"}
JURISDICTION: ${caseRow.jurisdiction || "not specified"}${hearingDate}
${relatedContext.length > 0 ? `RELATED CASES: ${(relatedContext as Array<Record<string,unknown>>).map(r => `${r.name} (${r.case_type})`).join(", ")}` : ""}

TIMELINE (${timeline.length} events):
${timeline.map((t: Record<string, unknown>) => `• ${t.date}: ${t.event}${t.note ? ` [note: ${t.note}]` : ""}`).join("\n") || "None"}

EVIDENCE (${evidence.length} items):
${evidence.map((e: Record<string, unknown>) => `• ${e.ref}: ${e.title} [${e.source_type}]${e.summary ? ` — ${e.summary}` : ""}`).join("\n") || "None"}

DOCUMENTS:
${documents.map((d: Record<string, unknown>) => `• ${d.filename} [${d.processed ? "analyzed" : "not yet analyzed"}]${d.is_opposing ? " ⚠ FILED AGAINST ME" : ""}`).join("\n") || "None"}

RECENT LOG:
${captures.map((c: Record<string, unknown>) => `• ${c.content}`).join("\n") || "None"}`.trim();

  const system = `You are Vera, a legal case assistant. You have full access to the user's case file shown below. Answer questions specifically and factually using the case data. When asked about documents, events, or evidence, reference the actual records. If something isn't in the case file, say so clearly. You are NOT an attorney and do NOT give legal advice — you help the user understand and organize their own case.

${context}`;

  const anthropic = new Anthropic();
  const stream = anthropic.messages.stream({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system,
    messages,
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(ctrl) {
      for await (const chunk of stream) {
        if (chunk.type === "content_block_delta" && chunk.delta.type === "text_delta") {
          ctrl.enqueue(encoder.encode(chunk.delta.text));
        }
      }
      ctrl.close();
    },
  });

  return new Response(readable, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-cache" },
  });
}
