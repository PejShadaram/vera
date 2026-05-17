"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

const S = {
  accent:      "var(--vera-accent)",
  accentLight: "var(--vera-accent-light)",
  border:      "var(--vera-border)",
  text:        "var(--vera-text)",
  muted:       "var(--vera-muted)",
  subtle:      "var(--vera-subtle)",
  surface:     "var(--vera-surface)",
  cream:       "var(--vera-cream)",
};

interface AccountData {
  caseCount: number;
  email: string;
}

export default function AccountPage() {
  const [data, setData]     = useState<AccountData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/account").then(r => r.json()).then(d => { setData(d); setLoading(false); });
  }, []);

  if (loading) return <div className="py-12 text-center text-sm" style={{ color: S.subtle }}>Loading…</div>;
  if (!data)   return null;

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: S.text }}>Account</h1>
        <p className="text-sm mt-0.5" style={{ color: S.muted }}>Your account details.</p>
      </div>

      <div className="rounded-2xl p-5 space-y-3" style={{ background: S.surface, border: `1px solid ${S.border}` }}>
        <p className="text-xs font-bold uppercase tracking-widest" style={{ color: S.subtle }}>Account</p>
        {data.email && (
          <div>
            <p className="text-xs" style={{ color: S.subtle }}>Email</p>
            <p className="text-sm font-medium" style={{ color: S.text }}>{data.email}</p>
          </div>
        )}
        <div>
          <p className="text-xs" style={{ color: S.subtle }}>Cases</p>
          <p className="text-sm font-medium" style={{ color: S.text }}>{data.caseCount} {data.caseCount === 1 ? "case" : "cases"}</p>
        </div>
        <p className="text-xs pt-1" style={{ color: S.subtle }}>
          To change your email or password, use the profile menu (top right).
        </p>
      </div>

      <div className="rounded-2xl p-5 space-y-3" style={{ background: S.surface, border: `1px solid ${S.border}` }}>
        <p className="text-xs font-bold uppercase tracking-widest" style={{ color: S.subtle }}>AI unlocks</p>
        <p className="text-sm" style={{ color: S.muted }}>
          AI is unlocked per case for $49 one-time. Open any case and click <strong style={{ color: S.text }}>"Unlock AI"</strong> to activate document processing, Vera&apos;s Take, Ask Vera, and AI drafts on that case.
        </p>
        <Link href="/pricing" className="text-sm font-semibold" style={{ color: S.accent }}>
          View pricing →
        </Link>
      </div>

      <Link href="/dashboard" className="text-sm flex items-center gap-1" style={{ color: S.subtle }}>
        <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M10 4l-4 4 4 4"/>
        </svg>
        Back to dashboard
      </Link>
    </div>
  );
}
