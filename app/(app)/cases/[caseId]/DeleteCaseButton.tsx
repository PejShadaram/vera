"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Normalize for comparison: lowercase, collapse whitespace, treat em/en dashes as hyphens
function normalize(s: string) {
  return s.trim().toLowerCase()
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ");
}

export default function DeleteCaseButton({ caseId, caseName }: { caseId: string; caseName: string }) {
  const router = useRouter();
  const [open, setOpen]         = useState(false);
  const [typed, setTyped]       = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError]       = useState("");

  const confirmed = normalize(typed) === normalize(caseName);

  function openModal() { setOpen(true); setTyped(""); setError(""); }

  async function handleDelete() {
    if (!confirmed || deleting) return;
    setDeleting(true);
    setError("");
    try {
      const res = await fetch(`/api/cases/${caseId}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error ?? "Delete failed");
      router.push("/dashboard");
    } catch (e) {
      setError(String(e));
      setDeleting(false);
    }
  }

  return (
    <>
      <button
        onClick={openModal}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
        style={{ border: "1px solid #FECACA", color: "#DC2626", background: "#FEF2F2" }}>
        <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 4h12M5 4V2h6v2M6 7v5M10 7v5M3 4l1 9a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1l1-9"/>
        </svg>
        Delete case
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(28,25,23,0.6)" }}>
          <div className="w-full max-w-md rounded-2xl overflow-hidden"
            style={{ background: "var(--vera-surface)", boxShadow: "0 20px 60px rgba(28,25,23,0.25)" }}>

            {/* Header */}
            <div className="px-6 py-5 border-b" style={{ background: "#FEF2F2", borderColor: "#FECACA" }}>
              <p className="font-bold text-base" style={{ color: "#991B1B" }}>Delete this case permanently</p>
              <p className="text-sm mt-0.5" style={{ color: "#B91C1C" }}>This action cannot be undone.</p>
            </div>

            {/* Body */}
            <div className="px-6 py-5 space-y-4">
              <div className="rounded-xl p-4 text-sm space-y-1.5" style={{ background: "#FEF2F2", border: "1px solid #FECACA" }}>
                <p className="font-semibold text-xs uppercase tracking-wide mb-2" style={{ color: "#991B1B" }}>Permanently deleted:</p>
                <ul className="space-y-1 text-xs" style={{ color: "#B91C1C" }}>
                  <li>· All uploaded documents and files (removed from storage)</li>
                  <li>· Timeline entries and notes</li>
                  <li>· Evidence log</li>
                  <li>· Tasks, deadlines, and log entries</li>
                  <li>· Financial records and calculator data</li>
                  <li>· Case notes (writing pad)</li>
                </ul>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: "var(--vera-text)" }}>
                  Type the case name to confirm:
                </label>
                <p className="text-xs font-mono px-2 py-1.5 rounded-lg mb-2 select-all"
                  style={{ background: "var(--vera-cream)", color: "var(--vera-text)", border: "1px solid var(--vera-border)" }}>
                  {caseName}
                </p>
                <input
                  autoFocus
                  value={typed}
                  onChange={e => setTyped(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && confirmed && handleDelete()}
                  placeholder="Type the case name…"
                  className="w-full rounded-xl px-3 py-2.5 text-sm outline-none border transition-colors"
                  style={{
                    borderColor: typed.length > 0 && !confirmed ? "#FCA5A5" : confirmed ? "#86EFAC" : "var(--vera-border)",
                    background: "var(--vera-surface)",
                    color: "var(--vera-text)",
                  }}
                />
                {typed.length > 0 && !confirmed && (
                  <p className="text-xs mt-1.5" style={{ color: "#DC2626" }}>Doesn't match — check spacing and special characters</p>
                )}
              </div>

              {error && <p className="text-xs font-medium" style={{ color: "#DC2626" }}>{error}</p>}
            </div>

            {/* Footer */}
            <div className="px-6 pb-5 flex gap-3 justify-end">
              <button onClick={() => setOpen(false)} disabled={deleting}
                className="px-4 py-2 rounded-xl text-sm font-medium border transition-colors"
                style={{ borderColor: "var(--vera-border)", color: "var(--vera-muted)" }}>
                Cancel
              </button>
              <button onClick={handleDelete} disabled={!confirmed || deleting}
                className="px-5 py-2 rounded-xl text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: "#DC2626", color: "#fff" }}>
                {deleting ? "Deleting everything…" : "Permanently delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
