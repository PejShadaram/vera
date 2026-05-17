"use client";

import { useState, useEffect } from "react";

const STORAGE_KEY = "vera_case_hint_dismissed";

export default function FirstTimeHint({ documentCount }: { documentCount: number }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (documentCount > 0) return;
    try {
      if (!localStorage.getItem(STORAGE_KEY)) {
        setVisible(true);
      }
    } catch {
      // localStorage not available (e.g. SSR or private-browsing edge case)
    }
  }, [documentCount]);

  function dismiss() {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // ignore
    }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      role="status"
      style={{
        background: "#FFFBEB",
        border: "1px solid #FDE68A",
        borderRadius: 12,
        padding: "12px 16px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
      }}
    >
      <p style={{ margin: 0, fontSize: 13, color: "#92400E", lineHeight: 1.5 }}>
        <strong style={{ fontWeight: 600 }}>Get started:</strong>{" "}
        Start by uploading your documents — Vera will extract your timeline, evidence, and action items automatically.
      </p>
      <button
        onClick={dismiss}
        aria-label="Dismiss hint"
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "#B45309",
          fontSize: 18,
          lineHeight: 1,
          padding: "0 4px",
          flexShrink: 0,
        }}
      >
        ✕
      </button>
    </div>
  );
}
