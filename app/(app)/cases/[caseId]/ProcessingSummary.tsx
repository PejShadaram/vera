"use client";

interface Summary {
  timeline:  { date: string; event: string }[];
  evidence:  { ref: string; title: string; summary: string }[];
  tasks:     { title: string; priority: string }[];
  finances?: { description: string; category: string; amount: number; date: string }[];
}

const PRIORITY_STYLES: Record<string, { bg: string; color: string }> = {
  high:   { bg: "#FEE2E2", color: "#DC2626" },
  medium: { bg: "var(--vera-accent-light)", color: "var(--vera-accent)" },
  low:    { bg: "var(--vera-cream)", color: "var(--vera-muted)" },
};

const fmt = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function ProcessingSummary({
  summary,
  total,
  onDismiss,
}: {
  summary: Summary;
  total: number;
  onDismiss: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: "rgba(28,25,23,0.5)" }}>
      <div className="rounded-2xl w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col"
        style={{ background: "var(--vera-surface)", boxShadow: "0 20px 60px rgba(28,25,23,0.2)" }}>

        {/* Header */}
        <div className="px-5 py-4 border-b flex items-center justify-between"
          style={{ borderColor: "var(--vera-border)", background: "var(--vera-accent-light)" }}>
          <div className="flex items-center gap-3">
            <span className="text-xl font-bold" style={{ color: "var(--vera-accent)" }}>✓</span>
            <div>
              <p className="font-bold" style={{ color: "var(--vera-text)" }}>
                Vera found {total} item{total !== 1 ? "s" : ""}
              </p>
              <p className="text-xs" style={{ color: "var(--vera-muted)" }}>
                Take your time — click "Done" when you're ready to continue.
              </p>
            </div>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1 divide-y" style={{ borderColor: "var(--vera-border)" }}>

          {summary.timeline.length > 0 && (
            <div className="px-5 py-3.5">
              <p className="text-[11px] font-bold uppercase tracking-widest mb-2.5" style={{ color: "var(--vera-subtle)" }}>
                Timeline — {summary.timeline.length} new
              </p>
              <div className="space-y-1.5">
                {summary.timeline.map((e, i) => (
                  <div key={i} className="flex gap-2 text-sm">
                    <span className="tabular-nums flex-shrink-0 w-24" style={{ color: "var(--vera-subtle)" }}>{e.date}</span>
                    <span className="leading-snug" style={{ color: "var(--vera-text)" }}>{e.event}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {summary.evidence.length > 0 && (
            <div className="px-5 py-3.5">
              <p className="text-[11px] font-bold uppercase tracking-widest mb-2.5" style={{ color: "var(--vera-subtle)" }}>
                Evidence — {summary.evidence.length} new
              </p>
              <div className="space-y-2">
                {summary.evidence.map((e, i) => (
                  <div key={i}>
                    <p className="text-sm font-semibold" style={{ color: "var(--vera-text)" }}>{e.ref} — {e.title}</p>
                    {e.summary && (
                      <p className="text-xs mt-0.5 leading-snug line-clamp-3" style={{ color: "var(--vera-muted)" }}>{e.summary}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {summary.tasks.length > 0 && (
            <div className="px-5 py-3.5">
              <p className="text-[11px] font-bold uppercase tracking-widest mb-2.5" style={{ color: "var(--vera-subtle)" }}>
                Tasks — {summary.tasks.length} suggested
              </p>
              <div className="space-y-1.5">
                {summary.tasks.map((t, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
                      style={PRIORITY_STYLES[t.priority] ?? PRIORITY_STYLES.medium}>
                      {t.priority}
                    </span>
                    <span className="text-sm" style={{ color: "var(--vera-text)" }}>{t.title}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(summary.finances?.length ?? 0) > 0 && (
            <div className="px-5 py-3.5">
              <p className="text-[11px] font-bold uppercase tracking-widest mb-2.5" style={{ color: "var(--vera-subtle)" }}>
                Financial items — {summary.finances!.length} extracted
              </p>
              <div className="space-y-1.5">
                {summary.finances!.map((f, i) => (
                  <div key={i} className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate" style={{ color: "var(--vera-text)" }}>{f.description}</span>
                    <span className="font-semibold tabular-nums flex-shrink-0"
                      style={{ color: f.category === "Debt" || f.category === "Expense" ? "#DC2626" : "#15803D" }}>
                      {fmt(f.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {total === 0 && (
            <div className="px-5 py-8 text-center text-sm" style={{ color: "var(--vera-subtle)" }}>
              No new items were extracted. Try a different file or add more context to your case.
            </div>
          )}
        </div>

        {/* Footer — user-controlled dismiss */}
        <div className="px-5 py-4 border-t" style={{ borderColor: "var(--vera-border)" }}>
          <button
            onClick={onDismiss}
            className="w-full py-2.5 rounded-xl text-sm font-semibold transition-colors"
            style={{ background: "var(--vera-accent)", color: "#fff" }}>
            Done — view my case
          </button>
        </div>
      </div>
    </div>
  );
}
