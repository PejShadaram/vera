import Anthropic from "@anthropic-ai/sdk";
import sql from "@/lib/db";
import { verifyCase } from "@/lib/caseAuth";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

function sse(fn: (send: (d: object) => void) => Promise<void>) {
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(ctrl) {
      const send = (d: object) => ctrl.enqueue(enc.encode(`data: ${JSON.stringify(d)}\n\n`));
      try { await fn(send); }
      catch (e: unknown) { send({ type: "error", message: (e as Error).message }); }
      finally { ctrl.close(); }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" } });
}

export async function POST(request: Request, { params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params;
  if (!await verifyCase(caseId)) return new Response("Unauthorized", { status: 401 });

  const pending = await sql`SELECT * FROM documents WHERE case_id = ${caseId} AND processed = false`;
  if (pending.length === 0) return new Response(JSON.stringify({ error: "No pending documents" }), { status: 400 });

  return sse(async (send) => {
    send({ type: "progress", message: `Downloading ${pending.length} document(s)…` });

    const uploads: { name: string; base64: string; mimeType: string }[] = [];
    for (const doc of pending) {
      const res = await fetch(doc.blob_url as string);
      const buf = await res.arrayBuffer();
      uploads.push({
        name:     doc.filename as string,
        base64:   Buffer.from(buf).toString("base64"),
        mimeType: (doc.filename as string).endsWith(".pdf") ? "application/pdf" : "text/plain",
      });
    }

    // Get existing case context
    const [caseData] = await sql`SELECT * FROM cases WHERE id = ${caseId}`;
    const timelineRows = await sql`SELECT date, event FROM timeline_entries WHERE case_id = ${caseId} ORDER BY date LIMIT 50`;
    const evidenceRows = await sql`SELECT ref, title FROM evidence WHERE case_id = ${caseId}`;
    const nextRef = `E-${String((evidenceRows.length + 1)).padStart(3, "0")}`;

    const context = `Case: ${caseData.name} | Type: ${caseData.case_type} | Opposing party: ${caseData.opposing_party ?? "unknown"} | State: ${caseData.jurisdiction ?? "unknown"}

Existing timeline entries (${timelineRows.length}): ${timelineRows.map(t => `${t.date}: ${t.event}`).join(" | ")}
Existing evidence: ${evidenceRows.map(e => `${e.ref}: ${e.title}`).join(", ") || "none"}
Next evidence reference: ${nextRef}`;

    send({ type: "progress", message: "Analyzing with Claude…" });

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const content: Array<Record<string, unknown>> = [
      { type: "text", text: `You are a legal case documentation assistant. Neutral, factual, court-appropriate tone.

${context}

Review the uploaded document(s) and extract:

1. TIMELINE: New chronological entries not already in the timeline. Format: DATE|EVENT (one per line, date as YYYY-MM-DD or descriptive)
2. EVIDENCE: New evidence entries. Format: TITLE|SOURCE_TYPE|SUMMARY (one per line)
3. TASKS: Suggested action items. Format: TITLE|PRIORITY (high/medium/low) (one per line)

Return ONLY in this exact format — no other text:

<timeline>
YYYY-MM-DD|Event description
</timeline>

<evidence>
Document Title|Source Type|Brief factual summary
</evidence>

<tasks>
Task title|priority
</tasks>` },
    ];

    for (const u of uploads) {
      if (u.mimeType === "application/pdf") {
        content.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: u.base64 } });
      } else {
        content.push({ type: "text", text: `\n### ${u.name}\n\n${Buffer.from(u.base64, "base64").toString("utf8")}` });
      }
    }

    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4000,
      messages: [{ role: "user", content: content as unknown as Anthropic.MessageParam["content"] }],
    }, { headers: { "anthropic-beta": "pdfs-2024-09-25" } });

    const text = (response.content.find(b => b.type === "text") as { text: string } | undefined)?.text ?? "";

    // Parse and insert results
    const parse = (tag: string) => {
      const m = text.match(new RegExp(`<${tag}>([\\s\\S]*?)<\/${tag}>`));
      return m ? m[1].trim().split("\n").map(l => l.trim()).filter(Boolean) : [];
    };

    let added = 0;
    for (const line of parse("timeline")) {
      const [date, ...rest] = line.split("|");
      if (date && rest.length) { await sql`INSERT INTO timeline_entries (case_id, date, event) VALUES (${caseId}, ${date.trim()}, ${rest.join("|").trim()})`; added++; }
    }

    let evIdx = evidenceRows.length + 1;
    for (const line of parse("evidence")) {
      const [title, sourceType, ...sum] = line.split("|");
      if (title) {
        const ref = `E-${String(evIdx++).padStart(3, "0")}`;
        await sql`INSERT INTO evidence (case_id, ref, title, source_type, summary) VALUES (${caseId}, ${ref}, ${title.trim()}, ${sourceType?.trim() ?? ""}, ${sum.join("|").trim()})`;
        added++;
      }
    }

    for (const line of parse("tasks")) {
      const [title, priority] = line.split("|");
      if (title) { await sql`INSERT INTO tasks (case_id, title, priority) VALUES (${caseId}, ${title.trim()}, ${priority?.trim() ?? "medium"})`; added++; }
    }

    // Mark documents processed
    for (const doc of pending) {
      await sql`UPDATE documents SET processed = true, processed_at = now() WHERE id = ${doc.id}`;
    }

    send({ type: "done", message: `Done — added ${added} items to your case.` });
  });
}
