import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";
import sql from "@/lib/db";
import { isCaseUnlocked, autoApplyBundleCredit } from "@/lib/subscription";
import CaseTabs from "./CaseTabs";
import PrintButton from "./PrintButton";
import FloatingActions from "./FloatingActions";
import VeraTake from "./VeraTake";
import UnlockBanner from "./UnlockBanner";
import UnlockPoller from "./UnlockPoller";
import LinkRelatedCase from "./LinkRelatedCase";
import ReadinessWidget from "./ReadinessWidget";
import AutoProcessor from "./AutoProcessor";

export const dynamic = "force-dynamic";

const TYPE_LABELS: Record<string, string> = {
  divorce:         "Divorce",
  custody:         "Child Custody",
  landlord_tenant: "Landlord / Tenant",
  employment:      "Employment",
  small_claims:    "Small Claims",
  other:           "Other",
};

// Safely format any Postgres date value to YYYY-MM-DD
// Neon returns DATE columns as JS Date objects, not ISO strings
function fmtDate(v: unknown): string {
  if (!v) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).slice(0, 10);
}

function daysUntil(dateVal: unknown): number {
  const s = fmtDate(dateVal);
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return -999;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.round((new Date(y, m - 1, d).getTime() - today.getTime()) / 86400000);
}

export default async function CasePage({ params, searchParams }: { params: Promise<{ caseId: string }>; searchParams: Promise<{ unlocked?: string; autoprocess?: string }> }) {
  const { userId } = await auth();
  const { caseId } = await params;
  const { unlocked, autoprocess } = await searchParams;
  const shouldAutoProcess = autoprocess === "1" || (unlocked === "1");

  const [c] = await sql`SELECT * FROM cases WHERE id = ${caseId} AND user_id = ${userId}`;
  if (!c) notFound();

  let unlockStatus = await isCaseUnlocked(caseId, userId!);
  let creditApplied = false;
  if (!unlockStatus) {
    creditApplied = await autoApplyBundleCredit(caseId, userId!);
    if (creditApplied) unlockStatus = true;
  }

  const [timeline, evidence, documents, tasks, captures, deadlines, finances, noteRow, caseCount, creditRow] = await Promise.all([
    sql`SELECT * FROM timeline_entries WHERE case_id = ${caseId} ORDER BY date DESC, created_at DESC`,
    sql`SELECT * FROM evidence WHERE case_id = ${caseId} ORDER BY created_at`,
    sql`SELECT * FROM documents WHERE case_id = ${caseId} ORDER BY created_at DESC`,
    sql`SELECT * FROM tasks WHERE case_id = ${caseId} ORDER BY created_at`,
    sql`SELECT * FROM captures WHERE case_id = ${caseId} ORDER BY created_at DESC LIMIT 50`,
    sql`SELECT * FROM deadlines WHERE case_id = ${caseId} ORDER BY date`,
    sql`SELECT * FROM financial_items WHERE case_id = ${caseId} ORDER BY date DESC, created_at DESC`,
    sql`SELECT content FROM notes WHERE case_id = ${caseId} AND key = '__case_notes__'`,
    sql`SELECT COUNT(*) AS n FROM cases WHERE user_id = ${userId}`,
    sql`SELECT COUNT(*) AS n FROM purchases WHERE user_id = ${userId} AND tier = 'case_unlock' AND case_id IS NULL`,
  ]);
  const caseNotes = (noteRow[0]?.content as string) ?? "";
  const hasMultipleCases = Number(caseCount[0]?.n ?? 0) > 1;
  const bundleCredits = Number(creditRow[0]?.n ?? 0);

  // Load related cases for header display and chat context
  const relatedIds = (c.related_case_ids as string[]) ?? [];
  const relatedCases = relatedIds.length > 0
    ? await sql`SELECT id, name FROM cases WHERE id = ANY(${relatedIds}::uuid[]) AND user_id = ${userId}`
    : [];

  // Stats for the overview bar
  const pendingDocs  = documents.filter(d => !d.processed).length;
  const failedDocs   = documents.filter(d => d.processing_error).length;
  const activeTasks  = tasks.filter(t => t.col !== "done").length;
  const nextDeadline = deadlines
    .filter(d => !d.completed)
    .map(d => ({ label: d.label as string, days: daysUntil(d.date as string) }))
    .filter(d => d.days >= 0)
    .sort((a, b) => a.days - b.days)[0];

  return (
    <div className="space-y-5">
      {unlocked === "1" && !unlockStatus && <UnlockPoller caseId={caseId} />}
      {unlocked === "1" && unlockStatus && (
        <div className="rounded-2xl px-5 py-4 flex items-center gap-3" style={{ background: "#DCFCE7", border: "1px solid #BBF7D0" }}>
          <span className="text-lg">🔓</span>
          <div>
            <p className="text-sm font-semibold" style={{ color: "#15803D" }}>AI unlocked for this case</p>
            <p className="text-xs" style={{ color: "#16A34A" }}>Document processing, Vera&apos;s Take, Ask Vera, and AI drafts are all yours.</p>
          </div>
        </div>
      )}
      {creditApplied && (
        <div className="rounded-2xl px-5 py-4 flex items-center gap-3" style={{ background: "#DCFCE7", border: "1px solid #BBF7D0" }}>
          <span className="text-lg">🎟️</span>
          <div>
            <p className="text-sm font-semibold" style={{ color: "#15803D" }}>Case credit applied</p>
            <p className="text-xs" style={{ color: "#16A34A" }}>One of your pre-purchased credits was used to unlock AI for this case.</p>
          </div>
        </div>
      )}
      {!unlockStatus && <UnlockBanner caseId={caseId} processedCount={documents.filter(d => d.processed).length} pendingCount={pendingDocs} bundleCredits={bundleCredits} />}
      {shouldAutoProcess && pendingDocs > 0 && (
        <AutoProcessor caseId={caseId} isUnlocked={unlockStatus} hasPending={pendingDocs > 0} />
      )}
      {c.status === "closed" && (
        <div className="rounded-2xl px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3"
          style={{ background: "var(--vera-cream)", border: "1px solid var(--vera-border)" }}>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold" style={{ color: "var(--vera-text)" }}>This case is closed</p>
            <p className="text-xs mt-0.5" style={{ color: "var(--vera-muted)" }}>Your case file is preserved and exportable. If you have a new matter, start a fresh case.</p>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <a href={`/cases/${caseId}/export`} target="_blank"
              className="text-xs font-semibold px-3 py-2 rounded-lg transition-colors hover:opacity-80"
              style={{ border: "1px solid var(--vera-border)", color: "var(--vera-muted)", background: "var(--vera-surface)" }}>
              Export case file
            </a>
            <a href="/cases/new"
              className="text-xs font-semibold px-3 py-2 rounded-lg transition-colors hover:opacity-80"
              style={{ background: "var(--vera-accent)", color: "#fff" }}>
              Start new case
            </a>
          </div>
        </div>
      )}
      {/* Case header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <a href="/dashboard" className="inline-flex items-center gap-1 text-sm mb-2.5 transition-colors hover:opacity-70"
            style={{ color: "var(--vera-subtle)" }}>
            <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M10 4l-4 4 4 4"/>
            </svg>
            All cases
          </a>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--vera-text)" }}>{c.name as string}</h1>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
              style={{ background: "var(--vera-accent-light)", color: "var(--vera-accent)" }}>
              {TYPE_LABELS[c.case_type as string] ?? "Other"}
            </span>
            {c.status === "closed" && (
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "#FEE2E2", color: "#DC2626" }}>Closed</span>
            )}
            {c.status === "on_hold" && (
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "#FEF3C7", color: "#92400E" }}>On Hold</span>
            )}
            {(c.opposing_party || c.jurisdiction) && (
              <p className="text-sm" style={{ color: "var(--vera-muted)" }}>
                {c.opposing_party ? `vs. ${c.opposing_party as string}` : ""}
                {c.jurisdiction ? ` · ${c.jurisdiction as string}` : ""}
              </p>
            )}
            {(c.hearing_date) && (() => {
              const days = daysUntil(c.hearing_date);
              const critical = days >= 0 && days <= 7;
              const warning  = days > 7 && days <= 14;
              const past     = days < 0;
              return (
                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full mt-1"
                  style={{
                    background: past ? "#F2EDE5" : critical ? "#FEE2E2" : warning ? "var(--vera-accent-light)" : "var(--vera-accent-light)",
                    color:      past ? "var(--vera-muted)" : critical ? "#DC2626" : "var(--vera-accent)",
                  }}>
                  ⚖️ {past ? `Hearing was ${fmtDate(c.hearing_date)}` : days === 0 ? "Hearing today" : `Hearing in ${days} day${days !== 1 ? "s" : ""}`}
                </span>
              );
            })()}
            {(relatedCases.length > 0 || hasMultipleCases) && (
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                {relatedCases.length > 0 ? (
                  <>
                    <span className="text-xs" style={{ color: "var(--vera-subtle)" }}>Related:</span>
                    {relatedCases.map(r => (
                      <a key={r.id as string} href={`/cases/${r.id}`}
                        className="text-xs font-medium transition-opacity hover:opacity-70"
                        style={{ color: "var(--vera-accent)" }}>
                        {r.name as string}
                      </a>
                    ))}
                  </>
                ) : (
                  <LinkRelatedCase />
                )}
              </div>
            )}
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-2 flex-shrink-0 self-start pt-0.5">
          <a href={`/cases/${caseId}/export`} target="_blank"
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors hover:opacity-80"
            style={{ border: "1px solid var(--vera-border)", color: "var(--vera-muted)", background: "var(--vera-surface)" }}>
            <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 2h6l3 3v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z"/><path d="M10 2v4h3M6 9h4M6 12h4"/>
            </svg>
            Export
          </a>
          <PrintButton />
        </div>
      </div>

      {/* Stats overview bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <StatCard label="Timeline events" value={String(timeline.length)} />
        <StatCard
          label="Documents"
          value={String(documents.length)}
          sub={failedDocs > 0 ? `${failedDocs} failed` : pendingDocs > 0 ? `${pendingDocs} pending AI` : "all processed"}
          subUrgent={failedDocs > 0 || pendingDocs > 0}
        />
        <StatCard
          label="Active tasks"
          value={String(activeTasks)}
          sub={`${tasks.filter(t => t.col === "done").length} done`}
        />
        <StatCard
          label="Next deadline"
          value={nextDeadline ? (nextDeadline.days === 0 ? "Today" : `${nextDeadline.days}d`) : "None"}
          sub={nextDeadline?.label}
          subUrgent={nextDeadline ? nextDeadline.days <= 3 : false}
          valueUrgent={nextDeadline ? nextDeadline.days <= 7 : false}
        />
      </div>

      <ReadinessWidget
        hasHearingDate={!!c.hearing_date}
        hasEvidence={evidence.length > 0}
        hasProcessedDoc={documents.some(d => d.processed)}
        hasTimeline={timeline.length > 0}
        caseId={caseId}
      />

      <VeraTake caseId={caseId} isUnlocked={unlockStatus} autoExpand={(unlocked === "1" || autoprocess === "1") && unlockStatus} />

      <CaseTabs
        caseId={caseId}
        caseType={c.case_type as string}
        caseName={c.name as string}
        caseOpposing={(c.opposing_party as string) ?? ""}
        caseJurisdiction={(c.jurisdiction as string) ?? ""}
        caseCourt={(c.court_name as string) ?? ""}
        caseCaseNumber={(c.case_number as string) ?? ""}
        caseHearingDate={fmtDate(c.hearing_date)}
        caseStatus={(c.status as string) ?? "active"}
        casePetitionerName={(c.petitioner_name as string) ?? ""}
        relatedCases={relatedCases as Array<{ id: string; name: string }>}
        timeline={timeline}
        evidence={evidence}
        documents={documents}
        tasks={tasks}
        captures={captures}
        deadlines={deadlines}
        finances={finances}
        initialNotes={caseNotes}
        isUnlocked={unlockStatus}
      />
      <FloatingActions caseId={caseId} isUnlocked={unlockStatus} hearingDate={fmtDate(c.hearing_date) || undefined} />
    </div>
  );
}

function StatCard({
  label, value, sub, subUrgent, valueUrgent,
}: {
  label: string;
  value: string;
  sub?: string;
  subUrgent?: boolean;
  valueUrgent?: boolean;
}) {
  return (
    <div className="rounded-xl px-4 py-3" style={{ background: "var(--vera-surface)", border: "1px solid var(--vera-border)", boxShadow: "0 1px 3px rgba(28,25,23,0.05)" }}>
      <p className="text-[11px] font-semibold uppercase tracking-wide mb-1" style={{ color: "var(--vera-subtle)" }}>{label}</p>
      <p className="text-xl font-bold leading-none" style={{ color: valueUrgent ? "var(--vera-accent)" : "var(--vera-text)" }}>{value}</p>
      {sub && (
        <p className="text-[11px] mt-1" style={{ color: subUrgent ? "var(--vera-accent)" : "var(--vera-subtle)" }}>{sub}</p>
      )}
    </div>
  );
}
