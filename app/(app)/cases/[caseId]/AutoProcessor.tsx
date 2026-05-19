"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface Summary {
  timeline: { date: string; event: string }[];
  evidence:  { ref: string; title: string; summary: string }[];
  tasks:     { title: string; priority: string }[];
}

export default function AutoProcessor({ caseId, isUnlocked, hasPending }: {
  caseId: string; isUnlocked: boolean; hasPending: boolean;
}) {
  const router = useRouter();
  const [phase,   setPhase]   = useState<"processing" | "done" | "error" | "needs-unlock">("processing");
  const [log,     setLog]     = useState("Reading your documents…");
  const [summary, setSummary] = useState<Summary | null>(null);

  useEffect(() => {
    if (!hasPending) return;

    if (!isUnlocked) {
      setPhase("needs-unlock");
      return;
    }

    async function run() {
      try {
        const res = await fetch(`/api/cases/${caseId}/process`, { method: "POST" });
        if (res.status === 403) { setPhase("needs-unlock"); return; }
        if (!res.ok || !res.body) { setPhase("error"); return; }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split("\n"); buf = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            try {
              const ev = JSON.parse(line.slice(6)) as { type: string; message?: string };
              if (ev.type === "progress") setLog(ev.message ?? "");
              if (ev.type === "done") {
                const a = ev as Record<string, unknown>;
                if (a.summary) setSummary(a.summary as Summary);
                setPhase("done");
                window.dispatchEvent(new CustomEvent("vera:case-updated"));
                router.refresh();
              }
              if (ev.type === "error") setPhase("error");
            } catch { /* skip */ }
          }
        }
      } catch { setPhase("error"); }
    }

    void run();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!hasPending && phase !== "done") return null;

  const total = summary ? summary.timeline.length + summary.evidence.length + summary.tasks.length : 0;

  if (phase === "needs-unlock") return null; // UnlockBanner handles this

  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: "2px solid #E8D5B0", background: "var(--vera-surface)" }}>
      {phase === "processing" && (
        <div className="px-5 py-4" style={{ background: "linear-gradient(135deg, #FDF4E6 0%, #FAF0DC 100%)" }}>
          <div className="flex items-center gap-3">
            <div className="flex gap-1">
              {[0, 1, 2].map(i => (
                <span key={i} className="h-1.5 w-1.5 rounded-full animate-bounce"
                  style={{ background: "var(--vera-accent)", animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: "var(--vera-accent)" }}>Vera is reading your documents</p>
              <p className="text-xs mt-0.5" style={{ color: "var(--vera-muted)" }}>{log}</p>
            </div>
          </div>
        </div>
      )}

      {phase === "done" && (
        <div className="px-5 py-4" style={{ background: "linear-gradient(135deg, #FDF4E6 0%, #FAF0DC 100%)" }}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold" style={{ color: "var(--vera-accent)" }}>
                {total > 0 ? `Vera found ${total} item${total !== 1 ? "s" : ""} in your documents` : "Documents processed"}
              </p>
              {summary && total > 0 && (
                <div className="flex gap-3 mt-2 flex-wrap">
                  {summary.timeline.length > 0 && (
                    <span className="text-[11px] px-2 py-0.5 rounded-full font-medium"
                      style={{ background: "#DBEAFE", color: "#1D4ED8" }}>
                      {summary.timeline.length} timeline event{summary.timeline.length !== 1 ? "s" : ""}
                    </span>
                  )}
                  {summary.evidence.length > 0 && (
                    <span className="text-[11px] px-2 py-0.5 rounded-full font-medium"
                      style={{ background: "var(--vera-accent-light)", color: "var(--vera-accent)" }}>
                      {summary.evidence.length} evidence item{summary.evidence.length !== 1 ? "s" : ""}
                    </span>
                  )}
                  {summary.tasks.length > 0 && (
                    <span className="text-[11px] px-2 py-0.5 rounded-full font-medium"
                      style={{ background: "#DCFCE7", color: "#15803D" }}>
                      {summary.tasks.length} task{summary.tasks.length !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {phase === "error" && (
        <div className="px-5 py-3 flex items-center gap-3" style={{ background: "#FEF3C7" }}>
          <span style={{ color: "#92400E" }}>⚠️</span>
          <p className="text-sm" style={{ color: "#78350F" }}>
            Couldn&apos;t process documents automatically.{" "}
            <button onClick={() => window.dispatchEvent(new CustomEvent("vera:open-tab", { detail: "Documents" }))}
              style={{ color: "var(--vera-accent)", background: "none", border: "none", cursor: "pointer", padding: 0, fontWeight: 600, fontSize: "inherit" }}>
              Go to Documents
            </button>{" "}to process manually.
          </p>
        </div>
      )}
    </div>
  );
}
