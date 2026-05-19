"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

const S = {
  accent:      "var(--vera-accent)",
  accentLight: "var(--vera-accent-light)",
  border:      "var(--vera-border)",
  text:        "var(--vera-text)",
  muted:       "var(--vera-muted)",
  subtle:      "var(--vera-subtle)",
  surface:     "var(--vera-surface)",
  cream:       "var(--vera-cream)",
};

const card = "rounded-2xl p-5 space-y-1";

function Stat({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: boolean }) {
  return (
    <div className={card} style={{ background: S.surface, border: `1px solid ${S.border}` }}>
      <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: S.subtle }}>{label}</p>
      <p className="text-3xl font-bold tabular-nums" style={{ color: accent ? S.accent : S.text }}>{value}</p>
      {sub && <p className="text-xs" style={{ color: S.muted }}>{sub}</p>}
    </div>
  );
}

interface FunnelStep {
  label: string; n: number; pctOfTop: number; pctOfPrev: number;
}

interface Stats {
  users:   { total: number; last7d: number; last30d: number };
  cases:   { total: number; last7d: number; last30d: number; byType: { case_type: string; n: number }[] };
  revenue: { totalUnlocks: number; last7d: number; totalCents: number };
  recentUnlocks: { created_at: string; amount_cents: number; case_name: string; email: string }[];
  funnel: FunnelStep[];
}

interface Opportunity {
  id: string; subreddit: string; title: string; permalink: string;
  score: number; comments: number; ageHours: number; draftReply: string;
}

interface MarketingData {
  opportunities: Opportunity[];
  scanned: number;
  generatedAt: string;
}

const TYPE_LABELS: Record<string, string> = {
  divorce: "Divorce", custody: "Custody", landlord_tenant: "Landlord/Tenant",
  employment: "Employment", small_claims: "Small Claims", other: "Other",
};

export default function AdminPage() {
  const [stats, setStats]       = useState<Stats | null>(null);
  const [marketing, setMarketing] = useState<MarketingData | null>(null);
  const [tab, setTab]           = useState<"overview" | "marketing">("overview");
  const [statsLoading, setStatsLoading]     = useState(true);
  const [marketingLoading, setMarketingLoading] = useState(false);
  const [statsError, setStatsError]         = useState("");
  const [copied, setCopied]     = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/stats")
      .then(r => r.json())
      .then(d => { if (d.error) setStatsError(d.error); else setStats(d); })
      .catch(() => setStatsError("Failed to load stats"))
      .finally(() => setStatsLoading(false));
  }, []);

  const loadMarketing = useCallback(() => {
    setMarketingLoading(true);
    fetch("/api/admin/marketing")
      .then(r => r.json())
      .then(d => setMarketing(d))
      .catch(() => {})
      .finally(() => setMarketingLoading(false));
  }, []);

  useEffect(() => { if (tab === "marketing" && !marketing) loadMarketing(); }, [tab]);

  function copy(text: string, id: string) {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  }

  const fmt$ = (cents: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(cents / 100);

  if (statsError === "Forbidden") return (
    <div className="py-20 text-center">
      <p className="text-lg font-semibold" style={{ color: S.text }}>Access denied</p>
      <p className="text-sm mt-1" style={{ color: S.muted }}>This page is for Vera admins only.</p>
    </div>
  );

  return (
    <div className="space-y-6 max-w-5xl">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: S.text }}>Admin</h1>
          <p className="text-sm mt-0.5" style={{ color: S.muted }}>veracase.app · internal dashboard</p>
        </div>
        <div className="flex gap-2">
          <a href="https://vercel.com/pejshadarams-projects/vera/analytics" target="_blank"
            className="text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors hover:opacity-80"
            style={{ borderColor: S.border, color: S.muted, background: S.surface }}>
            Vercel Analytics ↗
          </a>
          <a href="https://dashboard.stripe.com/dashboard" target="_blank"
            className="text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors hover:opacity-80"
            style={{ borderColor: S.border, color: S.muted, background: S.surface }}>
            Stripe ↗
          </a>
          <a href="https://github.com/PejShadaram/vera/blob/dev/docs/technical-overview.md" target="_blank"
            className="text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors hover:opacity-80"
            style={{ borderColor: S.border, color: S.muted, background: S.surface }}>
            Tech Docs ↗
          </a>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b" style={{ borderColor: S.border }}>
        {(["overview", "marketing"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className="px-4 pb-3 pt-1 text-sm font-medium border-b-2 -mb-px transition-colors capitalize"
            style={tab === t
              ? { color: S.text, borderColor: S.accent }
              : { color: S.muted, borderColor: "transparent" }}>
            {t}
          </button>
        ))}
      </div>

      {/* Overview tab */}
      {tab === "overview" && (
        <>
          {statsLoading ? (
            <div className="py-12 text-center text-sm" style={{ color: S.subtle }}>Loading stats…</div>
          ) : statsError ? (
            <div className="py-8 text-center text-sm" style={{ color: "#DC2626" }}>{statsError}</div>
          ) : stats ? (
            <>
              {/* Revenue */}
              <div>
                <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: S.subtle }}>Revenue</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <Stat label="Total revenue" value={fmt$(stats.revenue.totalCents)} accent />
                  <Stat label="Total unlocks" value={stats.revenue.totalUnlocks} sub="$49 each" />
                  <Stat label="Unlocks — 7d" value={stats.revenue.last7d} sub={`${fmt$(stats.revenue.last7d * 4900)} this week`} />
                  <Stat label="Avg per day" value={fmt$(stats.revenue.totalCents / Math.max(1, 30))} sub="30-day average" />
                </div>
              </div>

              {/* Conversion funnel */}
              {stats.funnel?.length > 0 && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: S.subtle }}>Conversion funnel</p>
                  <div className="rounded-2xl overflow-hidden" style={{ background: S.surface, border: `1px solid ${S.border}` }}>
                    {stats.funnel.map((step, i) => {
                      const isLast   = i === stats.funnel.length - 1;
                      const barWidth = Math.max(4, step.pctOfTop);
                      const isPaid   = step.label === "Paid";
                      return (
                        <div key={step.label} className="px-5 py-3 border-b last:border-0"
                          style={{ borderColor: S.border }}>
                          <div className="flex items-center justify-between gap-4 mb-1.5">
                            <span className="text-sm font-medium" style={{ color: isPaid ? S.accent : S.text }}>
                              {step.label}
                            </span>
                            <div className="flex items-center gap-3 flex-shrink-0">
                              {i > 0 && (
                                <span className="text-[11px] tabular-nums" style={{ color: step.pctOfPrev < 50 ? "#DC2626" : S.subtle }}>
                                  {step.pctOfPrev}% of prev
                                </span>
                              )}
                              <span className="text-sm font-bold tabular-nums w-8 text-right"
                                style={{ color: isPaid ? S.accent : S.text }}>
                                {step.n}
                              </span>
                            </div>
                          </div>
                          <div className="h-1.5 rounded-full" style={{ background: S.cream }}>
                            <div className="h-1.5 rounded-full transition-all"
                              style={{ width: `${barWidth}%`, background: isPaid ? S.accent : "#E8D5B0" }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-[11px] mt-2" style={{ color: S.subtle }}>
                    Wall hit + checkout data starts accumulating from today. Historical data not backfilled.
                  </p>
                </div>
              )}

              {/* Users & Cases */}
              <div>
                <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: S.subtle }}>Users & Cases</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <Stat label="Total users"   value={stats.users.total}       sub={`+${stats.users.last7d} this week`} />
                  <Stat label="Total cases"   value={stats.cases.total}       sub={`+${stats.cases.last7d} this week`} />
                  <Stat label="Users — 30d"   value={stats.users.last30d}     sub="new signups" />
                  <Stat label="Cases — 30d"   value={stats.cases.last30d}     sub="new cases" />
                </div>
              </div>

              {/* Case types */}
              {stats.cases.byType.length > 0 && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: S.subtle }}>Cases by type</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {stats.cases.byType.map(t => (
                      <div key={t.case_type} className={card} style={{ background: S.surface, border: `1px solid ${S.border}` }}>
                        <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: S.subtle }}>
                          {TYPE_LABELS[t.case_type] ?? t.case_type}
                        </p>
                        <p className="text-2xl font-bold" style={{ color: S.text }}>{Number(t.n)}</p>
                        <p className="text-xs" style={{ color: S.muted }}>
                          {Math.round((Number(t.n) / stats.cases.total) * 100)}% of all cases
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recent unlocks */}
              {stats.recentUnlocks.length > 0 && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: S.subtle }}>Recent unlocks</p>
                  <div className="rounded-2xl overflow-hidden" style={{ background: S.surface, border: `1px solid ${S.border}` }}>
                    {stats.recentUnlocks.map((u, i) => (
                      <div key={i} className="flex items-center gap-4 px-5 py-3 border-b last:border-0"
                        style={{ borderColor: S.border }}>
                        <span className="text-sm font-bold w-16 flex-shrink-0" style={{ color: S.accent }}>
                          {fmt$(u.amount_cents)}
                        </span>
                        <span className="flex-1 text-sm truncate" style={{ color: S.text }}>{u.case_name}</span>
                        <span className="text-xs hidden sm:block truncate max-w-[160px]" style={{ color: S.subtle }}>{u.email}</span>
                        <span className="text-xs flex-shrink-0" style={{ color: S.subtle }}>
                          {new Date(u.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {stats.revenue.totalUnlocks === 0 && (
                <div className="rounded-2xl p-8 text-center" style={{ background: S.accentLight, border: `1px solid #E8D5B0` }}>
                  <p className="text-sm font-semibold mb-1" style={{ color: S.text }}>No revenue yet</p>
                  <p className="text-xs" style={{ color: S.muted }}>
                    Post on r/ProSe and r/Divorce to get your first users. Check the Marketing tab for drafted replies.
                  </p>
                </div>
              )}
            </>
          ) : null}
        </>
      )}

      {/* Marketing tab */}
      {tab === "marketing" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold" style={{ color: S.text }}>Reply opportunities</p>
              <p className="text-xs mt-0.5" style={{ color: S.muted }}>
                {marketing
                  ? `Scanned ${marketing.scanned} subreddits · ${new Date(marketing.generatedAt).toLocaleTimeString()}`
                  : "Scanning Reddit for relevant posts…"}
              </p>
            </div>
            <button onClick={loadMarketing} disabled={marketingLoading}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-40"
              style={{ borderColor: S.border, color: S.muted, background: S.surface }}>
              {marketingLoading ? "Scanning…" : "Refresh"}
            </button>
          </div>

          {marketingLoading && (
            <div className="py-12 text-center space-y-2">
              <p className="text-sm font-medium" style={{ color: S.text }}>Scanning Reddit + drafting replies…</p>
              <p className="text-xs" style={{ color: S.subtle }}>Takes about 30 seconds</p>
            </div>
          )}

          {marketing?.opportunities.length === 0 && (
            <div className="py-8 text-center rounded-2xl" style={{ background: S.cream, border: `1px solid ${S.border}` }}>
              <p className="text-sm" style={{ color: S.muted }}>No relevant posts in the last 48 hours. Check back later.</p>
            </div>
          )}

          {marketing?.opportunities.map(opp => (
            <div key={opp.id} className="rounded-2xl overflow-hidden"
              style={{ background: S.surface, border: `1px solid ${S.border}` }}>
              <div className="px-5 py-3 flex items-start justify-between gap-3 border-b"
                style={{ borderColor: S.border, background: S.cream }}>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                      style={{ background: S.accentLight, color: S.accent }}>
                      r/{opp.subreddit}
                    </span>
                    <span className="text-[11px]" style={{ color: S.subtle }}>
                      {opp.ageHours}h ago · ↑{opp.score} · {opp.comments} comments
                    </span>
                  </div>
                  <p className="text-sm font-semibold truncate" style={{ color: S.text }}>{opp.title}</p>
                </div>
                <a href={opp.permalink} target="_blank"
                  className="flex-shrink-0 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors hover:opacity-80"
                  style={{ borderColor: S.border, color: S.muted, background: S.surface }}>
                  View post ↗
                </a>
              </div>
              <div className="px-5 py-4 space-y-3">
                <p className="text-sm leading-relaxed" style={{ color: S.text }}>{opp.draftReply}</p>
                <button onClick={() => copy(opp.draftReply, opp.id)}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors"
                  style={{ borderColor: S.border, color: copied === opp.id ? "#15803D" : S.muted, background: S.surface }}>
                  {copied === opp.id ? "Copied ✓" : "Copy reply"}
                </button>
              </div>
            </div>
          ))}

          {/* Founder posts */}
          {marketing && (
            <div className="space-y-4">
              <p className="text-xs font-bold uppercase tracking-widest" style={{ color: S.subtle }}>
                Founder posts — post once per community
              </p>
              {[
                {
                  id: "prose",
                  sub: "r/ProSe",
                  title: "I built a free tool for self-represented litigants after going through my own divorce without an attorney",
                  body: `Going through a contested divorce without a lawyer is brutal — not because the law is impossible to navigate, but because staying organized is. Keeping track of 200 emails, 40 documents, a dozen court dates, and a timeline that spans years, all while dealing with the emotional weight of it, is where most people fall apart.\n\nI built Vera (veracase.app) to solve exactly that. It's free to use for case organization — timeline, evidence log, tasks, deadlines. The AI layer (document processing, case analysis, chat about your case) is a one-time $49 unlock per case, no subscription.\n\nIf you're representing yourself and feel buried in paperwork, give it a try.`,
                },
                {
                  id: "divorce",
                  sub: "r/Divorce",
                  title: "Free tool I built for organizing a divorce case when you can't afford a lawyer",
                  body: `After going through a divorce without an attorney, I realized the hardest part wasn't the legal process — it was the organization. Evidence, emails, financial records, court dates, the timeline of what happened when. I was managing all of it in Google Docs and constantly losing track of things.\n\nBuilt Vera (veracase.app) to handle that. Free to organize your case, $49 one-time to unlock AI that reads your documents and tells you what it sees, what's missing, and what to do next.`,
                },
              ].map(p => (
                <div key={p.id} className="rounded-2xl overflow-hidden"
                  style={{ background: S.surface, border: `1px solid ${S.border}` }}>
                  <div className="px-5 py-3 flex items-center justify-between border-b"
                    style={{ borderColor: S.border, background: S.cream }}>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                      style={{ background: S.accentLight, color: S.accent }}>{p.sub}</span>
                    <span className="text-[11px]" style={{ color: S.subtle }}>post once, don&apos;t repeat</span>
                  </div>
                  <div className="px-5 py-4 space-y-3">
                    <p className="text-xs font-semibold" style={{ color: S.muted }}>Title: {p.title}</p>
                    <p className="text-sm leading-relaxed whitespace-pre-line" style={{ color: S.text }}>{p.body}</p>
                    <button onClick={() => copy(`Title: ${p.title}\n\n${p.body}`, p.id)}
                      className="text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors"
                      style={{ borderColor: S.border, color: copied === p.id ? "#15803D" : S.muted, background: S.surface }}>
                      {copied === p.id ? "Copied ✓" : "Copy post"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
