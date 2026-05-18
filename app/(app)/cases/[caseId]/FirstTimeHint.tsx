"use client";

import { useState, useEffect } from "react";

const STORAGE_KEY = "vera_onboarding_v2";

export default function FirstTimeHint({
  documentCount,
  timelineCount,
  hasHearingDate,
}: {
  documentCount: number;
  timelineCount: number;
  hasHearingDate: boolean;
}) {
  const [visible, setVisible] = useState(false);

  const step1Done = hasHearingDate;
  const step2Done = documentCount > 0;
  const step3Done = timelineCount > 0;
  const allDone   = step1Done && step2Done && step3Done;

  useEffect(() => {
    if (allDone) return;
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setVisible(true);
    } catch { /* SSR / private browsing */ }
  }, [allDone]);

  function dismiss() {
    try { localStorage.setItem(STORAGE_KEY, "1"); } catch { /* ignore */ }
    setVisible(false);
  }

  if (!visible || allDone) return null;

  const doneCount = [step1Done, step2Done, step3Done].filter(Boolean).length;

  const steps = [
    {
      done:  step1Done,
      label: "Add your hearing date",
      hint:  "Go to More → Settings. Vera uses it to personalise your hearing prep.",
    },
    {
      done:  step2Done,
      label: "Upload a document",
      hint:  "A court filing, lease, email — anything you have. Vera reads it automatically.",
    },
    {
      done:  step3Done,
      label: "Log your first timeline entry",
      hint:  "Add the first key event so Vera has context for your case.",
    },
  ];

  return (
    <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 12, padding: "16px 20px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#15803D" }}>
          Set up your case · {doneCount}/3 done
        </p>
        <button onClick={dismiss} aria-label="Dismiss"
          style={{ background: "none", border: "none", cursor: "pointer", color: "#16A34A", fontSize: 16, padding: "0 4px", lineHeight: 1 }}>
          ✕
        </button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {steps.map((s, i) => (
          <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <span style={{
              flexShrink: 0, width: 20, height: 20, borderRadius: "50%",
              background: s.done ? "#22C55E" : "#E2E8F0",
              color: s.done ? "#fff" : "#94A3B8",
              fontSize: 11, fontWeight: 700,
              display: "flex", alignItems: "center", justifyContent: "center",
              marginTop: 1,
            }}>
              {s.done ? "✓" : i + 1}
            </span>
            <div>
              <p style={{ margin: 0, fontSize: 13, fontWeight: s.done ? 400 : 600, color: s.done ? "#86EFAC" : "#15803D", textDecoration: s.done ? "line-through" : "none" }}>
                {s.label}
              </p>
              {!s.done && <p style={{ margin: "2px 0 0", fontSize: 12, color: "#16A34A", lineHeight: 1.4 }}>{s.hint}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
