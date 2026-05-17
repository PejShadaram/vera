"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { track } from "@vercel/analytics";

export default function UnlockBanner({ caseId }: { caseId: string }) {
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
    router.push(url);
  }

  return (
    <div className="rounded-2xl px-5 py-5 flex flex-col sm:flex-row sm:items-center gap-4"
      style={{ background: "linear-gradient(135deg, #FDF4E6 0%, #FAF0DC 100%)", border: "2px solid #E8D5B0" }}>
      <div className="flex-1 min-w-0">
        <p className="text-base font-bold tracking-tight" style={{ color: "var(--vera-text)" }}>
          Unlock AI for this case
        </p>
        <p className="text-sm mt-0.5" style={{ color: "var(--vera-muted)" }}>
          Document processing · Vera&apos;s Take · Ask Vera · AI drafts
        </p>
        <p className="text-xs mt-2 font-medium" style={{ color: "var(--vera-subtle)" }}>
          One-time · $49 · Yours forever · No subscription
        </p>
      </div>
      <button
        onClick={unlock}
        disabled={loading}
        className="flex-shrink-0 text-sm font-bold px-6 py-3 rounded-xl transition-colors disabled:opacity-50 whitespace-nowrap"
        style={{ background: "var(--vera-accent)", color: "#fff" }}>
        {loading ? "Redirecting…" : "Unlock AI — $49"}
      </button>
    </div>
  );
}
