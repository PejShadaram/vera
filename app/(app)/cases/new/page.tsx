"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { upload } from "@vercel/blob/client";
import type { CaseType } from "@/types";

const AUDIO_EXTS_NEW = new Set(["mp3","m4a","wav","ogg","aac","flac","wma","aiff","aif","amr","mp4","mov","avi","mkv","webm","m4v","3gp"]);
const SERVER_MAX_NEW = 3 * 1024 * 1024;
function needsClientUploadNew(file: File) {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return AUDIO_EXTS_NEW.has(ext) || file.size > SERVER_MAX_NEW;
}

// ── Case types ────────────────────────────────────────────────────────────

const CASE_TYPES: { type: CaseType; label: string; sub: string; dot: string }[] = [
  { type: "divorce",         label: "My marriage is ending",              sub: "Divorce & property division",        dot: "#E87070" },
  { type: "custody",         label: "I need to protect my kids",          sub: "Child custody & support",            dot: "#6B9FE8" },
  { type: "landlord_tenant", label: "I have a problem with my landlord",  sub: "Eviction, deposits, repairs, leases", dot: "#E8B84B" },
  { type: "employment",      label: "My employer treated me unfairly",     sub: "Termination, harassment, wages",     dot: "#9B7FE8" },
  { type: "small_claims",    label: "Someone owes me money",              sub: "Small claims court",                  dot: "#5BBF8A" },
  { type: "other",           label: "Something else",                     sub: "Other legal matter",                  dot: "#A8A29E" },
];

// ── Questions ─────────────────────────────────────────────────────────────

type Question = { key: string; label: string; type: "text" | "select" | "radio"; options?: string[]; placeholder?: string };

const QUESTIONS: Record<CaseType, Question[]> = {
  divorce: [
    { key: "state",    label: "Which state?",                               type: "text",   placeholder: "e.g. Texas" },
    { key: "filed",    label: "Has anything been filed with the court yet?",type: "radio",  options: ["Yes", "No", "Not sure"] },
    { key: "property", label: "Do you have property together?",             type: "radio",  options: ["Yes", "No"] },
    { key: "children", label: "Do you have children together?",             type: "radio",  options: ["Yes", "No"] },
    { key: "opposing", label: "Opposing party's name",                      type: "text",   placeholder: "Full name" },
  ],
  custody: [
    { key: "state",    label: "Which state?",                               type: "text",   placeholder: "e.g. Texas" },
    { key: "role",     label: "Your role",                                  type: "radio",  options: ["Mother", "Father", "Guardian"] },
    { key: "order",    label: "Is there a current custody order in place?", type: "radio",  options: ["Yes", "No"] },
    { key: "opposing", label: "Other parent's name",                        type: "text",   placeholder: "Full name" },
  ],
  landlord_tenant: [
    { key: "state",    label: "Which state?",                               type: "text",   placeholder: "e.g. Texas" },
    { key: "role",     label: "Your role",                                  type: "radio",  options: ["Tenant", "Landlord"] },
    { key: "issue",    label: "Main issue",                                 type: "select", options: ["Eviction", "Security deposit", "Repairs / habitability", "Lease dispute", "Other"] },
    { key: "opposing", label: "Opposing party's name",                      type: "text",   placeholder: "Name or company" },
  ],
  employment: [
    { key: "state",    label: "Which state?",                               type: "text",   placeholder: "e.g. Texas" },
    { key: "issue",    label: "What happened?",                             type: "select", options: ["Wrongful termination", "Harassment", "Discrimination", "Unpaid wages", "Retaliation", "Other"] },
    { key: "opposing", label: "Employer or company name",                   type: "text",   placeholder: "Company name" },
  ],
  small_claims: [
    { key: "state",    label: "Which state?",                               type: "text",   placeholder: "e.g. Texas" },
    { key: "amount",   label: "Approximate amount owed",                    type: "text",   placeholder: "e.g. $5,000" },
    { key: "opposing", label: "Who owes you?",                              type: "text",   placeholder: "Name or company" },
  ],
  other: [
    { key: "state",       label: "Which state?",                           type: "text",   placeholder: "e.g. Texas" },
    { key: "description", label: "Brief description of the issue",         type: "text",   placeholder: "What's happening?" },
    { key: "opposing",    label: "Opposing party's name",                  type: "text",   placeholder: "Name or company" },
  ],
};

// ── Upload file state ─────────────────────────────────────────────────────

interface UploadFile {
  id: string;
  file: File;
  status: "queued" | "hashing" | "uploading" | "done" | "error";
  error?: string;
}

// ── Shared styles ─────────────────────────────────────────────────────────

const btn = "bg-[var(--vera-accent)] text-white px-6 py-3 rounded-xl font-semibold hover:bg-[var(--vera-accent-hover)] transition-colors text-sm disabled:opacity-40 disabled:cursor-not-allowed";
const ghostBtn = "border border-[var(--vera-border)] text-[var(--vera-muted)] px-6 py-3 rounded-xl font-medium hover:bg-[var(--vera-cream)] transition-colors text-sm";
const inputCls = "w-full border border-[var(--vera-border)] rounded-xl px-4 py-3 text-sm outline-none bg-white text-[var(--vera-text)] placeholder:text-[var(--vera-subtle)] focus:ring-2 focus:ring-[var(--vera-accent)]/20 focus:border-[var(--vera-accent)] transition-colors";

// ── Main wizard ───────────────────────────────────────────────────────────

export default function NewCasePage() {
  const router = useRouter();

  // Core wizard state
  const [step, setStep]         = useState(1);
  const [caseType, setCaseType] = useState<CaseType | null>(null);
  const [answers, setAnswers]   = useState<Record<string, string>>({});
  const [caseId, setCaseId]     = useState<string | null>(null);
  const [caseName, setCaseName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  // Upload state
  const [uploadFiles, setUploadFiles] = useState<UploadFile[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Processing state
  const [processing, setProcessing] = useState(false);
  const [processLog, setProcessLog] = useState("");
  const [results, setResults] = useState<{
    timeline: { date: string; event: string }[];
    evidence: { ref: string; title: string; summary: string }[];
    tasks:    { title: string; priority: string }[];
  } | null>(null);

  // ── Helpers ──────────────────────────────────────────────────────

  function setAnswer(key: string, val: string) {
    setAnswers(prev => ({ ...prev, [key]: val }));
  }

  function allAnswered() {
    if (!caseType) return false;
    return QUESTIONS[caseType].every(q => answers[q.key]?.trim());
  }

  function autoName() {
    const opposing   = answers["opposing"]?.trim();
    const typeLabel  = CASE_TYPES.find(c => c.type === caseType)?.sub ?? "";
    return opposing ? `${opposing} — ${typeLabel}` : typeLabel;
  }

  // ── Step transitions ──────────────────────────────────────────────

  function handleTypeSelect(type: CaseType) {
    setCaseType(type);
    setAnswers({});
    setStep(2);
  }

  async function handleStep2Continue() {
    if (!caseType || !allAnswered()) return;
    setCreating(true);
    setCreateError("");
    try {
      const name = autoName();
      setCaseName(name);
      const res = await fetch("/api/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          case_type:      caseType,
          opposing_party: answers["opposing"] ?? "",
          jurisdiction:   answers["state"] ?? "",
          metadata:       answers,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setCaseId(data.id);
      setStep(3);
    } catch (e) {
      setCreateError(String(e));
    } finally {
      setCreating(false);
    }
  }

  // ── Upload logic ──────────────────────────────────────────────────

  const uploadFile = useCallback(async (item: UploadFile, id: string) => {
    const update = (patch: Partial<UploadFile>) =>
      setUploadFiles(prev => prev.map(f => f.id === id ? { ...f, ...patch } : f));

    try {
      update({ status: "hashing" });
      const buf    = await item.file.arrayBuffer();
      const digest = await crypto.subtle.digest("SHA-256", buf);
      const sha256 = Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, "0")).join("");

      update({ status: "uploading" });

      if (!needsClientUploadNew(item.file)) {
        // Small non-audio file — route through server
        const fd = new FormData();
        fd.append("file", item.file);
        fd.append("sha256", sha256);
        const res = await fetch(`/api/cases/${caseId}/documents/upload-server`, { method: "POST", body: fd });
        if (!res.ok) throw new Error(await res.text());
      } else {
        // Audio, video, or large file — bypass function limit
        const blob = await upload(item.file.name, item.file, {
          access: "private",
          handleUploadUrl: `/api/cases/${caseId}/documents/upload`,
        });
        await fetch(`/api/cases/${caseId}/documents`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filename: item.file.name, blob_url: blob.url, blob_pathname: blob.pathname, sha256, file_size: item.file.size }),
        });
      }

      update({ status: "done" });
    } catch (e) {
      update({ status: "error", error: String(e) });
    }
  }, [caseId]);

  function addFiles(incoming: File[]) {
    const newItems: UploadFile[] = incoming.map(f => ({
      id:     Math.random().toString(36).slice(2),
      file:   f,
      status: "queued" as const,
    }));
    setUploadFiles(prev => {
      const updated = [...prev, ...newItems];
      // Start uploads immediately
      newItems.forEach(item => {
        setTimeout(() => uploadFile(item, item.id), 0);
      });
      return updated;
    });
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length) addFiles(files);
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length) addFiles(files);
    e.target.value = "";
  }

  const allDone     = uploadFiles.length > 0 && uploadFiles.every(f => f.status === "done" || f.status === "error");
  const anyUploading = uploadFiles.some(f => f.status === "queued" || f.status === "hashing" || f.status === "uploading");

  // ── Processing ────────────────────────────────────────────────────

  async function startProcessing() {
    if (!caseId) return;
    setStep(4);
    setProcessing(true);
    setProcessLog("Sending your documents to Vera…");

    const res = await fetch(`/api/cases/${caseId}/process`, { method: "POST" });

    // Case not unlocked — initiate checkout. Docs are already uploaded;
    // after payment the case page will show them ready to process.
    if (res.status === 403) {
      setProcessing(false);
      const checkoutRes = await fetch("/api/stripe/checkout", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ caseId }),
      });
      const { url } = await checkoutRes.json() as { url?: string };
      if (url) window.location.href = url;
      return;
    }

    if (!res.body) { setProcessing(false); return; }

    const reader  = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split("\n"); buf = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        try {
          const ev = JSON.parse(line.slice(6)) as { type: string; message?: string };
          if (ev.type === "progress") setProcessLog(ev.message ?? "");
          if (ev.type === "done") {
            setProcessLog(ev.message ?? "Done!");
            const evAny = ev as Record<string, unknown>;
            if (evAny.summary) setResults(evAny.summary as typeof results);
          }
          if (ev.type === "error") setProcessLog("Note: " + (ev.message ?? "unknown error"));
        } catch { /* skip */ }
      }
    }
    setProcessing(false);
  }

  // ── Progress bar ──────────────────────────────────────────────────

  const STEPS = ["Your situation", "A few details", "Upload documents", "Vera is working"];

  // ── Render ────────────────────────────────────────────────────────

  return (
    <div className="max-w-xl mx-auto">

      {/* Progress */}
      <div className="mb-8">
        <div className="flex gap-1.5 mb-3">
          {STEPS.map((_, i) => (
            <div key={i} className="h-1 flex-1 rounded-full transition-all duration-300"
              style={{ background: i + 1 <= step ? "var(--vera-accent)" : "var(--vera-border)" }} />
          ))}
        </div>
        <p className="text-xs font-medium" style={{ color: "var(--vera-subtle)" }}>
          Step {step} of {STEPS.length} — {STEPS[step - 1]}
        </p>
      </div>

      {/* ── Step 1: Case type ─────────────────────────────────────── */}
      {step === 1 && (
        <div className="space-y-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] mb-3" style={{ color: "var(--vera-accent)" }}>
              You've taken the first step
            </p>
            <h1 className="text-3xl font-bold tracking-tight leading-snug" style={{ color: "var(--vera-text)" }}>
              Let's get you<br />organized.
            </h1>
            <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--vera-muted)" }}>
              Vera will set up your case, help you track evidence, and keep you ahead — one step at a time. What are you dealing with?
            </p>
          </div>

          <div className="space-y-2">
            {CASE_TYPES.map(ct => (
              <button key={ct.type} onClick={() => handleTypeSelect(ct.type)}
                className="w-full flex items-center gap-4 px-4 py-4 rounded-2xl border bg-white hover:shadow-md transition-all text-left group"
                style={{ borderColor: "var(--vera-border)" }}>
                <span className="h-3 w-3 rounded-full flex-shrink-0" style={{ background: ct.dot }} />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm" style={{ color: "var(--vera-text)" }}>{ct.label}</p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--vera-muted)" }}>{ct.sub}</p>
                </div>
                <svg className="h-4 w-4 flex-shrink-0 transition-transform group-hover:translate-x-0.5"
                  style={{ color: "var(--vera-subtle)" }}
                  viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M6 12l4-4-4-4"/>
                </svg>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Step 2: Questions ─────────────────────────────────────── */}
      {step === 2 && caseType && (
        <div className="space-y-6">
          <div>
            <button onClick={() => setStep(1)}
              className="flex items-center gap-1 text-sm mb-4 transition-colors hover:opacity-70"
              style={{ color: "var(--vera-subtle)" }}>
              <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M10 4l-4 4 4 4"/>
              </svg>
              Back
            </button>
            <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--vera-text)" }}>
              A few quick details
            </h1>
            <p className="mt-1 text-sm" style={{ color: "var(--vera-muted)" }}>
              Takes less than a minute. This helps Vera set up the right tools for your case.
            </p>
          </div>

          <div className="space-y-5">
            {QUESTIONS[caseType].map(q => (
              <div key={q.key}>
                <label className="block text-sm font-medium mb-2" style={{ color: "var(--vera-text)" }}>
                  {q.label}
                </label>
                {q.type === "text" && (
                  <input className={inputCls} placeholder={q.placeholder} value={answers[q.key] ?? ""}
                    onChange={e => setAnswer(q.key, e.target.value)} />
                )}
                {q.type === "radio" && q.options && (
                  <div className="flex flex-wrap gap-2">
                    {q.options.map(opt => (
                      <button key={opt} onClick={() => setAnswer(q.key, opt)}
                        className="px-4 py-2 rounded-xl text-sm font-medium border transition-all"
                        style={answers[q.key] === opt
                          ? { background: "var(--vera-accent)", color: "#fff", borderColor: "var(--vera-accent)" }
                          : { background: "#fff", color: "var(--vera-muted)", borderColor: "var(--vera-border)" }}>
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

          {createError && <p className="text-sm" style={{ color: "#DC2626" }}>{createError}</p>}

          <button onClick={handleStep2Continue} disabled={!allAnswered() || creating} className={btn}>
            {creating ? "Setting up your case…" : "Set up my case →"}
          </button>
        </div>
      )}

      {/* ── Step 3: Upload ────────────────────────────────────────── */}
      {step === 3 && caseId && (
        <div className="space-y-6">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <span className="h-2 w-2 rounded-full" style={{ background: "var(--vera-accent)" }} />
              <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--vera-accent)" }}>
                Your case is ready
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--vera-text)" }}>
              Upload what you have
            </h1>
            <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--vera-muted)" }}>
              Drop anything here — texts, emails, court papers, photos, voicemails. Vera reads everything and pulls out what matters. The more you give it, the stronger your case file.
            </p>
          </div>

          {/* Drop zone */}
          <input ref={fileInputRef} type="file" multiple className="hidden"
            accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.heic,.docx,.doc,.txt,.md,.csv,.html,.eml,.mp3,.m4a,.wav,.ogg,.mp4,.mov,.webm,.xlsx"
            onChange={handleFileInput} />

          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className="rounded-2xl border-2 border-dashed cursor-pointer transition-all flex flex-col items-center justify-center py-12 px-6 text-center"
            style={{
              borderColor: dragOver ? "var(--vera-accent)" : "var(--vera-border)",
              background:  dragOver ? "var(--vera-accent-light)" : "var(--vera-cream)",
            }}>
            <svg className="h-10 w-10 mb-4" style={{ color: dragOver ? "var(--vera-accent)" : "var(--vera-subtle)" }}
              viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            <p className="font-semibold text-sm mb-1" style={{ color: "var(--vera-text)" }}>
              {dragOver ? "Drop to upload" : "Drop files here"}
            </p>
            <p className="text-xs" style={{ color: "var(--vera-subtle)" }}>
              or click to browse — PDFs, photos, Word docs, audio, video, emails
            </p>
          </div>

          {/* File list */}
          {uploadFiles.length > 0 && (
            <div className="space-y-2">
              {uploadFiles.map(f => (
                <div key={f.id} className="flex items-center gap-3 px-4 py-3 rounded-xl"
                  style={{ background: "var(--vera-surface)", border: "1px solid var(--vera-border)" }}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: "var(--vera-text)" }}>{f.file.name}</p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--vera-subtle)" }}>
                      {(f.file.size / 1024).toFixed(0)} KB
                    </p>
                  </div>
                  <FileStatusBadge status={f.status} error={f.error} />
                </div>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="space-y-3">
            {uploadFiles.length > 0 && allDone ? (
              <>
                <button
                  onClick={startProcessing}
                  disabled={anyUploading}
                  className={btn + " w-full justify-center"}>
                  Unlock AI & analyze {uploadFiles.filter(f => f.status === "done").length} document{uploadFiles.filter(f => f.status === "done").length !== 1 ? "s" : ""} — $49
                </button>
                <p className="text-center text-xs" style={{ color: "var(--vera-subtle)" }}>
                  One-time · No subscription · Vera reads everything and builds your case file
                </p>
                <button
                  onClick={() => router.push(`/cases/${caseId}`)}
                  className="w-full text-center text-sm transition-colors hover:opacity-70"
                  style={{ color: "var(--vera-subtle)" }}>
                  Skip for now — go to my case
                </button>
              </>
            ) : anyUploading ? (
              <button disabled className={btn + " w-full justify-center opacity-50"}>Uploading…</button>
            ) : (
              <button
                onClick={() => router.push(`/cases/${caseId}`)}
                className={btn + " w-full justify-center"}>
                Continue without documents →
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Step 4: Processing / Done ─────────────────────────────── */}
      {step === 4 && caseId && (
        <div className="space-y-6">
          {processing ? (
            <>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] mb-3" style={{ color: "var(--vera-accent)" }}>
                  Working on it
                </p>
                <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--vera-text)" }}>
                  Vera is reading your documents…
                </h1>
                <p className="mt-2 text-sm" style={{ color: "var(--vera-muted)" }}>
                  Extracting timeline events, evidence, and action items.
                </p>
              </div>
              <div className="rounded-2xl px-5 py-4" style={{ background: "var(--vera-accent-light)", border: "1px solid #E8D5B0" }}>
                <div className="flex items-center gap-2">
                  <span className="inline-flex gap-1">
                    {[0,1,2].map(i => (
                      <span key={i} className="h-1.5 w-1.5 rounded-full animate-bounce" style={{ background: "var(--vera-accent)", animationDelay: `${i * 0.15}s` }} />
                    ))}
                  </span>
                  <p className="text-sm font-medium" style={{ color: "var(--vera-accent)" }}>{processLog}</p>
                </div>
              </div>
            </>
          ) : results ? (
            <>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] mb-3" style={{ color: "var(--vera-accent)" }}>
                  Your case is ready
                </p>
                <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--vera-text)" }}>
                  Here's what Vera found.
                </h1>
                <p className="mt-2 text-sm" style={{ color: "var(--vera-muted)" }}>
                  You're already ahead. Review and add to this as your case develops.
                </p>
              </div>

              <div className="space-y-3">
                {results.timeline.length > 0 && (
                  <ResultSection
                    label="Timeline entries"
                    count={results.timeline.length}
                    color="#DBEAFE"
                    textColor="#1D4ED8"
                    items={results.timeline.map(e => `${e.date} — ${e.event}`)}
                  />
                )}
                {results.evidence.length > 0 && (
                  <ResultSection
                    label="Evidence items"
                    count={results.evidence.length}
                    color="var(--vera-accent-light)"
                    textColor="var(--vera-accent)"
                    items={results.evidence.map(e => `${e.ref} — ${e.title}`)}
                  />
                )}
                {results.tasks.length > 0 && (
                  <ResultSection
                    label="Suggested tasks"
                    count={results.tasks.length}
                    color="#DCFCE7"
                    textColor="#15803D"
                    items={results.tasks.map(t => t.title)}
                  />
                )}
                {results.timeline.length === 0 && results.evidence.length === 0 && results.tasks.length === 0 && (
                  <div className="rounded-xl px-4 py-3 text-sm" style={{ background: "var(--vera-cream)", color: "var(--vera-muted)" }}>
                    No items were extracted — try uploading more documents or different file types.
                  </div>
                )}
              </div>

              <button onClick={() => router.push(`/cases/${caseId}`)} className={btn + " w-full justify-center"}>
                View my case →
              </button>
            </>
          ) : (
            // Done without processing (skipped or error)
            <>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] mb-3" style={{ color: "var(--vera-accent)" }}>
                  You're all set
                </p>
                <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--vera-text)" }}>
                  Your case is ready.
                </h1>
                <p className="mt-2 text-sm" style={{ color: "var(--vera-muted)" }}>
                  We've set up your case with a starter task list. Upload documents any time to let Vera build your timeline and evidence log.
                </p>
              </div>
              <button onClick={() => router.push(`/cases/${caseId}`)} className={btn + " w-full justify-center"}>
                Go to my case →
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────

function FileStatusBadge({ status, error }: { status: UploadFile["status"]; error?: string }) {
  if (status === "done")
    return <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: "#DCFCE7", color: "#15803D" }}>Done</span>;
  if (status === "error")
    return <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0" title={error} style={{ background: "#FEE2E2", color: "#DC2626" }}>Error</span>;
  if (status === "hashing")
    return <span className="text-[11px] font-medium flex-shrink-0" style={{ color: "var(--vera-subtle)" }}>Securing…</span>;
  if (status === "uploading")
    return <span className="text-[11px] font-medium flex-shrink-0" style={{ color: "var(--vera-accent)" }}>Uploading…</span>;
  return <span className="text-[11px] font-medium flex-shrink-0" style={{ color: "var(--vera-subtle)" }}>Queued</span>;
}

function ResultSection({ label, count, color, textColor, items }: {
  label: string; count: number; color: string; textColor: string; items: string[];
}) {
  const [expanded, setExpanded] = useState(false);
  const preview = items.slice(0, 3);
  const rest    = items.slice(3);

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${color === "var(--vera-accent-light)" ? "#E8D5B0" : color}` }}>
      <div className="px-4 py-3 flex items-center justify-between" style={{ background: color }}>
        <span className="text-xs font-bold uppercase tracking-wide" style={{ color: textColor }}>{label}</span>
        <span className="text-sm font-bold" style={{ color: textColor }}>{count}</span>
      </div>
      <div className="divide-y" style={{ borderColor: color }}>
        {preview.map((item, i) => (
          <p key={i} className="px-4 py-2 text-xs leading-relaxed" style={{ color: "var(--vera-text)" }}>{item}</p>
        ))}
        {rest.length > 0 && !expanded && (
          <button onClick={() => setExpanded(true)} className="w-full px-4 py-2 text-xs text-left transition-colors hover:opacity-70"
            style={{ color: "var(--vera-muted)" }}>
            + {rest.length} more
          </button>
        )}
        {expanded && rest.map((item, i) => (
          <p key={i} className="px-4 py-2 text-xs leading-relaxed" style={{ color: "var(--vera-text)" }}>{item}</p>
        ))}
      </div>
    </div>
  );
}
