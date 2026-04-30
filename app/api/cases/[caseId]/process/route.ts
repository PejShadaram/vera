import sql from "@/lib/db";
import { verifyCase } from "@/lib/caseAuth";
import { processFile } from "@/lib/fileProcessor";
// TODO: switch back to Anthropic (claude-haiku-4-5-20251001) once account is activated

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

    const fileContents: Array<Record<string, unknown>> = [];
    const transcripts: Map<string, string> = new Map(); // filename → full transcript

    for (const doc of pending) {
      send({ type: "progress", message: `Processing: ${doc.filename}…` });
      const res = await fetch(doc.blob_url as string, {
        headers: { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` },
      });
      const buf = await res.arrayBuffer();
      const content = await processFile(doc.filename as string, buf);

      // Capture transcripts from audio/video files
      if (content.type === "text") {
        const text = (content as { text: string }).text;
        if (text.includes("[Auto-transcribed]")) {
          transcripts.set(doc.filename as string, text.replace(/^### .+\n\n/, "").replace("[Auto-transcribed]\n\n", "").trim());
        }
      }

      fileContents.push(content as Record<string, unknown>);
    }

    // Get existing case context
    const [caseData] = await sql`SELECT * FROM cases WHERE id = ${caseId}`;
    const timelineRows = await sql`SELECT date, event FROM timeline_entries WHERE case_id = ${caseId} ORDER BY date LIMIT 50`;
    const evidenceRows = await sql`SELECT ref, title FROM evidence WHERE case_id = ${caseId}`;
    const nextRef = `E-${String((evidenceRows.length + 1)).padStart(3, "0")}`;

    const context = `Case: ${caseData.name} | Type: ${caseData.case_type} | Opposing party: ${caseData.opposing_party ?? "unknown"} | State: ${caseData.jurisdiction ?? "unknown"}

Existing timeline entries (${timelineRows.length}): ${timelineRows.map((t: Record<string, unknown>) => `${t.date}: ${t.event}`).join(" | ")}
Existing evidence: ${evidenceRows.map((e: Record<string, unknown>) => `${e.ref}: ${e.title}`).join(", ") || "none"}
Next evidence reference: ${nextRef}`;

    send({ type: "progress", message: "Analyzing with AI…" });

    const systemPrompt = `You are a legal case documentation assistant. Neutral, factual, court-appropriate tone.

${context}

Review the uploaded file(s) and extract:

1. TIMELINE: New chronological entries not already in the timeline. Format: DATE|EVENT (one per line, date as YYYY-MM-DD or descriptive)
2. EVIDENCE: New evidence entries. Format: TITLE|SOURCE_TYPE|SUMMARY (one per line)
   For audio/video transcripts, include the first 300 characters of the transcript verbatim in the summary field.
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
</tasks>`;

    // Build OpenAI-compatible messages
    const userParts: Array<Record<string, unknown>> = [];
    for (const fc of fileContents) {
      if (fc.type === "image") {
        const src = fc.source as { media_type: string; data: string };
        userParts.push({ type: "image_url", image_url: { url: `data:${src.media_type};base64,${src.data}` } });
      } else if (fc.type === "document") {
        const src = fc.source as { data: string };
        try {
          const { extractText } = await import("unpdf");
          const uint8 = new Uint8Array(Buffer.from(src.data, "base64"));
          const { text } = await extractText(uint8, { mergePages: true });
          const extracted = text?.trim() ?? "";
          userParts.push({ type: "text", text: `### PDF Document\n\n${extracted.slice(0, 80000)}` });
        } catch (e) {
          send({ type: "progress", message: `PDF extraction error: ${String(e).slice(0, 100)}` });
          userParts.push({ type: "text", text: "[PDF text extraction failed]" });
        }
      } else {
        userParts.push({ type: "text", text: (fc as { text: string }).text });
      }
    }

    const oaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: 4000,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userParts },
        ],
      }),
    });

    const oaiData = await oaiRes.json() as { choices?: Array<{ message?: { content?: string } }>; error?: { message: string } };
    if (oaiData.error) throw new Error(`OpenAI: ${oaiData.error.message}`);
    const text = oaiData.choices?.[0]?.message?.content ?? "";
    if (!text) throw new Error("OpenAI returned empty response");

    // Strip markdown code fences if GPT wrapped the output
    const cleaned = text.replace(/```[a-z]*\n?/g, "").replace(/```/g, "");

    // Parse and insert results
    const parse = (tag: string) => {
      const m = cleaned.match(new RegExp(`<${tag}>([\\s\\S]*?)<\/${tag}>`));
      return m ? m[1].trim().split("\n").map(l => l.trim()).filter(Boolean) : [];
    };

    const addedTimeline: { date: string; event: string }[] = [];
    const addedEvidence: { ref: string; title: string; summary: string }[] = [];
    const addedTasks:    { title: string; priority: string }[] = [];

    for (const line of parse("timeline")) {
      const [date, ...rest] = line.split("|");
      if (date && rest.length) {
        await sql`INSERT INTO timeline_entries (case_id, date, event) VALUES (${caseId}, ${date.trim()}, ${rest.join("|").trim()})`;
        addedTimeline.push({ date: date.trim(), event: rest.join("|").trim() });
      }
    }

    let evIdx = evidenceRows.length + 1;
    for (const line of parse("evidence")) {
      const [title, sourceType, ...sum] = line.split("|");
      if (title) {
        const ref = `E-${String(evIdx++).padStart(3, "0")}`;
        const summary = sum.join("|").trim();
        await sql`INSERT INTO evidence (case_id, ref, title, source_type, summary) VALUES (${caseId}, ${ref}, ${title.trim()}, ${sourceType?.trim() ?? ""}, ${summary})`;
        addedEvidence.push({ ref, title: title.trim(), summary });
      }
    }

    // Insert dedicated transcript evidence entries for audio/video files
    for (const [filename, transcript] of transcripts) {
      const ref = `E-${String(evIdx++).padStart(3, "0")}`;
      const summary = transcript.slice(0, 300) + (transcript.length > 300 ? "…" : "");
      await sql`INSERT INTO evidence (case_id, ref, title, source_type, summary, transcript) VALUES (${caseId}, ${ref}, ${"Transcript — " + filename}, ${"Audio Transcript"}, ${summary}, ${transcript})`;
      addedEvidence.push({ ref, title: `Transcript — ${filename}`, summary });
    }

    for (const line of parse("tasks")) {
      const [title, priority] = line.split("|");
      if (title) {
        const p = priority?.trim() ?? "medium";
        await sql`INSERT INTO tasks (case_id, title, priority) VALUES (${caseId}, ${title.trim()}, ${p})`;
        addedTasks.push({ title: title.trim(), priority: p });
      }
    }

    // Mark documents processed
    for (const doc of pending) {
      await sql`UPDATE documents SET processed = true, processed_at = now() WHERE id = ${doc.id}`;
    }

    const total = addedTimeline.length + addedEvidence.length + addedTasks.length;
    send({
      type:    "done",
      message: `Vera found ${total} item${total !== 1 ? "s" : ""} in your document${pending.length > 1 ? "s" : ""}.`,
      summary: { timeline: addedTimeline, evidence: addedEvidence, tasks: addedTasks },
    });
  });
}
