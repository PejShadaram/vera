"use client";

import { useState } from "react";

export default function FloatingCapture({ caseId }: { caseId: string }) {
  const [open, setOpen]     = useState(false);
  const [text, setText]     = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);

  async function submit() {
    if (!text.trim()) return;
    setSaving(true);
    const res = await fetch(`/api/cases/${caseId}/captures`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: text.trim() }),
    });
    const row = await res.json();
    window.dispatchEvent(new CustomEvent("vera-capture", { detail: row }));
    setText("");
    setSaving(false);
    setSaved(true);
    setTimeout(() => { setSaved(false); setOpen(false); }, 1200);
  }

  return (
    <>
      {open && <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />}

      {open && (
        <div className="fixed bottom-20 right-5 z-50 w-80 rounded-2xl overflow-hidden print:hidden"
          style={{ background: "var(--vera-surface)", border: "1px solid var(--vera-border)", boxShadow: "0 8px 32px rgba(28,25,23,0.14)" }}>
          <div className="px-4 py-3 border-b flex items-center gap-2" style={{ borderColor: "var(--vera-border)", background: "var(--vera-accent-light)" }}>
            <span className="h-2 w-2 rounded-full" style={{ background: "var(--vera-accent)" }} />
            <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--vera-accent)" }}>Quick Capture</span>
          </div>
          <div className="p-3 space-y-2.5">
            <textarea
              autoFocus
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit(); }}
              placeholder="Log an event, call, or observation… (⌘Enter to save)"
              rows={3}
              className="w-full text-sm rounded-xl px-3 py-2.5 resize-none outline-none transition-colors"
              style={{ border: "1px solid var(--vera-border)", background: "var(--vera-cream)", color: "var(--vera-text)" }}
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setOpen(false)} className="px-3 py-1.5 rounded-lg text-xs font-medium"
                style={{ color: "var(--vera-muted)" }}>
                Cancel
              </button>
              <button onClick={submit} disabled={saving || !text.trim()}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-40"
                style={{ background: "var(--vera-accent)", color: "#fff" }}>
                {saved ? "Saved ✓" : saving ? "Saving…" : "Log it"}
              </button>
            </div>
          </div>
        </div>
      )}

      <button onClick={() => setOpen(o => !o)}
        className="fixed bottom-5 right-5 z-50 flex items-center gap-2 px-4 py-3 rounded-2xl font-semibold text-sm transition-all print:hidden hover:scale-105 active:scale-95"
        style={{ background: "var(--vera-accent)", color: "#fff", boxShadow: "0 4px 16px rgba(194,133,58,0.35)" }}>
        <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 3v10M3 8h10"/>
        </svg>
        Capture
      </button>
    </>
  );
}
