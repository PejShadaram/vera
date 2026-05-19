"use client";

export default function ReadinessWidget({ hasHearingDate, hasEvidence, hasProcessedDoc, hasTimeline, caseId }: {
  hasHearingDate: boolean; hasEvidence: boolean; hasProcessedDoc: boolean; hasTimeline: boolean; caseId: string;
}) {
  const items = [
    { done: hasTimeline,     label: "Add at least one timeline event",   tab: "Timeline" },
    { done: hasEvidence,     label: "Log a piece of evidence",           tab: "Evidence" },
    { done: hasProcessedDoc, label: "Upload and process a document",     tab: "Documents" },
    { done: hasHearingDate,  label: "Set your hearing date in Settings", tab: "Settings" },
  ];
  if (items.every(i => i.done)) return null;

  return (
    <div className="rounded-xl px-4 py-3.5" style={{ background: "var(--vera-surface)", border: "1px solid var(--vera-border)" }}>
      <p className="text-[11px] font-bold uppercase tracking-widest mb-2.5" style={{ color: "var(--vera-subtle)" }}>
        Strengthen Vera&apos;s analysis
      </p>
      <div className="space-y-1.5">
        {items.map(item => (
          <div key={item.label} className="flex items-center gap-2.5">
            <span className="flex-shrink-0 text-xs" style={{ color: item.done ? "#15803D" : "var(--vera-subtle)" }}>
              {item.done ? "✓" : "○"}
            </span>
            <span className="text-xs flex-1" style={{
              color: item.done ? "var(--vera-subtle)" : "var(--vera-text)",
              textDecoration: item.done ? "line-through" : "none",
            }}>
              {item.label}
            </span>
            {!item.done && (
              <button
                onClick={() => window.dispatchEvent(new CustomEvent("vera:open-tab", { detail: item.tab }))}
                className="text-[11px] font-medium flex-shrink-0"
                style={{ color: "var(--vera-accent)", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                Go →
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
