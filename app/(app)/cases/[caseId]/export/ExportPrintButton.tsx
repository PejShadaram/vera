"use client";

export default function ExportPrintButton() {
  return (
    <button
      onClick={() => window.print()}
      style={{
        background: "var(--vera-accent, #C2853A)",
        color: "#fff",
        border: "none",
        padding: "10px 24px",
        borderRadius: 8,
        fontFamily: "Georgia, 'Times New Roman', serif",
        fontSize: 14,
        fontWeight: 600,
        cursor: "pointer",
      }}
    >
      Print / Save as PDF
    </button>
  );
}
