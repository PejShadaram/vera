import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";
import sql from "@/lib/db";
import type { Metadata } from "next";
import ExportPrintButton from "./ExportPrintButton";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Case Export — Vera" };

function fmt(v: unknown) {
  if (!v) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).slice(0, 10);
}
function money(n: unknown) { return n ? `$${Number(n).toLocaleString("en-US", { minimumFractionDigits: 2 })}` : "—"; }

export default async function ExportPage({ params }: { params: Promise<{ caseId: string }> }) {
  const { userId } = await auth();
  const { caseId }  = await params;

  const [c] = await sql`SELECT * FROM cases WHERE id = ${caseId} AND user_id = ${userId}`;
  if (!c) notFound();

  const [timeline, evidence, documents, tasks, deadlines, finances, notes] = await Promise.all([
    sql`SELECT * FROM timeline_entries WHERE case_id = ${caseId} ORDER BY date, created_at`,
    sql`SELECT * FROM evidence WHERE case_id = ${caseId} ORDER BY created_at`,
    sql`SELECT * FROM documents WHERE case_id = ${caseId} ORDER BY created_at`,
    sql`SELECT * FROM tasks WHERE case_id = ${caseId} ORDER BY col, created_at`,
    sql`SELECT * FROM deadlines WHERE case_id = ${caseId} ORDER BY date`,
    sql`SELECT * FROM financial_items WHERE case_id = ${caseId} ORDER BY category, date DESC`,
    sql`SELECT content FROM notes WHERE case_id = ${caseId} AND key = '__case_notes__' LIMIT 1`,
  ]);

  const caseNotes = (notes[0]?.content as string) ?? "";
  const generated = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  const totalAssets  = finances.filter(f => f.category === "Asset").reduce((s, f) => s + Number(f.amount ?? 0), 0);
  const totalDebts   = finances.filter(f => f.category === "Debt").reduce((s, f) => s + Number(f.amount ?? 0), 0);

  return (
    <div style={{ fontFamily: "Georgia, 'Times New Roman', serif", maxWidth: 800, margin: "0 auto", padding: "40px 32px", color: "#111827", lineHeight: 1.6 }}>

      {/* Print media styles */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: #fff !important; }
        }
      `}</style>

      {/* Action buttons — hidden when printing */}
      <div className="no-print" style={{ marginBottom: 32, display: "flex", gap: 12 }}>
        <ExportPrintButton />
        <a href={`/cases/${caseId}`}
          style={{ border: "1px solid #E5E7EB", color: "#6B7280", padding: "10px 24px", borderRadius: 8, fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 14, fontWeight: 500, textDecoration: "none", display: "inline-block" }}>
          ← Back to case
        </a>
      </div>

      {/* Header */}
      <div style={{ borderBottom: "2px solid #111827", paddingBottom: 16, marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <p style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.15em", color: "#6B7280", margin: "0 0 4px" }}>Case File — Vera</p>
            <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>{c.name as string}</h1>
          </div>
          <div style={{ textAlign: "right", fontSize: 11, color: "#6B7280" }}>
            <div>Generated {generated}</div>
            <div style={{ marginTop: 4, fontSize: 10, color: "#9CA3AF" }}>Not legal advice</div>
          </div>
        </div>
        <div style={{ marginTop: 12, display: "flex", gap: 24, flexWrap: "wrap", fontSize: 13, color: "#6B7280" }}>
          {c.opposing_party && <span><strong style={{ color: "#111827" }}>vs.</strong> {c.opposing_party as string}</span>}
          {c.jurisdiction   && <span><strong style={{ color: "#111827" }}>State:</strong> {c.jurisdiction as string}</span>}
          {c.court_name     && <span><strong style={{ color: "#111827" }}>Court:</strong> {c.court_name as string}</span>}
          {c.case_number    && <span><strong style={{ color: "#111827" }}>Case No.:</strong> {c.case_number as string}</span>}
        </div>
      </div>

      {/* Timeline — top 10 most recent */}
      {timeline.length > 0 && (
        <section style={{ marginBottom: 32, pageBreakInside: "avoid" }}>
          <h2 style={{ fontSize: 14, textTransform: "uppercase", letterSpacing: "0.1em", borderBottom: "1px solid #E5E7EB", paddingBottom: 6, marginBottom: 12 }}>
            Timeline of Events ({Math.min(timeline.length, 10)} of {timeline.length})
          </h2>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            {[...timeline].reverse().slice(0, 10).map((e, i) => (
              <tr key={i} style={{ borderBottom: "1px solid #F2EDE5" }}>
                <td style={{ padding: "7px 0", verticalAlign: "top", width: 100, color: "#6B7280", fontVariantNumeric: "tabular-nums" }}>{fmt(e.date)}</td>
                <td style={{ padding: "7px 0 7px 16px", verticalAlign: "top" }}>
                  {e.event as string}
                  {e.note ? <div style={{ fontSize: 12, color: "#6B7280", marginTop: 3, fontStyle: "italic" }}>{e.note as string}</div> : null}
                </td>
              </tr>
            ))}
          </table>
        </section>
      )}

      {/* Evidence */}
      {evidence.length > 0 && (
        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 14, textTransform: "uppercase", letterSpacing: "0.1em", borderBottom: "1px solid #E5E7EB", paddingBottom: 6, marginBottom: 12 }}>
            Evidence Log ({evidence.length})
          </h2>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            {evidence.map((e, i) => (
              <tr key={i} style={{ borderBottom: "1px solid #F2EDE5" }}>
                <td style={{ padding: "7px 0", verticalAlign: "top", width: 60, color: "#C2853A", fontWeight: 700 }}>{e.ref as string}</td>
                <td style={{ padding: "7px 0 7px 12px", verticalAlign: "top" }}>
                  <div style={{ fontWeight: 600 }}>{e.title as string}</div>
                  {e.source_type ? <div style={{ fontSize: 12, color: "#6B7280" }}>{e.source_type as string}</div> : null}
                  {e.summary     ? <div style={{ fontSize: 12, color: "#6B7280", marginTop: 3 }}>{e.summary as string}</div> : null}
                </td>
              </tr>
            ))}
          </table>
        </section>
      )}

      {/* Documents */}
      {documents.length > 0 && (
        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 14, textTransform: "uppercase", letterSpacing: "0.1em", borderBottom: "1px solid #E5E7EB", paddingBottom: 6, marginBottom: 12 }}>
            Documents on File ({documents.length})
          </h2>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            {documents.map((d, i) => (
              <tr key={i} style={{ borderBottom: "1px solid #F2EDE5" }}>
                <td style={{ padding: "6px 0", verticalAlign: "top" }}>{d.filename as string}</td>
                <td style={{ padding: "6px 0", textAlign: "right", color: "#6B7280", width: 80 }}>{fmt(d.created_at)}</td>
                <td style={{ padding: "6px 12px", textAlign: "right", width: 80 }}>
                  <span style={{ fontSize: 11, padding: "2px 6px", borderRadius: 99, background: d.processed ? "#DCFCE7" : "#FDF4E6", color: d.processed ? "#15803D" : "#C2853A" }}>
                    {d.processed ? "Analyzed" : "Pending"}
                  </span>
                </td>
              </tr>
            ))}
          </table>
        </section>
      )}

      {/* Finances */}
      {finances.length > 0 && (
        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 14, textTransform: "uppercase", letterSpacing: "0.1em", borderBottom: "1px solid #E5E7EB", paddingBottom: 6, marginBottom: 12 }}>
            Financial Summary
          </h2>
          <div style={{ display: "flex", gap: 24, marginBottom: 16, fontSize: 13 }}>
            <div><span style={{ color: "#6B7280" }}>Total assets: </span><strong>{money(totalAssets)}</strong></div>
            <div><span style={{ color: "#6B7280" }}>Total debts: </span><strong style={{ color: "#DC2626" }}>{money(totalDebts)}</strong></div>
            <div><span style={{ color: "#6B7280" }}>Net: </span><strong>{money(totalAssets - totalDebts)}</strong></div>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            {finances.map((f, i) => (
              <tr key={i} style={{ borderBottom: "1px solid #F2EDE5" }}>
                <td style={{ padding: "6px 0", width: 80 }}>
                  <span style={{ fontSize: 11, padding: "2px 6px", borderRadius: 99, background: f.category === "Asset" ? "#DCFCE7" : f.category === "Debt" ? "#FEE2E2" : "#F2EDE5", color: f.category === "Asset" ? "#15803D" : f.category === "Debt" ? "#DC2626" : "#6B7280" }}>
                    {f.category as string}
                  </span>
                </td>
                <td style={{ padding: "6px 12px" }}>{f.description as string}</td>
                <td style={{ padding: "6px 0", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{money(f.amount)}</td>
              </tr>
            ))}
          </table>
        </section>
      )}

      {/* Tasks */}
      {tasks.length > 0 && (
        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 14, textTransform: "uppercase", letterSpacing: "0.1em", borderBottom: "1px solid #E5E7EB", paddingBottom: 6, marginBottom: 12 }}>
            Tasks
          </h2>
          {["todo", "inprogress", "done"].map(col => {
            const colTasks = tasks.filter(t => t.col === col);
            if (!colTasks.length) return null;
            return (
              <div key={col} style={{ marginBottom: 12 }}>
                <p style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "#6B7280", margin: "0 0 6px" }}>
                  {col === "todo" ? "To Do" : col === "inprogress" ? "In Progress" : "Done"}
                </p>
                {colTasks.map((t, i) => (
                  <div key={i} style={{ fontSize: 13, padding: "4px 0", display: "flex", gap: 8 }}>
                    <span>{col === "done" ? "✓" : "○"}</span>
                    <span style={{ textDecoration: col === "done" ? "line-through" : "none", color: col === "done" ? "#9CA3AF" : "#111827" }}>{t.title as string}</span>
                  </div>
                ))}
              </div>
            );
          })}
        </section>
      )}

      {/* Deadlines */}
      {deadlines.filter(d => !d.completed).length > 0 && (
        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 14, textTransform: "uppercase", letterSpacing: "0.1em", borderBottom: "1px solid #E5E7EB", paddingBottom: 6, marginBottom: 12 }}>
            Upcoming Deadlines
          </h2>
          {deadlines.filter(d => !d.completed).map((d, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #F2EDE5", fontSize: 13 }}>
              <span>{d.label as string}</span>
              <span style={{ color: "#6B7280", fontVariantNumeric: "tabular-nums" }}>{fmt(d.date)}</span>
            </div>
          ))}
        </section>
      )}

      {/* Notes */}
      {caseNotes && (
        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 14, textTransform: "uppercase", letterSpacing: "0.1em", borderBottom: "1px solid #E5E7EB", paddingBottom: 6, marginBottom: 12 }}>
            Notes
          </h2>
          <div style={{ fontSize: 13, whiteSpace: "pre-wrap", lineHeight: 1.7 }}>{caseNotes}</div>
        </section>
      )}

      {/* Footer */}
      <div style={{ borderTop: "1px solid #E5E7EB", paddingTop: 16, marginTop: 40, fontSize: 11, color: "#9CA3AF", textAlign: "center" }}>
        Generated by Vera — veracase.app · Not legal advice · {generated}
      </div>
    </div>
  );
}
