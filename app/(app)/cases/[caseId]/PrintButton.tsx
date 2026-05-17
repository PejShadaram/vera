"use client";

export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex-shrink-0 print:hidden hover:opacity-80"
      style={{ border: "1px solid var(--vera-border)", color: "var(--vera-muted)", background: "var(--vera-surface)" }}>
      <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 6V2h8v4M4 11H3a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1M4 9h8v5H4V9z"/>
      </svg>
      Print / PDF
    </button>
  );
}
