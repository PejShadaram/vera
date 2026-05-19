"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { track } from "@vercel/analytics";

export default function UnlockBanner({ caseId, processedCount = 0, pendingCount = 0, bundleCredits = 0 }: { caseId: string; processedCount?: number; pendingCount?: number; bundleCredits?: number }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function unlock() {
    track("unlock_clicked", { caseId });
    setLoading(true);
    const res  = await fetch("/api/stripe/checkout", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ caseId }),
    });
    const { url, error } = await res.json() as { url?: string; error?: string };
    if (error || !url) { alert(error ?? "Something went wrong"); setLoading(false); return; }
    window.location.href = url;
  }

  return (
    <div className="rounded-2xl px-5 py-5 flex flex-col sm:flex-row sm:items-center gap-4"
      style={{ background: "linear-gradient(135deg, #FDF4E6 0%, #FAF0DC 100%)", border: "2px solid #E8D5B0" }}>
      <div className="flex-1 min-w-0">
        <p className="text-base font-bold tracking-tight" style={{ color: "var(--vera-text)" }}>
          {bundleCredits > 0 ? "You have a case credit ready to apply" : processedCount >= 3 ? "You've used your 3 free AI processes" : "Unlock AI for this case"}
        </p>
        <p className="text-sm mt-0.5" style={{ color: "var(--vera-muted)" }}>
          {bundleCredits > 0
            ? "One of your pre-purchased credits will be applied — no charge."
            : processedCount >= 3
            ? "Unlock to keep processing documents, plus Vera's Take and Ask Vera."
            : "3 free AI document processes included · Vera's Take · Ask Vera"}
        </p>
        {bundleCredits === 0 && (
          <p className="text-xs mt-2 font-medium" style={{ color: "var(--vera-subtle)" }}>
            One-time · $49 · Yours forever · No subscription
          </p>
        )}
        {pendingCount > 0 && processedCount < 3 && (
          <p className="text-xs mt-2" style={{ color: "var(--vera-muted)" }}>
            {pendingCount} {pendingCount === 1 ? "document" : "documents"} ready to process —{" "}
            <button
              onClick={() => window.dispatchEvent(new CustomEvent("vera:open-tab", { detail: "Documents" }))}
              className="font-semibold underline"
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--vera-accent)", padding: 0, fontSize: "inherit" }}>
              Go to Documents
            </button>
            {" "}({3 - processedCount} free AI {3 - processedCount === 1 ? "read" : "reads"} remaining)
          </p>
        )}
      </div>
      <button
        onClick={unlock}
        disabled={loading}
        className="flex-shrink-0 text-sm font-bold px-6 py-3 rounded-xl transition-colors disabled:opacity-50 whitespace-nowrap"
        style={{ background: "var(--vera-accent)", color: "#fff" }}>
        {loading ? "Redirecting…" : bundleCredits > 0 ? "Apply credit — unlock free" : "Unlock AI — $49"}
      </button>
    </div>
  );
}
