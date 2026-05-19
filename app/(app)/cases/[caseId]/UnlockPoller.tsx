"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * Shown when the user returns from Stripe with ?unlocked=1 but the webhook
 * hasn't fired yet. Polls the unlock-status endpoint until confirmed, then
 * refreshes the server component so the page reflects the unlocked state.
 * Times out after 30s to avoid infinite polling.
 */
export default function UnlockPoller({ caseId }: { caseId: string }) {
  const router  = useRouter();
  const tries   = useRef(0);
  const MAX     = 15; // 15 × 2s = 30s max

  useEffect(() => {
    const interval = setInterval(async () => {
      tries.current++;
      try {
        const res  = await fetch(`/api/cases/${caseId}/unlock-status`);
        const data = await res.json() as { unlocked?: boolean };
        if (data.unlocked) {
          clearInterval(interval);
          router.refresh();
        }
      } catch { /* network error — keep trying */ }
      if (tries.current >= MAX) clearInterval(interval);
    }, 2000);
    return () => clearInterval(interval);
  }, [caseId, router]);

  return (
    <div className="rounded-2xl px-5 py-4 flex items-center gap-3" style={{ background: "#FEF3C7", border: "1px solid #FDE68A" }}>
      <svg className="h-4 w-4 animate-spin flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="#C2853A" strokeWidth="2">
        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
      </svg>
      <div>
        <p className="text-sm font-semibold" style={{ color: "#92400E" }}>Confirming your payment with Stripe…</p>
        <p className="text-xs" style={{ color: "#B45309" }}>This usually takes a few seconds. The page will update automatically.</p>
      </div>
    </div>
  );
}
