"use client";

interface Summary {
  timeline: { date: string; event: string }[];
  evidence: { ref: string; title: string; summary: string }[];
  tasks:    { title: string; priority: string }[];
}

const PRIORITY_COLOR: Record<string, string> = {
  high:   "bg-red-100 text-red-700",
  medium: "bg-amber-100 text-amber-700",
  low:    "bg-gray-100 text-gray-500",
};

export default function ProcessingSummary({ summary, total }: { summary: Summary; total: number }) {
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 bg-green-50">
          <div className="flex items-center gap-2">
            <span className="text-2xl">✓</span>
            <div>
              <p className="font-bold text-gray-900">Vera found {total} item{total !== 1 ? "s" : ""}</p>
              <p className="text-xs text-gray-500">Reloading your case in a moment…</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 divide-y divide-gray-50">

          {summary.timeline.length > 0 && (
            <div className="px-5 py-3">
              <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-2">
                Timeline — {summary.timeline.length} new
              </p>
              <div className="space-y-1.5">
                {summary.timeline.map((e, i) => (
                  <div key={i} className="flex gap-2 text-sm">
                    <span className="text-gray-400 tabular-nums flex-shrink-0 w-24">{e.date}</span>
                    <span className="text-gray-700 leading-snug">{e.event}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {summary.evidence.length > 0 && (
            <div className="px-5 py-3">
              <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-2">
                Evidence — {summary.evidence.length} new
              </p>
              <div className="space-y-2">
                {summary.evidence.map((e, i) => (
                  <div key={i}>
                    <p className="text-sm font-medium text-gray-900">{e.ref} — {e.title}</p>
                    {e.summary && (
                      <p className="text-xs text-gray-500 mt-0.5 leading-snug line-clamp-3">{e.summary}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {summary.tasks.length > 0 && (
            <div className="px-5 py-3">
              <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-2">
                Tasks — {summary.tasks.length} suggested
              </p>
              <div className="space-y-1.5">
                {summary.tasks.map((t, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${PRIORITY_COLOR[t.priority] ?? PRIORITY_COLOR.medium}`}>
                      {t.priority}
                    </span>
                    <span className="text-sm text-gray-700">{t.title}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {total === 0 && (
            <div className="px-5 py-6 text-center text-sm text-gray-400">
              No new items were extracted from this document. Try a different file or add more context to your case.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
