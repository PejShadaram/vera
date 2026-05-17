"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface Analysis {
  summary:      string;
  observations: string[];
  gaps:         string[];
  next:         string;
  unlocked?:    boolean;
}

function LockIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="7" width="10" height="8" rx="1.5"/>
      <path d="M5 7V5a3 3 0 0 1 6 0v2"/>
    </svg>
  );
}

function LockedTake({ caseId }: { caseId: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function unlock() {
    setLoading(true);
    const res = await fetch("/api/stripe/checkout", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ caseId }),
    });
    const { url } = await res.json() as { url?: string };
    if (url) router.push(url);
    else setLoading(false);
  }

  return (
    <div className="relative rounded-xl overflow-hidden">
      <div className="space-y-4 select-none pointer-events-none" style={{ filter: "blur(5px)", opacity: 0.35 }}>
        <p className="text-sm leading-relaxed" style={{ color: "var(--vera-text)" }}>
          Based on your case file, there are several patterns and critical gaps that will affect your position at the next hearing. The opposing party has a documented history of...
        </p>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "var(--vera-subtle)" }}>What I notice</p>
            <ul className="space-y-2">
              {["Your strongest evidence is the...", "There is a clear pattern of delayed...", "The timeline supports your position on..."].map((o, i) => (
                <li key={i} className="flex gap-2 text-xs leading-relaxed">
                  <span className="mt-0.5 h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ background: "var(--vera-accent)" }} />
                  <span style={{ color: "var(--vera-text)" }}>{o}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "var(--vera-subtle)" }}>What may be missing</p>
            <ul className="space-y-2">
              {["Financial disclosures for the past...", "Corroborating evidence for the incident on...", "Written notice required before..."].map((g, i) => (
                <li key={i} className="flex gap-2 text-xs leading-relaxed">
                  <span className="mt-0.5 flex-shrink-0" style={{ color: "#DC2626" }}>○</span>
                  <span style={{ color: "var(--vera-text)" }}>{g}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="rounded-xl px-4 py-3 flex gap-3" style={{ background: "var(--vera-accent-light)", border: "1px solid #E8D5B0" }}>
          <span className="text-[11px] font-bold uppercase tracking-widest flex-shrink-0" style={{ color: "var(--vera-accent)" }}>Next</span>
          <p className="text-sm" style={{ color: "var(--vera-text)" }}>Your most urgent action is to file the financial disclosure before the deadline...</p>
        </div>
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-xl"
        style={{ background: "rgba(250,247,242,0.7)", backdropFilter: "blur(2px)" }}>
        <p className="text-sm font-semibold text-center px-4" style={{ color: "var(--vera-text)" }}>
          Process a document to see Vera&apos;s analysis of your case
        </p>
        <p className="text-xs text-center px-6" style={{ color: "var(--vera-muted)" }}>
          Upload a document and hit Process — Vera reads it and tells you what she sees
        </p>
      </div>
    </div>
  );
}

function PartialTake({ analysis, caseId }: { analysis: Analysis; caseId: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function unlock() {
    setLoading(true);
    const res = await fetch("/api/stripe/checkout", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ caseId }),
    });
    const { url } = await res.json() as { url?: string };
    if (url) router.push(url);
    else setLoading(false);
  }

  const obsCount  = analysis.observations?.length ?? 0;
  const gapsCount = analysis.gaps?.length ?? 0;

  return (
    <div className="space-y-4">
      {/* Real summary — fully visible */}
      <p className="text-sm leading-relaxed" style={{ color: "var(--vera-text)" }}>{analysis.summary}</p>

      {/* Locked sections — counts visible, content locked */}
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="rounded-xl p-4 space-y-2" style={{ background: "var(--vera-cream)", border: "1px solid var(--vera-border)" }}>
          <div className="flex items-center gap-2">
            <LockIcon />
            <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "var(--vera-subtle)" }}>What I notice</p>
          </div>
          <p className="text-xs" style={{ color: "var(--vera-muted)" }}>
            {obsCount} observation{obsCount !== 1 ? "s" : ""} about your case — unlock to read
          </p>
        </div>
        <div className="rounded-xl p-4 space-y-2" style={{ background: "var(--vera-cream)", border: "1px solid var(--vera-border)" }}>
          <div className="flex items-center gap-2">
            <LockIcon />
            <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "var(--vera-subtle)" }}>What may be missing</p>
          </div>
          <p className="text-xs" style={{ color: "var(--vera-muted)" }}>
            {gapsCount} gap{gapsCount !== 1 ? "s" : ""} identified in your case file — unlock to read
          </p>
        </div>
      </div>

      {/* Locked next step */}
      <div className="rounded-xl px-4 py-3 flex items-center gap-3" style={{ background: "var(--vera-accent-light)", border: "1px solid #E8D5B0" }}>
        <LockIcon />
        <p className="text-sm font-medium" style={{ color: "var(--vera-accent)" }}>
          Your most urgent next action is identified — unlock to see it
        </p>
      </div>

      {/* Unlock CTA */}
      <button onClick={unlock} disabled={loading}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-colors disabled:opacity-50"
        style={{ background: "var(--vera-accent)", color: "#fff" }}>
        <LockIcon />
        {loading ? "Redirecting…" : `Unlock full analysis — $49`}
      </button>
      <p className="text-[11px] text-center" style={{ color: "var(--vera-subtle)" }}>
        One-time · No subscription · Includes Ask Vera, AI drafts, and unlimited document processing
      </p>
    </div>
  );
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
      if (res.status === 403) { setLoading(false); setRefreshing(false); return; }
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

  // Load analysis if unlocked OR if they have processed docs (free partial view)
  useEffect(() => { load(); }, [caseId]);

  const showPartial = analysis && !analysis.unlocked;
  const showFull    = analysis && analysis.unlocked;

  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: "2px solid #E8D5B0", background: "var(--vera-surface)", boxShadow: "0 2px 12px rgba(194,133,58,0.10)" }}>

      {/* Header */}
      <div className="px-5 py-4 flex items-center justify-between border-b"
        style={{ borderColor: "#E8D5B0", background: "linear-gradient(135deg, #FDF4E6 0%, #FAF0DC 100%)" }}>
        <div className="flex items-center gap-3">
          <span className="h-2.5 w-2.5 rounded-full animate-pulse flex-shrink-0" style={{ background: "var(--vera-accent)" }} />
          <div>
            <span className="text-sm font-bold tracking-tight" style={{ color: "var(--vera-text)" }}>Vera&apos;s Take</span>
            <span className="text-xs ml-2" style={{ color: "var(--vera-muted)" }}>reads your full case file</span>
          </div>
        </div>
        {(isUnlocked || analysis) && (
          <button onClick={() => load(true)} disabled={refreshing || loading}
            className="text-xs font-medium transition-colors disabled:opacity-40 flex items-center gap-1"
            style={{ color: "var(--vera-accent)" }}>
            <svg className={`h-3 w-3 ${refreshing ? "animate-spin" : ""}`} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M14 8A6 6 0 1 1 8 2"/><path d="M14 2v6h-6"/>
            </svg>
            {refreshing ? "Updating…" : "Refresh"}
          </button>
        )}
      </div>

      <div className="px-5 py-4 space-y-4">
        {loading ? (
          <Skeleton />
        ) : error ? (
          <p className="text-sm" style={{ color: "var(--vera-subtle)" }}>{error}</p>
        ) : showFull ? (
          <>
            <p className="text-sm leading-relaxed" style={{ color: "var(--vera-text)" }}>{analysis.summary}</p>
            <div className="grid sm:grid-cols-2 gap-3">
              {analysis.observations?.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "var(--vera-subtle)" }}>What I notice</p>
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
                  <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "var(--vera-subtle)" }}>What may be missing</p>
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
            {analysis.next && (
              <div className="rounded-xl px-4 py-3 flex gap-3 items-start" style={{ background: "var(--vera-accent-light)", border: "1px solid #E8D5B0" }}>
                <span className="text-[11px] font-bold uppercase tracking-widest flex-shrink-0 mt-0.5" style={{ color: "var(--vera-accent)" }}>Next</span>
                <p className="text-sm leading-relaxed" style={{ color: "var(--vera-text)" }}>{analysis.next}</p>
              </div>
            )}
            <p className="text-[11px]" style={{ color: "var(--vera-subtle)" }}>
              Vera is not an attorney. This is not legal advice — it is an AI reading your case file.
            </p>
          </>
        ) : showPartial ? (
          <PartialTake analysis={analysis} caseId={caseId} />
        ) : (
          <LockedTake caseId={caseId} />
        )}
      </div>
    </div>
  );
}
