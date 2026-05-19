import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import sql from "@/lib/db";
import BundleCheckoutButton from "./BundleCheckoutButton";

export const dynamic = "force-dynamic";

const TYPE_LABELS: Record<string, string> = {
  divorce:         "Divorce",
  custody:         "Child Custody",
  landlord_tenant: "Landlord / Tenant",
  employment:      "Employment",
  small_claims:    "Small Claims",
  other:           "Other",
};

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ unlocked?: string; bundle?: string; bundle_success?: string }> }) {
  const { unlocked, bundle, bundle_success } = await searchParams;
  let userId: string | null = null;
  let cases: Record<string, unknown>[] = [];
  let bundleCredits = 0;

  try {
    const authResult = await auth();
    userId = authResult.userId;
    if (userId) {
      [cases] = await Promise.all([
        sql`SELECT * FROM cases WHERE user_id = ${userId} ORDER BY created_at DESC`,
      ]);
      const [creditRow] = await sql`SELECT COUNT(*) AS n FROM purchases WHERE user_id = ${userId} AND tier = 'case_unlock' AND case_id IS NULL`;
      bundleCredits = Number(creditRow?.n ?? 0);
    }
  } catch (e: unknown) {
    console.error("[dashboard] load error:", e);
    return (
      <div className="p-5 rounded-2xl text-sm" style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#B91C1C" }}>
        <p className="font-semibold mb-1">Something went wrong loading your dashboard</p>
        <p className="text-xs opacity-70">Please refresh the page. If this keeps happening, contact support@veracase.app</p>
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
      {bundle_success === "1" && (
        <div className="rounded-2xl px-5 py-4 flex items-center gap-3"
          style={{ background: "#DCFCE7", border: "1px solid #BBF7D0" }}>
          <span className="text-lg">🎟</span>
          <div>
            <p className="text-sm font-semibold" style={{ color: "#15803D" }}>Bundle purchased — 2 AI credits ready</p>
            <p className="text-xs" style={{ color: "#16A34A" }}>Open any case and click &quot;Unlock AI&quot; — your credit will apply automatically. No additional payment needed.</p>
          </div>
        </div>
      )}
      {bundle === "1" && (
        <div className="rounded-2xl px-5 py-5 flex flex-col sm:flex-row sm:items-center gap-4"
          style={{ background: "linear-gradient(135deg, #FDF4E6 0%, #FAF0DC 100%)", border: "2px solid #E8D5B0" }}>
          <div className="flex-1 min-w-0">
            <p className="text-base font-bold tracking-tight" style={{ color: "var(--vera-text)" }}>2-Case Bundle — $79 <span className="text-sm font-normal ml-1" style={{ color: "var(--vera-accent)" }}>Save $19</span></p>
            <p className="text-sm mt-0.5" style={{ color: "var(--vera-muted)" }}>Unlock AI on any 2 cases — now or later. Credits apply automatically when you click Unlock on any case.</p>
          </div>
          <BundleCheckoutButton />
        </div>
      )}
      {bundleCredits > 0 && (
        <div className="rounded-2xl px-5 py-3 flex items-center gap-3"
          style={{ background: "#FDF4E6", border: "1px solid #E8D5B0" }}>
          <span style={{ color: "var(--vera-accent)", fontSize: 18 }}>🎟</span>
          <p className="text-sm" style={{ color: "var(--vera-text)" }}>
            <span className="font-semibold">{bundleCredits} AI unlock {bundleCredits === 1 ? "credit" : "credits"} remaining</span>
            <span style={{ color: "var(--vera-muted)" }}> — open any case and click Unlock AI to use {bundleCredits === 1 ? "it" : "one"}.</span>
          </p>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--vera-text)" }}>Your Cases</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--vera-muted)" }}>Manage and track your legal matters.</p>
        </div>
        <Link href="/cases/new"
          className="text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors min-h-[44px] inline-flex items-center"
          style={{ background: "var(--vera-accent)", color: "#fff" }}>
          + New case
        </Link>
      </div>

      {cases.length === 0 ? (
        <div className="rounded-2xl px-6 py-12 sm:p-16 text-center border-2 border-dashed" style={{ borderColor: "var(--vera-border)" }}>
          <p className="text-4xl mb-4">⚖️</p>
          <p className="text-lg font-semibold mb-1" style={{ color: "var(--vera-text)" }}>No cases yet</p>
          <p className="text-sm mb-6" style={{ color: "var(--vera-muted)" }}>Tell Vera what you&apos;re dealing with — it takes about 60 seconds to get your case set up.</p>
          <Link href="/cases/new"
            className="text-sm font-semibold px-6 py-2.5 rounded-xl transition-colors inline-flex items-center min-h-[44px]"
            style={{ background: "var(--vera-accent)", color: "#fff" }}>
            + Start a new case
          </Link>
        </div>
      ) : (
        <div className="grid gap-2.5">
          {cases.map((c) => (
            <Link key={c.id as string} href={`/cases/${c.id}`}
              className="flex items-center gap-4 px-5 py-4 rounded-2xl transition-all group"
              style={{ background: "var(--vera-surface)", border: "1px solid var(--vera-border)", boxShadow: "0 1px 3px rgba(28,25,23,0.05)", opacity: c.status === "closed" ? 0.6 : 1 }}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2.5 mb-0.5">
                  <p className="font-semibold truncate" style={{ color: "var(--vera-text)" }}>{c.name as string}</p>
                  <span className="flex-shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: "var(--vera-accent-light)", color: "var(--vera-accent)" }}>
                    {TYPE_LABELS[c.case_type as string] ?? "Other"}
                  </span>
                  {c.status === "closed" && <span className="flex-shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "#FEE2E2", color: "#DC2626" }}>Closed</span>}
                  {c.status === "on_hold" && <span className="flex-shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "#FEF3C7", color: "#92400E" }}>On Hold</span>}
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
