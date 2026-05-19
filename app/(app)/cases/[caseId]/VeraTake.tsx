"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface Analysis {
  summary:      string;
  observations: string[];
  gaps:         string[];
  next:         string;
  unlocked?:    boolean;
  obsCount?:    number;
  gapsCount?:   number;
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
      {/* Blurred preview — gives a real sense of what's inside */}
      <div className="space-y-4 select-none pointer-events-none" style={{ filter: "blur(6px)", opacity: 0.4 }}>
        <p className="text-sm leading-relaxed" style={{ color: "var(--vera-text)" }}>
          Based on your case details, Vera has identified patterns in the timeline that are likely to affect your position at the next hearing. The most significant issue is
        </p>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "var(--vera-subtle)" }}>What I notice</p>
            <ul className="space-y-2">
              {["Your strongest argument centers on the documented pattern of…", "The timeline shows a clear sequence beginning with…", "There is direct evidence supporting your position on…"].map((o, i) => (
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
              {["Corroborating documentation for the key incident on…", "A written record showing notice was given before…", "Financial evidence that contradicts the opposing party's…"].map((g, i) => (
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
          <p className="text-sm" style={{ color: "var(--vera-text)" }}>Your most urgent action before the hearing is to secure the missing documentation for…</p>
        </div>
      </div>

      {/* Overlay — milestone framing, not a gate */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 rounded-xl px-6"
        style={{ background: "rgba(250,247,242,0.82)", backdropFilter: "blur(3px)" }}>
        <div className="text-center space-y-1">
          <p className="text-sm font-bold" style={{ color: "var(--vera-text)" }}>
            Vera has analyzed your case
          </p>
          <p className="text-xs leading-relaxed" style={{ color: "var(--vera-muted)" }}>
            Unlock to see what she found — strengths, gaps, and your most urgent next action.
          </p>
        </div>
        <button onClick={unlock} disabled={loading}
          className="flex items-center gap-2 text-sm font-bold px-6 py-2.5 rounded-xl transition-colors disabled:opacity-50"
          style={{ background: "var(--vera-accent)", color: "#fff" }}>
          <LockIcon />
          {loading ? "Redirecting…" : "Unlock full analysis — $49"}
        </button>
        <p className="text-[11px]" style={{ color: "var(--vera-subtle)" }}>One-time · No subscription · Includes Ask Vera + document processing</p>
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

  const obsCount  = analysis.obsCount  ?? analysis.observations?.length ?? 0;
  const gapsCount = analysis.gapsCount ?? analysis.gaps?.length         ?? 0;

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
        One-time · No subscription · Includes Ask Vera + unlimited document processing
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

export default function VeraTake({ caseId, isUnlocked, autoExpand = false }: { caseId: string; isUnlocked: boolean; autoExpand?: boolean }) {
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading]   = useState(isUnlocked);
  const [error, setError]       = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded] = useState(autoExpand);

  const storageKey = `vera_take_${caseId}`;
  useEffect(() => {
    if (autoExpand) return; // don't override auto-expand from localStorage
    try { if (localStorage.getItem(storageKey) === "1") setExpanded(true); } catch { /* ignore */ }
  }, [storageKey, autoExpand]);

  function toggle() {
    const next = !expanded;
    setExpanded(next);
    try { localStorage.setItem(storageKey, next ? "1" : "0"); } catch { /* ignore */ }
  }

  async function load(mode: "init" | "bust" | "force" = "init") {
    if (mode !== "init") setRefreshing(true); else setLoading(true);
    setError("");
    try {
      const url = mode === "force"
        ? `/api/cases/${caseId}/analysis?force=1`
        : mode === "bust"
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

  useEffect(() => { load("init"); }, [caseId]);

  useEffect(() => {
    function handleUpdate() { load("bust"); }
    window.addEventListener("vera:case-updated", handleUpdate);
    return () => window.removeEventListener("vera:case-updated", handleUpdate);
  }, [caseId]);

  const showPartial = analysis && !analysis.unlocked;
  const showFull    = analysis && analysis.unlocked;

  // Preview text shown when collapsed
  const preview = showFull || showPartial
    ? analysis.summary
    : error
    ? error
    : loading
    ? "Analyzing your case…"
    : "Upload a document to get started.";

  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: "2px solid #E8D5B0", background: "var(--vera-surface)", boxShadow: "0 2px 12px rgba(194,133,58,0.10)" }}>

      {/* Header — always visible, click to toggle */}
      <div onClick={toggle} className="px-5 py-3.5 flex items-center justify-between border-b cursor-pointer select-none"
        style={{ borderColor: expanded ? "#E8D5B0" : "transparent", background: "linear-gradient(135deg, #FDF4E6 0%, #FAF0DC 100%)" }}>
        <div className="flex items-center gap-3 min-w-0">
          <span className="h-2 w-2 rounded-full flex-shrink-0 animate-pulse" style={{ background: "var(--vera-accent)" }} />
          <span className="text-sm font-bold tracking-tight flex-shrink-0" style={{ color: "var(--vera-text)" }}>Vera&apos;s Take</span>
          {!expanded && (
            <span className="text-xs truncate min-w-0" style={{ color: "var(--vera-muted)" }}>{preview}</span>
          )}
        </div>
        <div className="flex items-center gap-3 flex-shrink-0 ml-3">
          {expanded && (isUnlocked || analysis) && (
            <button onClick={e => { e.stopPropagation(); load("force"); }} disabled={refreshing || loading}
              className="text-xs font-medium transition-colors disabled:opacity-40 flex items-center gap-1"
              style={{ color: "var(--vera-accent)" }}>
              <svg className={`h-3 w-3 ${refreshing ? "animate-spin" : ""}`} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M14 8A6 6 0 1 1 8 2"/><path d="M14 2v6h-6"/>
              </svg>
              {refreshing ? "Updating…" : "Refresh"}
            </button>
          )}
          <svg className={`h-4 w-4 flex-shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`}
            viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
            style={{ color: "var(--vera-muted)" }}>
            <path d="M2 4l4 4 4-4"/>
          </svg>
        </div>
      </div>

      {/* Expandable content */}
      {expanded && (
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
      )}
    </div>
  );
}
