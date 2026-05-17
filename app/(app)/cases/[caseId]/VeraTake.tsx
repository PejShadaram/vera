"use client";

import { useState, useEffect } from "react";

interface Analysis {
  summary:      string;
  observations: string[];
  gaps:         string[];
  next:         string;
}

function Skeleton() {
  return (
    <div className="animate-pulse space-y-3">
      <div className="h-3 rounded-full w-3/4" style={{ background: "var(--vera-border)" }} />
      <div className="h-3 rounded-full w-full"  style={{ background: "var(--vera-border)" }} />
      <div className="h-3 rounded-full w-5/6"   style={{ background: "var(--vera-border)" }} />
      <div className="h-3 rounded-full w-2/3"   style={{ background: "var(--vera-border)" }} />
    </div>
  );
}

export default function VeraTake({ caseId, isUnlocked }: { caseId: string; isUnlocked: boolean }) {
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading]   = useState(isUnlocked);
  const [error, setError]       = useState("");
  const [refreshing, setRefreshing] = useState(false);

  async function load(bust = false) {
    if (bust) setRefreshing(true); else setLoading(true);
    setError("");
    try {
      const url = bust
        ? `/api/cases/${caseId}/analysis?bust=${Date.now()}`
        : `/api/cases/${caseId}/analysis`;
      const res  = await fetch(url);
      const data = await res.json() as Analysis & { error?: string };
      if (data.error) throw new Error(data.error);
      setAnalysis(data);
    } catch (e) {
      setError("Analysis unavailable — try refreshing.");
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { if (isUnlocked) load(); }, [caseId, isUnlocked]);

  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: "2px solid #E8D5B0", background: "var(--vera-surface)", boxShadow: "0 2px 12px rgba(194,133,58,0.10)" }}>

      {/* Header */}
      <div className="px-5 py-4 flex items-center justify-between border-b"
        style={{ borderColor: "#E8D5B0", background: "linear-gradient(135deg, #FDF4E6 0%, #FAF0DC 100%)" }}>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full animate-pulse flex-shrink-0" style={{ background: "var(--vera-accent)" }} />
          </div>
          <div>
            <span className="text-sm font-bold tracking-tight" style={{ color: "var(--vera-text)" }}>Vera&apos;s Take</span>
            <span className="text-xs ml-2" style={{ color: "var(--vera-muted)" }}>reads your full case file</span>
          </div>
        </div>
        <button
          onClick={() => load(true)}
          disabled={refreshing || loading}
          className="text-xs font-medium transition-colors disabled:opacity-40 flex items-center gap-1"
          style={{ color: "var(--vera-accent)" }}>
          <svg className={`h-3 w-3 ${refreshing ? "animate-spin" : ""}`} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M14 8A6 6 0 1 1 8 2"/>
            <path d="M14 2v6h-6"/>
          </svg>
          {refreshing ? "Updating…" : "Refresh"}
        </button>
      </div>

      <div className="px-5 py-4 space-y-4">
        {!isUnlocked ? (
          <p className="text-sm" style={{ color: "var(--vera-subtle)" }}>
            Unlock AI for this case to see Vera&apos;s analysis, observations, and recommended next steps.
          </p>
        ) : loading ? (
          <Skeleton />
        ) : error ? (
          <p className="text-sm" style={{ color: "var(--vera-subtle)" }}>{error}</p>
        ) : !analysis ? null : (
          <>
            {/* Summary */}
            <p className="text-sm leading-relaxed" style={{ color: "var(--vera-text)" }}>{analysis.summary}</p>

            {/* Observations + Gaps side by side on desktop */}
            <div className="grid sm:grid-cols-2 gap-3">

              {analysis.observations?.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "var(--vera-subtle)" }}>
                    What I notice
                  </p>
                  <ul className="space-y-2">
                    {analysis.observations.map((obs, i) => (
                      <li key={i} className="flex gap-2 text-xs leading-relaxed">
                        <span className="mt-0.5 flex-shrink-0 h-1.5 w-1.5 rounded-full" style={{ background: "var(--vera-accent)" }} />
                        <span style={{ color: "var(--vera-text)" }}>{obs}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {analysis.gaps?.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "var(--vera-subtle)" }}>
                    What may be missing
                  </p>
                  <ul className="space-y-2">
                    {analysis.gaps.map((gap, i) => (
                      <li key={i} className="flex gap-2 text-xs leading-relaxed">
                        <span className="mt-0.5 flex-shrink-0" style={{ color: "#DC2626" }}>○</span>
                        <span style={{ color: "var(--vera-text)" }}>{gap}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Next step */}
            {analysis.next && (
              <div className="rounded-xl px-4 py-3 flex gap-3 items-start"
                style={{ background: "var(--vera-accent-light)", border: "1px solid #E8D5B0" }}>
                <span className="text-[11px] font-bold uppercase tracking-widest flex-shrink-0 mt-0.5" style={{ color: "var(--vera-accent)" }}>
                  Next
                </span>
                <p className="text-sm leading-relaxed" style={{ color: "var(--vera-text)" }}>{analysis.next}</p>
              </div>
            )}

            <p className="text-[11px]" style={{ color: "var(--vera-subtle)" }}>
              Vera is not an attorney. This is not legal advice — it is an AI reading your case file.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
