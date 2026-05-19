"use client";
import { useState } from "react";

export default function BundleCheckoutButton() {
  const [loading, setLoading] = useState(false);

  async function checkout() {
    setLoading(true);
    const res = await fetch("/api/stripe/bundle-checkout", { method: "POST" });
    const { url, error } = await res.json() as { url?: string; error?: string };
    if (error || !url) { alert(error ?? "Something went wrong"); setLoading(false); return; }
    window.location.href = url;
  }

  return (
    <button onClick={checkout} disabled={loading}
      className="flex-shrink-0 text-sm font-bold px-6 py-3 rounded-xl transition-colors disabled:opacity-50 whitespace-nowrap"
      style={{ background: "var(--vera-accent)", color: "#fff" }}>
      {loading ? "Redirecting…" : "Get bundle — $79"}
    </button>
  );
}
