import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";
import sql from "@/lib/db";
import { isCaseUnlocked } from "@/lib/subscription";
import CaseTabs from "./CaseTabs";
import PrintButton from "./PrintButton";
import FloatingCapture from "./FloatingCapture";
import DeleteCaseButton from "./DeleteCaseButton";
import VeraTake from "./VeraTake";
import UnlockBanner from "./UnlockBanner";
import FirstTimeHint from "./FirstTimeHint";

export const dynamic = "force-dynamic";

const TYPE_LABELS: Record<string, string> = {
  divorce:         "Divorce",
  custody:         "Child Custody",
  landlord_tenant: "Landlord / Tenant",
  employment:      "Employment",
  small_claims:    "Small Claims",
  other:           "Other",
};

function daysUntil(dateVal: unknown): number {
  // Postgres DATE can return as Date object or ISO string — take first 10 chars to get YYYY-MM-DD
  const s = dateVal instanceof Date
    ? dateVal.toISOString().slice(0, 10)
    : String(dateVal).slice(0, 10);
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return -999;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.round((new Date(y, m - 1, d).getTime() - today.getTime()) / 86400000);
}

export default async function CasePage({ params, searchParams }: { params: Promise<{ caseId: string }>; searchParams: Promise<{ unlocked?: string }> }) {
  const { userId } = await auth();
  const { caseId } = await params;
  const { unlocked } = await searchParams;

  const [c] = await sql`SELECT * FROM cases WHERE id = ${caseId} AND user_id = ${userId}`;
  if (!c) notFound();

  const unlockStatus = await isCaseUnlocked(caseId, userId!);

  const [timeline, evidence, documents, tasks, captures, deadlines, finances, noteRow] = await Promise.all([
    sql`SELECT * FROM timeline_entries WHERE case_id = ${caseId} ORDER BY date, created_at`,
    sql`SELECT * FROM evidence WHERE case_id = ${caseId} ORDER BY created_at`,
    sql`SELECT * FROM documents WHERE case_id = ${caseId} ORDER BY created_at DESC`,
    sql`SELECT * FROM tasks WHERE case_id = ${caseId} ORDER BY created_at`,
    sql`SELECT * FROM captures WHERE case_id = ${caseId} ORDER BY created_at DESC LIMIT 50`,
    sql`SELECT * FROM deadlines WHERE case_id = ${caseId} ORDER BY date`,
    sql`SELECT * FROM financial_items WHERE case_id = ${caseId} ORDER BY date DESC, created_at DESC`,
    sql`SELECT content FROM notes WHERE case_id = ${caseId} AND key = '__case_notes__'`,
  ]);
  const caseNotes = (noteRow[0]?.content as string) ?? "";

  // Stats for the overview bar
  const pendingDocs  = documents.filter(d => !d.processed).length;
  const activeTasks  = tasks.filter(t => t.col !== "done").length;
  const nextDeadline = deadlines
    .filter(d => !d.completed)
    .map(d => ({ label: d.label as string, days: daysUntil(d.date as string) }))
    .filter(d => d.days >= 0)
    .sort((a, b) => a.days - b.days)[0];

  return (
    <div className="space-y-5">
      {unlocked === "1" && (
        <div className="rounded-2xl px-5 py-4 flex items-center gap-3" style={{ background: "#DCFCE7", border: "1px solid #BBF7D0" }}>
          <span className="text-lg">🔓</span>
          <div>
            <p className="text-sm font-semibold" style={{ color: "#15803D" }}>AI unlocked for this case</p>
            <p className="text-xs" style={{ color: "#16A34A" }}>Document processing, Vera&apos;s Take, Ask Vera, and AI drafts are all yours.</p>
          </div>
        </div>
      )}
      {!unlockStatus && <UnlockBanner caseId={caseId} />}
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
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
              style={{ background: "var(--vera-accent-light)", color: "var(--vera-accent)" }}>
              {TYPE_LABELS[c.case_type as string] ?? "Other"}
            </span>
            {(c.opposing_party || c.jurisdiction) && (
              <p className="text-sm" style={{ color: "var(--vera-muted)" }}>
                {c.opposing_party ? `vs. ${c.opposing_party as string}` : ""}
                {c.jurisdiction ? ` · ${c.jurisdiction as string}` : ""}
              </p>
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
          <DeleteCaseButton caseId={caseId} caseName={c.name as string} />
        </div>
      </div>

      {/* Stats overview bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <StatCard label="Timeline events" value={String(timeline.length)} />
        <StatCard
          label="Documents"
          value={String(documents.length)}
          sub={pendingDocs > 0 ? `${pendingDocs} pending AI` : "all processed"}
          subUrgent={pendingDocs > 0}
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

      <FirstTimeHint documentCount={documents.length} />

      <VeraTake caseId={caseId} isUnlocked={unlockStatus} />

      <CaseTabs
        caseId={caseId}
        caseType={c.case_type as string}
        caseName={c.name as string}
        caseOpposing={(c.opposing_party as string) ?? ""}
        caseJurisdiction={(c.jurisdiction as string) ?? ""}
        caseCourt={(c.court_name as string) ?? ""}
        caseCaseNumber={(c.case_number as string) ?? ""}
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
      <FloatingCapture caseId={caseId} />
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
