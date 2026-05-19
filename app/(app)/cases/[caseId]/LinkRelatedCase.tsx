"use client";

export default function LinkRelatedCase() {
  return (
    <button
      onClick={() => window.dispatchEvent(new CustomEvent("vera:open-tab", { detail: "Settings" }))}
      className="text-xs transition-opacity hover:opacity-70"
      style={{ background: "none", border: "none", cursor: "pointer", color: "var(--vera-subtle)", padding: 0 }}>
      + Link related filing
    </button>
  );
}
