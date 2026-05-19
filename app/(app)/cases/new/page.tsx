"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { upload } from "@vercel/blob/client";
import { track } from "@vercel/analytics";
import type { CaseType } from "@/types";

const AUDIO_EXTS_NEW = new Set(["mp3","m4a","wav","ogg","aac","flac","wma","aiff","aif","amr","mp4","mov","avi","mkv","webm","m4v","3gp"]);
const SERVER_MAX_NEW = 3 * 1024 * 1024;
function needsClientUploadNew(file: File) {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return AUDIO_EXTS_NEW.has(ext) || file.size > SERVER_MAX_NEW;
}

// ── Case types ────────────────────────────────────────────────────────────

const CASE_TYPES: { type: CaseType; label: string; sub: string; dot: string }[] = [
  { type: "divorce",         label: "My marriage is ending",              sub: "Divorce & property division",         dot: "#E87070" },
  { type: "custody",         label: "I need to protect my kids",          sub: "Child custody & support",             dot: "#6B9FE8" },
  { type: "landlord_tenant", label: "I have a problem with my landlord",  sub: "Eviction, deposits, repairs, leases", dot: "#E8B84B" },
  { type: "employment",      label: "My employer treated me unfairly",    sub: "Termination, harassment, wages",      dot: "#9B7FE8" },
  { type: "small_claims",    label: "Someone owes me money",              sub: "Small claims court",                  dot: "#5BBF8A" },
  { type: "other",           label: "Something else",                     sub: "Other legal matter",                  dot: "#A8A29E" },
];

const CASE_INSIGHTS: Record<string, string> = {
  divorce:         "Courts focus on financial transparency and communication history. Bank statements, emails, and signed agreements are your strongest evidence.",
  custody:         "Courts care about demonstrated daily involvement. School records, medical appointments, and communication logs show your role in your child's life.",
  landlord_tenant: "Written notice and documented conditions are everything. Lease, photos, and all communications between you and the other party.",
  employment:      "Employment cases live and die on paper. Performance reviews, emails, and a written incident timeline before memory fades.",
  small_claims:    "Receipts, contracts, and a clear timeline of what happened and when. Courts need to see the money trail.",
  other:           "Start with anything written — communications, agreements, records. Vera will extract what matters.",
};

// ── Case-specific context questions (step 3) ─────────────────────────────

type ContextQ = { key: string; label: string; hint?: string } & (
  | { type: "radio";  options: string[] }
  | { type: "select"; options: string[] }
  | { type: "text";   placeholder: string }
);

const CONTEXT_QUESTIONS: Partial<Record<CaseType, ContextQ[]>> = {
  divorce: [
    { key: "children",  label: "Do you have children together?",  type: "radio",  options: ["Yes", "No"] },
    { key: "property",  label: "Is there property to divide?",    type: "radio",  options: ["Yes", "No"] },
    { key: "contested", label: "Is this contested?",              type: "radio",  options: ["Yes", "No", "Not sure"] },
  ],
  custody: [
    { key: "role",  label: "Your role",                          type: "radio",  options: ["Mother", "Father", "Guardian"] },
    { key: "order", label: "Is there a current custody order?",  type: "radio",  options: ["Yes", "No"] },
  ],
  landlord_tenant: [
    { key: "role",  label: "You are the",                        type: "radio",  options: ["Tenant", "Landlord"] },
    { key: "issue", label: "Main issue",                         type: "select", options: ["Eviction", "Security deposit", "Repairs / habitability", "Lease dispute", "Other"] },
  ],
  employment: [
    { key: "issue", label: "What happened?",                     type: "select", options: ["Wrongful termination", "Harassment", "Discrimination", "Unpaid wages", "Retaliation", "Other"] },
  ],
  small_claims: [
    { key: "amount", label: "Approximate amount in dispute",     type: "text", placeholder: "e.g. $5,000", hint: "Rough estimate is fine" },
  ],
};

// ── Upload file state ─────────────────────────────────────────────────────

interface UploadFile {
  id: string; file: File;
  status: "queued" | "hashing" | "uploading" | "done" | "error";
  error?: string;
}

// ── Shared styles ─────────────────────────────────────────────────────────

const btn      = "bg-[var(--vera-accent)] text-white px-6 py-3 rounded-xl font-semibold hover:opacity-90 transition-opacity text-sm disabled:opacity-40 disabled:cursor-not-allowed";
const ghostBtn = "border border-[var(--vera-border)] text-[var(--vera-muted)] px-6 py-3 rounded-xl font-medium hover:bg-[var(--vera-cream)] transition-colors text-sm";
const inputCls = "w-full border border-[var(--vera-border)] rounded-xl px-4 py-3 text-sm outline-none bg-white text-[var(--vera-text)] placeholder:text-[var(--vera-subtle)] focus:ring-2 focus:ring-[var(--vera-accent)]/20 focus:border-[var(--vera-accent)] transition-colors";

// ── Wizard shell ──────────────────────────────────────────────────────────

// Steps 1-4 are the "real" wizard — shown in progress bar.
// Steps 5 (upload) and 6 (done) are post-creation and not counted.
const WIZARD_STEPS = 4;

function ProgressBar({ step, totalSteps }: { step: number; totalSteps: number }) {
  const visible = Math.min(step, totalSteps);
  return (
    <div className="mb-2">
      <div className="flex gap-1.5 mb-2">
        {Array.from({ length: totalSteps }).map((_, i) => (
          <div key={i} className="h-1 flex-1 rounded-full transition-all duration-300"
            style={{ background: i + 1 <= visible ? "var(--vera-accent)" : "var(--vera-border)" }} />
        ))}
      </div>
      {step <= totalSteps && (
        <p className="text-[11px]" style={{ color: "var(--vera-subtle)" }}>
          Step {step} of {totalSteps} · You can change everything later
        </p>
      )}
    </div>
  );
}

function StepHeader({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="space-y-1 mb-7">
      <h1 className="text-2xl font-bold tracking-tight leading-snug" style={{ color: "var(--vera-text)" }}>{title}</h1>
      {hint && <p className="text-sm leading-relaxed" style={{ color: "var(--vera-muted)" }}>{hint}</p>}
    </div>
  );
}

// ── Main wizard ───────────────────────────────────────────────────────────

export default function NewCasePage() {
  const router = useRouter();

  const [step,           setStep]           = useState(1);
  const [caseType,       setCaseType]       = useState<CaseType | null>(null);
  const [pendingType,    setPendingType]     = useState<CaseType | null>(null); // brief selected state
  const [opposing,       setOpposing]       = useState("");
  const [contextAnswers, setContextAnswers] = useState<Record<string, string>>({});
  const [jurisdiction,   setJurisdiction]   = useState("");

  const [caseId,      setCaseId]      = useState<string | null>(null);
  const [creating,    setCreating]    = useState(false);
  const [createError, setCreateError] = useState("");

  const [uploadFiles, setUploadFiles] = useState<UploadFile[]>([]);
  const [dragOver,    setDragOver]    = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [processing, setProcessing] = useState(false);
  const [processLog, setProcessLog] = useState("");
  const [results, setResults] = useState<{
    timeline: { date: string; event: string }[];
    evidence: { ref: string; title: string; summary: string }[];
    tasks:    { title: string; priority: string }[];
  } | null>(null);

  // ── Case type selection with brief selected-state delay ──────────

  useEffect(() => {
    if (!pendingType) return;
    const t = setTimeout(() => { setCaseType(pendingType); setPendingType(null); setStep(2); }, 300);
    return () => clearTimeout(t);
  }, [pendingType]);

  // ── Context questions ─────────────────────────────────────────────

  const contextQs = caseType ? (CONTEXT_QUESTIONS[caseType] ?? []) : [];
  const allContextAnswered = contextQs.length === 0 || contextQs.every(q => contextAnswers[q.key]?.trim());

  // ── Case creation (end of step 4) ────────────────────────────────

  async function createCase() {
    if (!caseType || !jurisdiction.trim()) return;
    setCreating(true); setCreateError("");
    try {
      const typeLabel = CASE_TYPES.find(c => c.type === caseType)?.sub ?? "";
      const name = opposing.trim() ? `${opposing.trim()} — ${typeLabel}` : typeLabel;
      const res = await fetch("/api/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name, case_type: caseType,
          opposing_party: opposing.trim() || null,
          jurisdiction:   jurisdiction.trim(),
          metadata:       contextAnswers,
        }),
      });
      if (!res.ok) {
        let errMsg = `Error ${res.status}`;
        try { errMsg = ((await res.json()) as { error?: string }).error ?? errMsg; } catch { /* non-JSON body */ }
        throw new Error(errMsg);
      }
      const data = await res.json() as { id: string };
      setCaseId(data.id);
      track("case_created", { caseType: caseType ?? "" });
      setStep(5); // move to upload
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : "Something went wrong — please try again.");
    } finally { setCreating(false); }
  }

  // ── Upload logic ──────────────────────────────────────────────────

  const uploadFile = useCallback(async (item: UploadFile, id: string) => {
    const update = (patch: Partial<UploadFile>) =>
      setUploadFiles(prev => prev.map(f => f.id === id ? { ...f, ...patch } : f));
    try {
      update({ status: "hashing" });
      const buf    = await item.file.arrayBuffer();
      const digest = await crypto.subtle.digest("SHA-256", buf);
      const sha256 = Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2,"0")).join("");
      update({ status: "uploading" });
      if (!needsClientUploadNew(item.file)) {
        const fd = new FormData(); fd.append("file", item.file); fd.append("sha256", sha256);
        const res = await fetch(`/api/cases/${caseId}/documents/upload-server`, { method: "POST", body: fd });
        if (!res.ok) throw new Error(await res.text());
      } else {
        const blob = await upload(item.file.name, item.file, { access: "private", handleUploadUrl: `/api/cases/${caseId}/documents/upload` });
        await fetch(`/api/cases/${caseId}/documents`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ filename: item.file.name, blob_url: blob.url, blob_pathname: blob.pathname, sha256, file_size: item.file.size }) });
      }
      update({ status: "done" });
    } catch (e) { update({ status: "error", error: String(e) }); }
  }, [caseId]);

  function addFiles(files: File[]) {
    const items: UploadFile[] = files.map(f => ({ id: Math.random().toString(36).slice(2), file: f, status: "queued" as const }));
    setUploadFiles(prev => { const next = [...prev, ...items]; items.forEach(i => setTimeout(() => uploadFile(i, i.id), 0)); return next; });
  }
  function handleDrop(e: React.DragEvent) { e.preventDefault(); setDragOver(false); addFiles(Array.from(e.dataTransfer.files)); }
  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) { if (e.target.files?.length) addFiles(Array.from(e.target.files)); }

  const allDone      = uploadFiles.length > 0 && uploadFiles.every(f => f.status === "done" || f.status === "error");
  const anyUploading = uploadFiles.some(f => ["queued","hashing","uploading"].includes(f.status));

  // ── Processing ────────────────────────────────────────────────────

  async function startProcessing() {
    if (!caseId) return;
    setStep(6); setProcessing(true); setProcessLog("Sending your documents to Vera…");
    const res = await fetch(`/api/cases/${caseId}/process`, { method: "POST" });
    if (res.status === 403) {
      setProcessing(false);
      const { url } = await (await fetch("/api/stripe/checkout", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ caseId }) })).json() as { url?: string };
      if (url) window.location.href = url;
      return;
    }
    if (!res.body) { setProcessing(false); return; }
    const reader = res.body.getReader(); const decoder = new TextDecoder(); let buf = "";
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split("\n"); buf = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        try {
          const ev = JSON.parse(line.slice(6)) as { type: string; message?: string };
          if (ev.type === "progress") setProcessLog(ev.message ?? "");
          if (ev.type === "done") { setProcessLog(ev.message ?? "Done!"); const a = ev as Record<string,unknown>; if (a.summary) setResults(a.summary as typeof results); }
        } catch { /* skip */ }
      }
    }
    setProcessing(false);
  }

  // ── Render ────────────────────────────────────────────────────────

  return (
    <div className="max-w-lg mx-auto">
      <ProgressBar step={contextQs.length > 0 ? step : step > 2 ? step - 1 : step} totalSteps={contextQs.length > 0 ? WIZARD_STEPS : WIZARD_STEPS - 1} />

      {/* ── Step 1: Case type ─────────────────────────────────────── */}
      {step === 1 && (
        <div className="space-y-4">
          <StepHeader title="What are you dealing with?" hint="Choose the closest match — you can adjust it later." />
          <div className="space-y-2.5">
            {CASE_TYPES.map(ct => {
              const isSelected = pendingType === ct.type || caseType === ct.type;
              return (
                <button key={ct.type}
                  onClick={() => { if (!pendingType) setPendingType(ct.type); }}
                  disabled={!!pendingType}
                  className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-left transition-all"
                  style={{
                    background: isSelected ? "var(--vera-accent-light)" : "var(--vera-surface)",
                    border: `1.5px solid ${isSelected ? "var(--vera-accent)" : "var(--vera-border)"}`,
                    transform: isSelected ? "scale(1.01)" : "none",
                  }}>
                  <span className="h-3 w-3 rounded-full flex-shrink-0 transition-transform" style={{ background: ct.dot, transform: isSelected ? "scale(1.3)" : "none" }} />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold" style={{ color: "var(--vera-text)" }}>{ct.label}</p>
                    <p className="text-xs" style={{ color: "var(--vera-subtle)" }}>{ct.sub}</p>
                  </div>
                  {isSelected && <span className="ml-auto text-xs font-medium flex-shrink-0" style={{ color: "var(--vera-accent)" }}>✓</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Step 2: Opposing party ────────────────────────────────── */}
      {step === 2 && caseType && (
        <div className="space-y-6">
          <StepHeader
            title="Who is on the other side?"
            hint={
              caseType === "divorce"         ? "Your spouse or soon-to-be ex." :
              caseType === "custody"         ? "The other parent or guardian." :
              caseType === "landlord_tenant" ? "Your landlord or tenant." :
              caseType === "employment"      ? "The company or employer." :
              caseType === "small_claims"    ? "The person or business that owes you." :
              "The person or organization you're in a dispute with."
            }
          />
          <input
            className={inputCls}
            placeholder={
              caseType === "employment"      ? "Company or employer name" :
              caseType === "landlord_tenant" ? "Landlord or management company name" :
              "Full name"
            }
            value={opposing}
            onChange={e => setOpposing(e.target.value)}
            onKeyDown={e => e.key === "Enter" && opposing.trim() && setStep(contextQs.length > 0 ? 3 : 4)}
            autoFocus
          />
          <div className="flex gap-3">
            <button onClick={() => setStep(1)} className={ghostBtn}>← Back</button>
            <button
              onClick={() => setStep(contextQs.length > 0 ? 3 : 4)}
              className={btn + " flex-1"}>
              Continue →
            </button>
          </div>
          {!opposing.trim() && (
            <button onClick={() => setStep(contextQs.length > 0 ? 3 : 4)}
              className="w-full text-xs text-center py-1"
              style={{ color: "var(--vera-subtle)", background: "none", border: "none", cursor: "pointer" }}>
              I don&apos;t know yet — skip for now
            </button>
          )}
        </div>
      )}

      {/* ── Step 3: Context questions ─────────────────────────────── */}
      {step === 3 && caseType && contextQs.length > 0 && (
        <div className="space-y-6">
          <StepHeader
            title="Help Vera understand your situation"
            hint="These details shape how Vera organizes your case and what it flags as important."
          />
          <div className="space-y-5">
            {contextQs.map(q => (
              <div key={q.key}>
                <label className="block text-sm font-medium mb-2" style={{ color: "var(--vera-text)" }}>{q.label}</label>
                {q.hint && <p className="text-xs mb-2" style={{ color: "var(--vera-subtle)" }}>{q.hint}</p>}
                {q.type === "radio" && (
                  <div className="flex flex-wrap gap-2">
                    {q.options.map(opt => (
                      <button key={opt}
                        onClick={() => setContextAnswers(prev => ({ ...prev, [q.key]: opt }))}
                        className="px-4 py-2 rounded-xl text-sm font-medium border transition-all"
                        style={contextAnswers[q.key] === opt
                          ? { background: "var(--vera-accent)", color: "#fff", borderColor: "var(--vera-accent)" }
                          : { background: "#fff", color: "var(--vera-muted)", borderColor: "var(--vera-border)" }}>
                        {opt}
                      </button>
                    ))}
                  </div>
                )}
                {q.type === "select" && (
                  <select className={inputCls} value={contextAnswers[q.key] ?? ""}
                    onChange={e => setContextAnswers(prev => ({ ...prev, [q.key]: e.target.value }))}>
                    <option value="">Select one…</option>
                    {q.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                )}
                {q.type === "text" && (
                  <input className={inputCls} placeholder={q.placeholder}
                    value={contextAnswers[q.key] ?? ""}
                    onChange={e => setContextAnswers(prev => ({ ...prev, [q.key]: e.target.value }))} />
                )}
              </div>
            ))}
          </div>
          <div className="flex gap-3">
            <button onClick={() => setStep(2)} className={ghostBtn}>← Back</button>
            <button onClick={() => setStep(4)} disabled={!allContextAnswered} className={btn + " flex-1"}>Continue →</button>
          </div>
          <button onClick={() => setStep(4)} className="w-full text-xs text-center py-1"
            style={{ color: "var(--vera-subtle)", background: "none", border: "none", cursor: "pointer" }}>
            Skip these questions
          </button>
        </div>
      )}

      {/* ── Step 4: Jurisdiction → creates case ──────────────────── */}
      {step === 4 && creating && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(255,255,255,0.7)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ width: 32, height: 32, border: "3px solid var(--vera-accent)", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 12px" }} />
            <p style={{ fontSize: 14, color: "var(--vera-text)", fontWeight: 600 }}>Creating your case…</p>
          </div>
        </div>
      )}
      {step === 4 && (
        <div className="space-y-6">
          <StepHeader
            title="Which state is your case in?"
            hint="Vera uses this to find rules, deadlines, and forms specific to your jurisdiction."
          />
          <input
            className={inputCls}
            placeholder="e.g. Texas"
            value={jurisdiction}
            onChange={e => setJurisdiction(e.target.value)}
            onKeyDown={e => e.key === "Enter" && jurisdiction.trim() && !creating && createCase()}
            autoFocus
          />
          {createError && <p className="text-sm" style={{ color: "#DC2626" }}>{createError}</p>}
          <div className="flex gap-3">
            <button onClick={() => setStep(contextQs.length > 0 ? 3 : 2)} className={ghostBtn}>← Back</button>
            <button onClick={createCase} disabled={!jurisdiction.trim() || creating} className={btn + " flex-1"}>
              {creating ? "Creating your case…" : "Create my case →"}
            </button>
          </div>
        </div>
      )}

      {/* ── Step 5: Upload ────────────────────────────────────────── */}
      {step === 5 && caseId && (
        <div className="space-y-5">
          <div className="rounded-2xl px-5 py-4 flex items-center justify-between gap-3" style={{ background: "#DCFCE7", border: "1px solid #BBF7D0" }}>
            <div className="flex items-center gap-3">
              <span className="text-lg">✓</span>
              <p className="text-sm font-semibold" style={{ color: "#15803D" }}>Your case is set up</p>
            </div>
            <button onClick={() => router.push(`/cases/${caseId!}${uploadFiles.length > 0 ? "?autoprocess=1" : ""}`)}
              className="text-xs font-medium flex-shrink-0"
              style={{ color: "#15803D", background: "none", border: "none", cursor: "pointer" }}>
              Go to case →
            </button>
          </div>
          <StepHeader
            title="Upload what you have"
            hint="Texts, emails, court papers, photos, voicemails — Vera reads everything and pulls out what matters. You can always add more later."
          />
          {caseType && CASE_INSIGHTS[caseType] && (
            <div className="rounded-xl px-4 py-3.5 flex gap-3" style={{ background: "var(--vera-accent-light)", border: "1px solid #E8D5B0" }}>
              <span className="flex-shrink-0">💡</span>
              <p className="text-xs leading-relaxed" style={{ color: "var(--vera-text)" }}>{CASE_INSIGHTS[caseType]}</p>
            </div>
          )}
          <input ref={fileInputRef} type="file" multiple className="hidden"
            accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.heic,.docx,.doc,.txt,.md,.csv,.html,.eml,.mp3,.m4a,.m4v,.wav,.ogg,.aac,.mp4,.mov,.avi,.mkv,.webm,.3gp,.xlsx"
            onChange={handleFileInput} />
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className="rounded-2xl border-2 border-dashed cursor-pointer transition-all flex flex-col items-center justify-center py-10 px-6 text-center"
            style={{ borderColor: dragOver ? "var(--vera-accent)" : "var(--vera-border)", background: dragOver ? "var(--vera-accent-light)" : "var(--vera-cream)" }}>
            <svg className="h-9 w-9 mb-3" style={{ color: dragOver ? "var(--vera-accent)" : "var(--vera-subtle)" }}
              viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            <p className="font-semibold text-sm mb-1" style={{ color: "var(--vera-text)" }}>{dragOver ? "Drop to upload" : "Drop files here"}</p>
            <p className="text-xs" style={{ color: "var(--vera-subtle)" }}>or click to browse · PDFs, photos, Word, audio, video, email</p>
          </div>
          {uploadFiles.length > 0 && (
            <div className="space-y-2">
              {uploadFiles.map(f => (
                <div key={f.id} className="flex items-center gap-3 px-4 py-3 rounded-xl"
                  style={{ background: "var(--vera-surface)", border: "1px solid var(--vera-border)" }}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: "var(--vera-text)" }}>{f.file.name}</p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--vera-subtle)" }}>{(f.file.size / 1024).toFixed(0)} KB</p>
                  </div>
                  <FileStatusBadge status={f.status} error={f.error} />
                </div>
              ))}
            </div>
          )}
          <div className="space-y-3">
            {uploadFiles.length > 0 && allDone ? (
              <>
                <button onClick={startProcessing} disabled={anyUploading} className={btn + " w-full justify-center"}>
                  Analyze {uploadFiles.filter(f => f.status === "done").length} document{uploadFiles.filter(f => f.status === "done").length !== 1 ? "s" : ""} with AI — $49
                </button>
                <p className="text-center text-xs" style={{ color: "var(--vera-subtle)" }}>One-time · No subscription · Vera reads everything and builds your case file</p>
                <button onClick={() => router.push(`/cases/${caseId}?autoprocess=1`)} className="w-full text-center text-sm py-2 hover:opacity-70 transition-opacity" style={{ color: "var(--vera-subtle)" }}>
                  Skip for now — go to my case
                </button>
              </>
            ) : anyUploading ? (
              <button disabled className={btn + " w-full justify-center opacity-50"}>Uploading…</button>
            ) : (
              <div className="space-y-3">
                <button onClick={() => router.push(`/cases/${caseId}`)} className={btn + " w-full justify-center"}>
                  Go to my case →
                </button>
                <p className="text-xs text-center" style={{ color: "var(--vera-subtle)" }}>You can upload documents any time from your case page</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Step 6: Processing / Done ─────────────────────────────── */}
      {step === 6 && caseId && (
        <div className="space-y-6">
          {processing ? (
            <>
              <p className="text-xs font-bold uppercase tracking-[0.2em]" style={{ color: "var(--vera-accent)" }}>Working on it</p>
              <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--vera-text)" }}>Vera is reading your documents…</h1>
              <p className="text-sm" style={{ color: "var(--vera-muted)" }}>Extracting timeline events, evidence, and action items.</p>
              <div className="rounded-2xl px-5 py-4" style={{ background: "var(--vera-accent-light)", border: "1px solid #E8D5B0" }}>
                <div className="flex items-center gap-2">
                  {[0,1,2].map(i => <span key={i} className="h-1.5 w-1.5 rounded-full animate-bounce" style={{ background: "var(--vera-accent)", animationDelay: `${i * 0.15}s` }} />)}
                  <p className="text-sm font-medium" style={{ color: "var(--vera-accent)" }}>{processLog}</p>
                </div>
              </div>
            </>
          ) : results ? (
            <>
              <p className="text-xs font-bold uppercase tracking-[0.2em]" style={{ color: "var(--vera-accent)" }}>Your case is ready</p>
              <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--vera-text)" }}>Here&apos;s what Vera found.</h1>
              <p className="text-sm" style={{ color: "var(--vera-muted)" }}>You&apos;re already ahead. Review and add to this as your case develops.</p>
              <div className="space-y-3">
                {results.timeline.length > 0 && <ResultSection label="Timeline entries" count={results.timeline.length} color="#DBEAFE" textColor="#1D4ED8" items={results.timeline.map(e => `${e.date} — ${e.event}`)} />}
                {results.evidence.length > 0 && <ResultSection label="Evidence items" count={results.evidence.length} color="var(--vera-accent-light)" textColor="var(--vera-accent)" items={results.evidence.map(e => `${e.ref} — ${e.title}`)} />}
                {results.tasks.length > 0 && <ResultSection label="Suggested tasks" count={results.tasks.length} color="#DCFCE7" textColor="#15803D" items={results.tasks.map(t => t.title)} />}
                {results.timeline.length === 0 && results.evidence.length === 0 && results.tasks.length === 0 && (
                  <div className="rounded-xl px-4 py-3 text-sm" style={{ background: "var(--vera-cream)", color: "var(--vera-muted)" }}>No items extracted — try uploading more documents or different file types.</div>
                )}
              </div>
              <button onClick={() => router.push(`/cases/${caseId}`)} className={btn + " w-full justify-center"}>View my case →</button>
            </>
          ) : (
            <>
              <p className="text-xs font-bold uppercase tracking-[0.2em]" style={{ color: "var(--vera-accent)" }}>You&apos;re all set</p>
              <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--vera-text)" }}>Your case is ready.</h1>
              <p className="text-sm" style={{ color: "var(--vera-muted)" }}>We&apos;ve set up your case with a starter task list. Upload documents any time to let Vera build your timeline and evidence log.</p>
              <button onClick={() => router.push(`/cases/${caseId}`)} className={btn + " w-full justify-center"}>Go to my case →</button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────

function FileStatusBadge({ status, error }: { status: UploadFile["status"]; error?: string }) {
  if (status === "done")      return <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: "#DCFCE7", color: "#15803D" }}>Done</span>;
  if (status === "error")     return <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0" title={error} style={{ background: "#FEE2E2", color: "#DC2626" }}>Error</span>;
  if (status === "hashing")   return <span className="text-[11px] font-medium flex-shrink-0" style={{ color: "var(--vera-subtle)" }}>Securing…</span>;
  if (status === "uploading") return <span className="text-[11px] font-medium flex-shrink-0" style={{ color: "var(--vera-accent)" }}>Uploading…</span>;
  return <span className="text-[11px] font-medium flex-shrink-0" style={{ color: "var(--vera-subtle)" }}>Queued</span>;
}

function ResultSection({ label, count, color, textColor, items }: { label: string; count: number; color: string; textColor: string; items: string[] }) {
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
        {preview.map((item, i) => <p key={i} className="px-4 py-2 text-xs leading-relaxed" style={{ color: "var(--vera-text)" }}>{item}</p>)}
        {rest.length > 0 && !expanded && <button onClick={() => setExpanded(true)} className="w-full px-4 py-2 text-xs text-left hover:opacity-70" style={{ color: "var(--vera-muted)" }}>+ {rest.length} more</button>}
        {expanded && rest.map((item, i) => <p key={i} className="px-4 py-2 text-xs leading-relaxed" style={{ color: "var(--vera-text)" }}>{item}</p>)}
      </div>
    </div>
  );
}
