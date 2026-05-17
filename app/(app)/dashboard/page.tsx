import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import sql from "@/lib/db";

export const dynamic = "force-dynamic";

const TYPE_LABELS: Record<string, string> = {
  divorce:         "Divorce",
  custody:         "Child Custody",
  landlord_tenant: "Landlord / Tenant",
  employment:      "Employment",
  small_claims:    "Small Claims",
  other:           "Other",
};

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ unlocked?: string }> }) {
  const { unlocked } = await searchParams;
  let userId: string | null = null;
  let cases: Record<string, unknown>[] = [];

  try {
    const authResult = await auth();
    userId = authResult.userId;
    if (userId) {
      cases = await sql`SELECT * FROM cases WHERE user_id = ${userId} ORDER BY created_at DESC`;
    }
  } catch (e: unknown) {
    return (
      <div className="p-5 rounded-2xl text-sm" style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#B91C1C" }}>
        <p className="font-semibold mb-1">Something went wrong</p>
        <pre className="whitespace-pre-wrap text-xs opacity-70">{String(e)}</pre>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {unlocked === "1" && (
        <div className="rounded-2xl px-5 py-4 flex items-center gap-3"
          style={{ background: "#DCFCE7", border: "1px solid #BBF7D0" }}>
          <span className="text-lg">🔓</span>
          <div>
            <p className="text-sm font-semibold" style={{ color: "#15803D" }}>AI unlocked</p>
            <p className="text-xs" style={{ color: "#16A34A" }}>Document processing, Vera&apos;s Take, Ask Vera, and AI drafts are all active on your case.</p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--vera-text)" }}>Your Cases</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--vera-muted)" }}>Manage and track your legal matters.</p>
        </div>
        <Link href="/cases/new"
          className="text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
          style={{ background: "var(--vera-accent)", color: "#fff" }}>
          + New case
        </Link>
      </div>

      {cases.length === 0 ? (
        <div className="rounded-2xl p-16 text-center border-2 border-dashed" style={{ borderColor: "var(--vera-border)" }}>
          <p className="text-4xl mb-4">⚖️</p>
          <p className="text-lg font-semibold mb-1" style={{ color: "var(--vera-text)" }}>No cases yet</p>
          <p className="text-sm mb-6" style={{ color: "var(--vera-muted)" }}>Start by creating your first case.</p>
          <Link href="/cases/new"
            className="text-sm font-semibold px-6 py-2.5 rounded-xl transition-colors"
            style={{ background: "var(--vera-accent)", color: "#fff" }}>
            + Start a new case
          </Link>
        </div>
      ) : (
        <div className="grid gap-2.5">
          {cases.map((c) => (
            <Link key={c.id as string} href={`/cases/${c.id}`}
              className="flex items-center gap-4 px-5 py-4 rounded-2xl transition-all group"
              style={{ background: "var(--vera-surface)", border: "1px solid var(--vera-border)", boxShadow: "0 1px 3px rgba(28,25,23,0.05)" }}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2.5 mb-0.5">
                  <p className="font-semibold truncate" style={{ color: "var(--vera-text)" }}>{c.name as string}</p>
                  <span className="flex-shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: "var(--vera-accent-light)", color: "var(--vera-accent)" }}>
                    {TYPE_LABELS[c.case_type as string] ?? "Other"}
                  </span>
                </div>
                <p className="text-sm" style={{ color: "var(--vera-subtle)" }}>
                  {c.opposing_party ? `vs. ${c.opposing_party as string}` : ""}
                  {c.jurisdiction ? ` · ${c.jurisdiction as string}` : ""}
                </p>
              </div>
              <svg className="h-4 w-4 flex-shrink-0 transition-transform group-hover:translate-x-0.5" style={{ color: "var(--vera-subtle)" }}
                viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M6 12l4-4-4-4"/>
              </svg>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
