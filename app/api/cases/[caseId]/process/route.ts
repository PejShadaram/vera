import Anthropic from "@anthropic-ai/sdk";
import sql from "@/lib/db";
import { verifyCase } from "@/lib/caseAuth";
import { isCaseUnlocked } from "@/lib/subscription";
import { processFile } from "@/lib/fileProcessor";
import { trackEvent } from "@/lib/trackEvent";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const SPREADSHEET_EXTS = ["xlsx", "xls", "csv"];
function fileExt(name: string) { return name.split(".").pop()?.toLowerCase() ?? ""; }

// ── Direct CSV parser (handles quoted fields) ─────────────────────────────
function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { field += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      fields.push(field.trim()); field = "";
    } else {
      field += ch;
    }
  }
  fields.push(field.trim());
  return fields;
}

// ── Deterministic category rules ──────────────────────────────────────────
function categorize(description: string, notes: string): string | null {
  const t = `${description} ${notes}`.toLowerCase();

  // Exclude totals, subtotals, estimates, projections
  if (/\btotal\b|\bsubtotal\b|\bestimate\b|\bprojected\b|\bsummary\b/.test(t)) return null;

  // Assets: capital improvements, property purchases, account balances
  if (/down payment|ira balance|ira remaining|home value|market value|equity|hcad/.test(t)) return "Asset";
  if (/construction|renovation|roof|gutter|driveway|fence|bathtub|bathroom|shower|landscape|paving|flooring|remodel|addition|pool|deck/.test(t)) return "Asset";

  // Debts: unpaid liabilities, tax bills, outstanding loans/balances
  if (/irs|tax liability|tax bill|wayfair credit|service finance loan|credit card.*balance|mortgage payoff|lien/.test(t)) return "Debt";

  // Expenses: everything else (insurance, taxes, maintenance, hotel, utilities, fees)
  return "Expense";
}

// ── Parse SheetJS CSV into financial line items ───────────────────────────
function parseSpreadsheetFinances(csvText: string): Array<{
  description: string; category: string; amount: number; date: string; notes: string;
}> {
  const results: Array<{ description: string; category: string; amount: number; date: string; notes: string }> = [];
  const lines = csvText.split("\n");

  let descCol = -1, amountCol = -1, dateCol = -1, accountCol = -1, notesCol = -1;
  let headerFound = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    // New sheet marker — reset header detection
    if (!line || line.startsWith("##")) {
      headerFound = false; descCol = amountCol = dateCol = accountCol = notesCol = -1;
      continue;
    }

    const cols = parseCSVLine(line);
    if (!cols.length) continue;

    if (!headerFound) {
      const lc = cols.map(c => c.toLowerCase().trim());
      const tryDesc   = lc.findIndex(c => /expense|description|item|label/.test(c));
      const tryAmount = lc.findIndex(c => /^amount$|^cost$|^total$|^price$/.test(c));
      if (tryDesc >= 0 && tryAmount >= 0) {
        descCol    = tryDesc;
        amountCol  = tryAmount;
        dateCol    = lc.findIndex(c => /date/.test(c));
        accountCol = lc.findIndex(c => /account|paid from|payment/.test(c));
        notesCol   = lc.findIndex(c => /note|memo|comment/.test(c));
        headerFound = true;
      }
      continue;
    }

    const desc    = (cols[descCol] ?? "").trim();
    const amtStr  = (cols[amountCol] ?? "").trim();
    const dateStr = dateCol >= 0 ? (cols[dateCol] ?? "") : "";
    const account = accountCol >= 0 ? (cols[accountCol] ?? "") : "";
    const noteRaw = notesCol >= 0 ? (cols[notesCol] ?? "") : "";

    // Skip empty, row-number-only, or header-repeat rows
    if (!desc || /^[#\d]+$/.test(desc) || !amtStr) continue;

    const amount = parseFloat(amtStr.replace(/[^0-9.]/g, ""));
    if (isNaN(amount) || amount <= 0) continue;

    const category = categorize(desc, noteRaw);
    if (!category) continue; // excluded (total/estimate)

    // Take first ISO date found (handles "2023-05-25, 06-12" style)
    const dateMatch = dateStr.match(/\d{4}-\d{2}-\d{2}/);
    const cleanDate = dateMatch ? dateMatch[0] : "";

    const notes = [account, noteRaw].filter(Boolean).join(" — ");

    results.push({ description: desc, category, amount, date: cleanDate, notes });
  }

  return results;
}

// ── SSE helper ────────────────────────────────────────────────────────────
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

async function callClaude(systemPrompt: string, userParts: Array<Record<string, unknown>>): Promise<string> {
  const client = new Anthropic();
  const msg = await client.messages.create({
    model: "claude-opus-4-7",
    max_tokens: 8000,
    system: systemPrompt,
    messages: [{ role: "user", content: userParts as unknown as Anthropic.MessageParam["content"] }],
  });
  const text = (msg.content[0] as { text: string }).text ?? "";
  return text.replace(/```[a-z]*\n?/g, "").replace(/```/g, "");
}

async function categorizeSpreadsheetWithClaude(csvText: string, caseContext: string): Promise<Array<{
  description: string; category: string; amount: number; date: string; notes: string;
}>> {
  const client = new Anthropic();
  const msg = await client.messages.create({
    model: "claude-opus-4-7",
    max_tokens: 4000,
    system: `You are a legal financial analyst. Extract financial line items from spreadsheet data related to a legal case.

For each item assign a category:
- Asset: real property, bank/investment accounts, retirement accounts, home equity, valuables, capital improvements that add home value
- Debt: mortgages, loans, credit card balances, tax liabilities, money owed to others
- Income: salary, wages, rental income, business revenue, support received
- Expense: ongoing costs, bills paid, attorney fees, maintenance costs

Skip: total rows, subtotal rows, estimates, projections, blank rows, headers.
Dates: output as YYYY-MM-DD. If date is MM/DD/YYYY convert it. If MM/DD/YY assume 20XX for years < 30.

Respond ONLY with a JSON array — no other text:
[{"description":"...","category":"Asset|Debt|Income|Expense","amount":1234.56,"date":"YYYY-MM-DD or empty string","notes":"..."}]`,
    messages: [{ role: "user", content: `Case context: ${caseContext}\n\nSpreadsheet data:\n${csvText.slice(0, 60000)}` }],
  });
  const raw = (msg.content[0] as { text: string }).text ?? "[]";
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    return [];
  }
}

function parseTag(cleaned: string, tag: string): string[] {
  const m = cleaned.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`));
  return m ? m[1].trim().split("\n").map(l => l.trim()).filter(Boolean) : [];
}

// ── Main handler ──────────────────────────────────────────────────────────
export async function POST(request: Request, { params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params;
  const userId = await verifyCase(caseId);
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const FREE_PROCESS_LIMIT = 3;
  const unlocked = await isCaseUnlocked(caseId, userId);
  const [{ count: processedCount }] = await sql`SELECT COUNT(*) AS count FROM documents WHERE case_id = ${caseId} AND processed = true`;
  const alreadyProcessed = Number(processedCount);

  if (!unlocked && alreadyProcessed >= FREE_PROCESS_LIMIT) {
    void trackEvent(userId, "unlock_wall_hit", caseId);
    return new Response(JSON.stringify({ error: "unlock_required", processed: alreadyProcessed, limit: FREE_PROCESS_LIMIT }), { status: 403, headers: { "Content-Type": "application/json" } });
  }

  const allPending = await sql`SELECT * FROM documents WHERE case_id = ${caseId} AND processed = false`;
  if (allPending.length === 0) return new Response(JSON.stringify({ error: "No pending documents" }), { status: 400 });

  // Free tier: cap the batch at remaining free quota
  const remaining = unlocked ? allPending.length : Math.max(0, FREE_PROCESS_LIMIT - alreadyProcessed);
  const pending = allPending.slice(0, remaining);

  return sse(async (send) => {
    send({ type: "progress", message: `Downloading ${pending.length} document(s)…` });

    const spreadsheetDocs = pending.filter(d => SPREADSHEET_EXTS.includes(fileExt(d.filename as string)));
    const otherDocs       = pending.filter(d => !SPREADSHEET_EXTS.includes(fileExt(d.filename as string)));

    const [caseData] = await sql`SELECT * FROM cases WHERE id = ${caseId}`;
    const timelineRows = await sql`SELECT date, event FROM timeline_entries WHERE case_id = ${caseId} ORDER BY date LIMIT 50`;
    const evidenceRows = await sql`SELECT ref, title FROM evidence WHERE case_id = ${caseId}`;

    const addedTimeline:  { date: string; event: string }[] = [];
    const addedEvidence:  { ref: string; title: string; summary: string }[] = [];
    const addedTasks:     { title: string; priority: string }[] = [];
    const addedFinances:  { description: string; category: string; amount: number; date: string }[] = [];
    const transcripts:    Map<string, string> = new Map();

    let evIdx = evidenceRows.length + 1;

    async function fetchBuf(doc: Record<string, unknown>): Promise<ArrayBuffer> {
      const res = await fetch(doc.blob_url as string, {
        headers: { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` },
      });
      return res.arrayBuffer();
    }

    // ── SPREADSHEETS: Claude-powered categorization ───────────────────────
    for (const doc of spreadsheetDocs) {
      send({ type: "progress", message: `Reading spreadsheet: ${doc.filename}…` });
      const buf     = await fetchBuf(doc);
      const content = await processFile(doc.filename as string, buf);
      const csvText = (content as { text: string }).text;

      send({ type: "progress", message: `Analyzing ${doc.filename} with AI…` });
      const caseContext = `${caseData.name} | ${caseData.case_type} | vs ${caseData.opposing_party ?? "unknown"}`;
      const rows = await categorizeSpreadsheetWithClaude(csvText, caseContext);
      send({ type: "progress", message: `Found ${rows.length} line items — deduplicating…` });

      let inserted = 0;
      for (const row of rows) {
        if (!["Asset","Debt","Income","Expense"].includes(row.category)) continue;
        const amount = Number(row.amount);
        if (isNaN(amount) || amount <= 0) continue;

        const exists = await sql`
          SELECT id FROM financial_items
          WHERE case_id = ${caseId} AND description = ${row.description} AND amount = ${amount}
          LIMIT 1`;
        if (exists.length > 0) continue;

        await sql`INSERT INTO financial_items (case_id, category, description, amount, date, notes)
          VALUES (${caseId}, ${row.category}, ${row.description}, ${amount}, ${row.date ?? ""}, ${row.notes ?? ""})`;
        addedFinances.push({ description: row.description, category: row.category, amount, date: row.date ?? "" });
        inserted++;
      }

      const evRef   = `E-${String(evIdx++).padStart(3, "0")}`;
      const summary = `Financial spreadsheet — ${inserted} line items imported`;
      await sql`INSERT INTO evidence (case_id, ref, title, source_type, summary)
        VALUES (${caseId}, ${evRef}, ${doc.filename as string}, ${"Financial Record"}, ${summary})`;
      addedEvidence.push({ ref: evRef, title: doc.filename as string, summary });
    }

    // ── OTHER FILES: full AI extraction ────────────────────────────────
    if (otherDocs.length > 0) {
      send({ type: "progress", message: "Analyzing documents with AI…" });

      const context = `Case: ${caseData.name} | Type: ${caseData.case_type} | Opposing party: ${caseData.opposing_party ?? "unknown"} | State: ${caseData.jurisdiction ?? "unknown"}
Existing timeline (${timelineRows.length}): ${timelineRows.map((t: Record<string, unknown>) => `${t.date}: ${t.event}`).join(" | ")}
Existing evidence: ${evidenceRows.map((e: Record<string, unknown>) => `${e.ref}: ${e.title}`).join(", ") || "none"}
Next evidence ref: E-${String(evIdx).padStart(3, "0")}`;

      const systemPrompt = `You are a legal case documentation assistant. Neutral, factual, court-appropriate tone.

${context}

Extract from the uploaded file(s):

1. TIMELINE: New chronological entries. Format: DATE|EVENT (YYYY-MM-DD or descriptive)
2. EVIDENCE: New evidence entries. Format: TITLE|SOURCE_TYPE|SUMMARY
   For audio/video, include first 300 characters of transcript verbatim in summary.
3. TASKS: Suggested action items. Format: TITLE|PRIORITY (high/medium/low)
4. FINANCES: Any specific dollar amounts mentioned. Format: DESCRIPTION|CATEGORY|AMOUNT|DATE|NOTES
   CATEGORY: Asset, Debt, Income, or Expense. AMOUNT: numeric only, no $ or commas.

Return ONLY:
<timeline>DATE|Event</timeline>
<evidence>Title|Type|Summary</evidence>
<tasks>Title|priority</tasks>
<finances>Description|Category|Amount|Date|Notes</finances>`;

      const userParts: Array<Record<string, unknown>> = [];
      for (const doc of otherDocs) {
        send({ type: "progress", message: `Processing: ${doc.filename}…` });
        const buf     = await fetchBuf(doc);
        const content = await processFile(doc.filename as string, buf);

        if (content.type === "text") {
          const text = (content as { text: string }).text;
          if (text.includes("[Auto-transcribed]")) {
            transcripts.set(doc.filename as string, text.replace(/^### .+\n\n/, "").replace("[Auto-transcribed]\n\n", "").trim());
          }
          userParts.push({ type: "text", text });
        } else if (content.type === "image") {
          const src = content.source as { media_type: string; data: string };
          userParts.push({ type: "image", source: { type: "base64", media_type: src.media_type, data: src.data } });
        } else if (content.type === "document") {
          const src = content.source as { data: string };
          try {
            const { extractText } = await import("unpdf");
            const uint8 = new Uint8Array(Buffer.from(src.data, "base64"));
            const { text } = await extractText(uint8, { mergePages: true });
            userParts.push({ type: "text", text: `### PDF\n\n${(text?.trim() ?? "").slice(0, 80000)}` });
          } catch {
            userParts.push({ type: "text", text: "[PDF extraction failed]" });
          }
        }
      }

      if (userParts.length > 0) {
        const cleaned = await callClaude(systemPrompt, userParts);

        for (const line of parseTag(cleaned, "timeline")) {
          const [date, ...rest] = line.split("|");
          if (date && rest.length) {
            await sql`INSERT INTO timeline_entries (case_id, date, event) VALUES (${caseId}, ${date.trim()}, ${rest.join("|").trim()})`;
            addedTimeline.push({ date: date.trim(), event: rest.join("|").trim() });
          }
        }

        for (const line of parseTag(cleaned, "evidence")) {
          const [title, sourceType, ...sum] = line.split("|");
          if (title) {
            const ref = `E-${String(evIdx++).padStart(3, "0")}`;
            const summary = sum.join("|").trim();
            await sql`INSERT INTO evidence (case_id, ref, title, source_type, summary) VALUES (${caseId}, ${ref}, ${title.trim()}, ${sourceType?.trim() ?? ""}, ${summary})`;
            addedEvidence.push({ ref, title: title.trim(), summary });
          }
        }

        for (const [filename, transcript] of transcripts) {
          const ref = `E-${String(evIdx++).padStart(3, "0")}`;
          const summary = transcript.slice(0, 300) + (transcript.length > 300 ? "…" : "");
          await sql`INSERT INTO evidence (case_id, ref, title, source_type, summary, transcript)
            VALUES (${caseId}, ${ref}, ${"Transcript — " + filename}, ${"Audio Transcript"}, ${summary}, ${transcript})`;
          addedEvidence.push({ ref, title: `Transcript — ${filename}`, summary });
        }

        for (const line of parseTag(cleaned, "tasks")) {
          const [title, priority] = line.split("|");
          if (title) {
            const p = priority?.trim() ?? "medium";
            await sql`INSERT INTO tasks (case_id, title, priority) VALUES (${caseId}, ${title.trim()}, ${p})`;
            addedTasks.push({ title: title.trim(), priority: p });
          }
        }

        for (const line of parseTag(cleaned, "finances")) {
          const [description, category, amountStr, date, ...notesParts] = line.split("|");
          const cat = category?.trim();
          if (!["Asset","Debt","Income","Expense"].includes(cat)) continue;
          const amount = parseFloat((amountStr ?? "").replace(/[^0-9.]/g, ""));
          if (isNaN(amount) || amount <= 0) continue;
          const exists = await sql`SELECT id FROM financial_items WHERE case_id = ${caseId} AND description = ${description.trim()} AND amount = ${amount} LIMIT 1`;
          if (exists.length > 0) continue;
          await sql`INSERT INTO financial_items (case_id, category, description, amount, date, notes)
            VALUES (${caseId}, ${cat}, ${description.trim()}, ${amount}, ${date?.trim() || ""}, ${notesParts.join("|").trim()})`;
          addedFinances.push({ description: description.trim(), category: cat, amount, date: date?.trim() || "" });
        }
      }
    }

    for (const doc of pending) {
      await sql`UPDATE documents SET processed = true, processed_at = now() WHERE id = ${doc.id}`;
    }

    // Invalidate analysis cache so next page load regenerates with fresh data
    await sql`DELETE FROM notes WHERE case_id = ${caseId} AND key = '__vera_analysis__'`;

    const total = addedTimeline.length + addedEvidence.length + addedTasks.length + addedFinances.length;
    send({
      type:    "done",
      message: `Vera found ${total} item${total !== 1 ? "s" : ""} in your document${pending.length > 1 ? "s" : ""}.`,
      summary: { timeline: addedTimeline, evidence: addedEvidence, tasks: addedTasks, finances: addedFinances },
    });
  });
}
