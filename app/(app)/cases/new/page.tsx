"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CaseType } from "@/types";

// ── Step 1 data ───────────────────────────────────────────────────────────

const CASE_TYPES: { type: CaseType; label: string; sub: string; icon: string }[] = [
  { type: "divorce",         label: "My marriage is ending",           sub: "Divorce & property division",       icon: "⚖️" },
  { type: "custody",         label: "I'm fighting for my kids",        sub: "Child custody & support",           icon: "👨‍👧" },
  { type: "landlord_tenant", label: "My landlord or tenant is the problem", sub: "Eviction, deposits, repairs", icon: "🏠" },
  { type: "employment",      label: "My employer wronged me",          sub: "Termination, harassment, wages",    icon: "💼" },
  { type: "small_claims",    label: "Someone owes me money",           sub: "Small claims court",                icon: "💰" },
  { type: "other",           label: "Something else",                  sub: "Other legal matter",                icon: "📋" },
];

// ── Step 2 questions per case type ────────────────────────────────────────

type Question = { key: string; label: string; type: "text" | "select" | "radio"; options?: string[]; placeholder?: string };

const QUESTIONS: Record<CaseType, Question[]> = {
  divorce: [
    { key: "state",       label: "Which state?",                         type: "text",   placeholder: "e.g. Texas" },
    { key: "filed",       label: "Has anything been filed with the court yet?", type: "radio",  options: ["Yes", "No", "Not sure"] },
    { key: "property",    label: "Do you have property together?",        type: "radio",  options: ["Yes", "No"] },
    { key: "children",    label: "Do you have children together?",        type: "radio",  options: ["Yes", "No"] },
    { key: "opposing",    label: "Opposing party's name",                 type: "text",   placeholder: "Full name" },
  ],
  custody: [
    { key: "state",       label: "Which state?",                         type: "text",   placeholder: "e.g. Texas" },
    { key: "role",        label: "Your role",                            type: "radio",  options: ["Mother", "Father", "Guardian"] },
    { key: "order",       label: "Is there a current custody order in place?", type: "radio", options: ["Yes", "No"] },
    { key: "opposing",    label: "Other parent's name",                  type: "text",   placeholder: "Full name" },
  ],
  landlord_tenant: [
    { key: "state",       label: "Which state?",                         type: "text",   placeholder: "e.g. Texas" },
    { key: "role",        label: "Your role",                            type: "radio",  options: ["Tenant", "Landlord"] },
    { key: "issue",       label: "Main issue",                           type: "select", options: ["Eviction", "Security deposit", "Repairs / habitability", "Lease dispute", "Other"] },
    { key: "opposing",    label: "Opposing party's name",                type: "text",   placeholder: "Name or company" },
  ],
  employment: [
    { key: "state",       label: "Which state?",                         type: "text",   placeholder: "e.g. Texas" },
    { key: "issue",       label: "What happened?",                       type: "select", options: ["Wrongful termination", "Harassment", "Discrimination", "Unpaid wages", "Retaliation", "Other"] },
    { key: "opposing",    label: "Employer / company name",              type: "text",   placeholder: "Company name" },
  ],
  small_claims: [
    { key: "state",       label: "Which state?",                         type: "text",   placeholder: "e.g. Texas" },
    { key: "amount",      label: "Approximate amount owed",              type: "text",   placeholder: "e.g. $5,000" },
    { key: "opposing",    label: "Who owes you?",                        type: "text",   placeholder: "Name or company" },
  ],
  other: [
    { key: "state",       label: "Which state?",                         type: "text",   placeholder: "e.g. Texas" },
    { key: "description", label: "Brief description of the issue",       type: "text",   placeholder: "What's happening?" },
    { key: "opposing",    label: "Opposing party's name",                type: "text",   placeholder: "Name or company" },
  ],
};

// ── Shared styles ─────────────────────────────────────────────────────────

const btn = "bg-gray-900 text-white px-6 py-2.5 rounded-xl font-medium hover:bg-gray-700 transition-colors text-sm disabled:opacity-40 disabled:cursor-not-allowed";
const outlineBtn = "border border-gray-200 text-gray-600 px-6 py-2.5 rounded-xl font-medium hover:bg-gray-50 transition-colors text-sm";
const inputCls = "w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 bg-white";

// ── Wizard ────────────────────────────────────────────────────────────────

export default function NewCasePage() {
  const router = useRouter();
  const [step, setStep]           = useState(1);
  const [caseType, setCaseType]   = useState<CaseType | null>(null);
  const [answers, setAnswers]     = useState<Record<string, string>>({});
  const [caseName, setCaseName]   = useState("");
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState("");

  // ── Step 2 helpers ────────────────────────────────────────────
  function setAnswer(key: string, val: string) {
    setAnswers(prev => ({ ...prev, [key]: val }));
  }

  function allAnswered() {
    if (!caseType) return false;
    const qs = QUESTIONS[caseType];
    return qs.every(q => answers[q.key]?.trim());
  }

  function autoName() {
    const opposing = answers["opposing"]?.trim();
    const typeLabel = CASE_TYPES.find(c => c.type === caseType)?.sub ?? "";
    return opposing ? `${opposing} — ${typeLabel}` : typeLabel;
  }

  function handleTypeSelect(type: CaseType) {
    setCaseType(type);
    setAnswers({});
    setStep(2);
  }

  function handleStep2Continue() {
    setCaseName(autoName());
    setStep(3);
  }

  async function handleCreate() {
    if (!caseType || !caseName.trim()) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name:            caseName.trim(),
          case_type:       caseType,
          opposing_party:  answers["opposing"] ?? "",
          jurisdiction:    answers["state"] ?? "",
          metadata:        answers,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const { id } = await res.json();
      router.push(`/cases/${id}`);
    } catch (e) {
      setError(String(e));
      setSaving(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────

  return (
    <div className="max-w-2xl mx-auto">
      {/* Progress */}
      <div className="flex items-center gap-2 mb-8">
        {[1, 2, 3].map(n => (
          <div key={n} className={`h-1.5 flex-1 rounded-full transition-colors ${n <= step ? "bg-gray-900" : "bg-gray-200"}`} />
        ))}
      </div>

      {/* Step 1 — Case type */}
      {step === 1 && (
        <div className="space-y-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">What's your situation?</h1>
            <p className="text-gray-500 mt-1">Vera will set up your case with the right tools and templates.</p>
          </div>
          <div className="grid gap-3">
            {CASE_TYPES.map(ct => (
              <button key={ct.type} onClick={() => handleTypeSelect(ct.type)}
                className="flex items-center gap-4 p-4 rounded-2xl border border-gray-200 bg-white hover:border-gray-400 hover:shadow-sm transition-all text-left group">
                <span className="text-2xl">{ct.icon}</span>
                <div>
                  <p className="font-semibold text-gray-900 group-hover:text-gray-700">{ct.label}</p>
                  <p className="text-sm text-gray-500">{ct.sub}</p>
                </div>
                <svg className="h-4 w-4 text-gray-400 ml-auto flex-shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 12l4-4-4-4"/></svg>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 2 — Questions */}
      {step === 2 && caseType && (
        <div className="space-y-6">
          <div>
            <button onClick={() => setStep(1)} className="text-sm text-gray-400 hover:text-gray-600 mb-3 flex items-center gap-1">
              <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10 4l-4 4 4 4"/></svg>
              Back
            </button>
            <h1 className="text-2xl font-bold text-gray-900">A few quick questions</h1>
            <p className="text-gray-500 mt-1">Takes about 60 seconds. Vera uses this to set up your case.</p>
          </div>

          <div className="space-y-5">
            {QUESTIONS[caseType].map(q => (
              <div key={q.key}>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">{q.label}</label>
                {q.type === "text" && (
                  <input className={inputCls} placeholder={q.placeholder} value={answers[q.key] ?? ""}
                    onChange={e => setAnswer(q.key, e.target.value)} />
                )}
                {q.type === "radio" && q.options && (
                  <div className="flex flex-wrap gap-2">
                    {q.options.map(opt => (
                      <button key={opt} onClick={() => setAnswer(q.key, opt)}
                        className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
                          answers[q.key] === opt ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
                        }`}>
                        {opt}
                      </button>
                    ))}
                  </div>
                )}
                {q.type === "select" && q.options && (
                  <select className={inputCls} value={answers[q.key] ?? ""} onChange={e => setAnswer(q.key, e.target.value)}>
                    <option value="">Select one…</option>
                    {q.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                )}
              </div>
            ))}
          </div>

          <button onClick={handleStep2Continue} disabled={!allAnswered()} className={btn}>
            Continue →
          </button>
        </div>
      )}

      {/* Step 3 — Name + confirm */}
      {step === 3 && caseType && (
        <div className="space-y-6">
          <div>
            <button onClick={() => setStep(2)} className="text-sm text-gray-400 hover:text-gray-600 mb-3 flex items-center gap-1">
              <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10 4l-4 4 4 4"/></svg>
              Back
            </button>
            <h1 className="text-2xl font-bold text-gray-900">Name your case</h1>
            <p className="text-gray-500 mt-1">We've suggested a name — edit it however you like.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Case name</label>
            <input className={inputCls + " text-base"} value={caseName} onChange={e => setCaseName(e.target.value)} />
          </div>

          {/* Summary */}
          <div className="bg-gray-50 rounded-2xl p-5 space-y-2 text-sm">
            <p className="font-semibold text-gray-700 mb-3">Your case will include:</p>
            {[
              "AI-powered document processing",
              "Chronological timeline builder",
              "Evidence log",
              "Task board with reminders",
              "Deadline alerts",
              "Settlement calculator",
            ].map(f => (
              <p key={f} className="flex items-center gap-2 text-gray-600">
                <span className="text-green-500 font-bold">✓</span> {f}
              </p>
            ))}
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-3">
            <button onClick={handleCreate} disabled={saving || !caseName.trim()} className={btn}>
              {saving ? "Creating…" : "Create my case →"}
            </button>
            <button onClick={() => setStep(2)} className={outlineBtn}>Back</button>
          </div>
        </div>
      )}
    </div>
  );
}
