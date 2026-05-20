"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { upload } from "@vercel/blob/client";
import ProcessingSummary from "./ProcessingSummary";
import ReactMarkdown from "react-markdown";

// Audio/video always go client-side (bypass function body limit).
// Other files use client-side above 3 MB (safe margin below Vercel's 4.5 MB limit).
const AUDIO_EXTS_SET = new Set(["mp3","m4a","wav","ogg","aac","flac","wma","aiff","aif","amr","mp4","mov","avi","mkv","webm","m4v","3gp"]);
const SERVER_MAX = 3 * 1024 * 1024;

function needsClientUpload(file: File): boolean {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return AUDIO_EXTS_SET.has(ext) || file.size > SERVER_MAX;
}

async function uploadToVeraStorage(file: File, caseId: string): Promise<Row> {
  const buf    = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buf);
  const sha256 = Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2,"0")).join("");

  if (!needsClientUpload(file)) {
    // Small non-audio file — route through Next.js server
    const fd = new FormData();
    fd.append("file", file);
    fd.append("sha256", sha256);
    const res = await fetch(`/api/cases/${caseId}/documents/upload-server`, { method: "POST", body: fd });
    if (!res.ok) {
      const text = await res.text();
      let msg = text;
      try { msg = (JSON.parse(text) as { error?: string }).error ?? text; } catch { /* raw */ }
      throw new Error(msg);
    }
    return res.json();
  } else {
    // Audio, video, or large file — upload directly to Vercel Blob, bypassing the function body limit
    const blob = await upload(file.name, file, {
      access: "private",
      handleUploadUrl: `/api/cases/${caseId}/documents/upload`,
    });
    const res = await fetch(`/api/cases/${caseId}/documents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename: file.name, blob_url: blob.url, blob_pathname: blob.pathname, sha256, file_size: file.size }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }
}

function fmtDate(v: unknown): string {
  if (!v) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = String(v);
  // Already YYYY-MM-DD or YYYY-MM-DDTHH:mm
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  // Any other format (e.g. "March 12, 2020", "Thu Mar 12 2020...") — parse and reformat
  try {
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  } catch { /* ignore */ }
  return s.slice(0, 10);
}
function fmtDateTime(v: unknown): string {
  if (!v) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 19).replace("T", " ");
  return String(v).slice(0, 19).replace("T", " ");
}

// ── File Integrity Badge ───────────────────────────────────────────────────

function IntegrityBadge({ hash }: { hash: string }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied]     = useState(false);
  function copy() {
    navigator.clipboard.writeText(hash);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  }
  return (
    <div className="pl-8 space-y-1 mt-1">
      <button onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-[11px] font-medium transition-colors"
        style={{ color: "var(--vera-accent)" }}>
        <svg className="h-3 w-3" viewBox="0 0 16 16" fill="currentColor">
          <path fillRule="evenodd" d="M8 1a5 5 0 0 0-5 5v1H2a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1h-1V6a5 5 0 0 0-5-5zm3 6V6a3 3 0 1 0-6 0v1h6z" clipRule="evenodd"/>
        </svg>
        File integrity protected
        <svg className={`h-3 w-3 transition-transform ${expanded ? "rotate-180" : ""}`} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M2 4l4 4 4-4"/></svg>
      </button>
      {expanded && (
        <div className="rounded-xl p-3 space-y-2 text-xs leading-relaxed"
          style={{ background: "var(--vera-accent-light)", border: "1px solid #E8D5B0", color: "var(--vera-text)" }}>
          <p><span className="font-semibold">What this means:</span> Vera created a SHA-256 fingerprint the moment this file was uploaded — a tamper-evident seal. Any change to the file changes the fingerprint.</p>
          <p style={{ color: "var(--vera-muted)" }}>Your attorney or opposing counsel can verify authenticity by running the original file through any SHA-256 tool and comparing to the value below.</p>
          <div className="rounded-lg px-3 py-2 flex items-center gap-2" style={{ background: "var(--vera-surface)", border: "1px solid #E8D5B0" }}>
            <span className="font-mono text-[10px] flex-1 break-all" style={{ color: "var(--vera-muted)" }}>{hash}</span>
            <button onClick={copy} className="flex-shrink-0 text-[10px] font-semibold border rounded px-2 py-1 transition-colors"
              style={{ color: "var(--vera-accent)", borderColor: "#E8D5B0", background: "var(--vera-surface)" }}>
              {copied ? "Copied ✓" : "Copy"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────

interface Row { [key: string]: unknown }

const FREE_PROCESS_LIMIT = 3;

interface Props {
  caseId: string; caseType: string;
  caseName: string; caseOpposing: string; caseJurisdiction: string;
  caseCourt: string; caseCaseNumber: string; caseHearingDate: string;
  caseStatus: string; casePetitionerName: string;
  relatedCases: Array<{ id: string; name: string }>;
  timeline: Row[]; evidence: Row[]; documents: Row[];
  tasks: Row[]; captures: Row[]; deadlines: Row[];
  finances: Row[]; initialNotes: string; isUnlocked: boolean;
}

// ── Shared styles ─────────────────────────────────────────────────────────

const btn = "px-4 py-2 rounded-xl text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-[var(--vera-accent)] text-white hover:bg-[var(--vera-accent-hover)]";
const ghostBtn = "px-4 py-2 rounded-xl text-sm font-medium transition-colors border text-[var(--vera-muted)] hover:text-[var(--vera-text)] hover:bg-[var(--vera-cream)] border-[var(--vera-border)]";
const inputCls = "w-full rounded-xl px-3 py-2 text-sm outline-none transition-colors bg-white border border-[var(--vera-border)] text-[var(--vera-text)] placeholder:text-[var(--vera-subtle)] focus:ring-2 focus:ring-[var(--vera-accent)]/20 focus:border-[var(--vera-accent)]";
const card = "rounded-2xl bg-white border border-[var(--vera-border)] shadow-[0_1px_3px_rgba(28,25,23,0.06)]";

// ── Lock CTA ──────────────────────────────────────────────────────────────

function LockIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="7" width="10" height="8" rx="1.5"/>
      <path d="M5 7V5a3 3 0 0 1 6 0v2"/>
    </svg>
  );
}

function LockCta({ caseId, message }: { caseId: string; message: string }) {
  const [loading, setLoading] = useState(false);
  async function unlock() {
    setLoading(true);
    const res  = await fetch("/api/stripe/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ caseId }) });
    const { url, error } = await res.json() as { url?: string; error?: string };
    if (error || !url) { alert(error ?? "Something went wrong"); setLoading(false); return; }
    window.location.href = url;
  }
  return (
    <div className="rounded-2xl px-5 py-8 text-center space-y-3" style={{ background: "linear-gradient(135deg, #FDF4E6, #FAF0DC)", border: "2px solid #E8D5B0" }}>
      <p className="text-sm font-semibold" style={{ color: "var(--vera-text)" }}>Your case is ready for Vera&apos;s full analysis</p>
      <p className="text-xs leading-relaxed max-w-xs mx-auto" style={{ color: "var(--vera-muted)" }}>{message}</p>
      <button onClick={unlock} disabled={loading}
        className="flex items-center gap-2 mx-auto text-sm font-bold px-6 py-2.5 rounded-xl transition-colors disabled:opacity-50"
        style={{ background: "var(--vera-accent)", color: "#fff" }}>
        <LockIcon size={14} />
        {loading ? "Redirecting…" : "Unlock this case — $49"}
      </button>
      <p className="text-[11px]" style={{ color: "var(--vera-subtle)" }}>One-time · No subscription</p>
    </div>
  );
}

// ── Timeline Tab ──────────────────────────────────────────────────────────

function TimelineEntry({ entry, caseId, onDelete }: { entry: Row; caseId: string; onDelete: (id: string) => void }) {
  const router = useRouter();
  const [note, setNote]               = useState((entry.note as string) ?? "");
  const [draft, setDraft]             = useState((entry.note as string) ?? "");
  const [editing, setEditing]         = useState(false);
  const [status, setStatus]           = useState<"idle"|"saving"|"saved"|"deleting">("idle");
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function saveNote() {
    if (draft === note) { setEditing(false); return; }
    setStatus("saving");
    await fetch(`/api/cases/${caseId}/timeline/${entry.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note: draft }),
    });
    setNote(draft);
    setStatus("saved");
    setEditing(false);
    setTimeout(() => setStatus("idle"), 2000);
  }

  async function deleteEntry() {
    setStatus("deleting");
    await fetch(`/api/cases/${caseId}/timeline/${entry.id}`, { method: "DELETE" });
    onDelete(entry.id as string);
    window.dispatchEvent(new CustomEvent("vera:case-updated"));
    router.refresh();
  }

  return (
    <div className="flex gap-3 px-4 py-3 group">
      <span className="text-xs tabular-nums w-24 flex-shrink-0 pt-0.5" style={{ color: "var(--vera-subtle)" }}>
        {fmtDate(entry.date)}
      </span>
      <span className="h-2 w-2 rounded-full flex-shrink-0 mt-1.5" style={{ background: "var(--vera-accent)" }} />
      <div className="flex-1 min-w-0 space-y-1.5">
        <p className="text-sm leading-relaxed" style={{ color: "var(--vera-text)" }}>{entry.event as string}</p>
        {note && !editing && (
          <div className="rounded-lg px-2.5 py-1.5 text-xs leading-relaxed"
            style={{ background: "var(--vera-accent-light)", border: "1px solid #E8D5B0", color: "var(--vera-text)" }}>
            {note}
          </div>
        )}
        {editing ? (
          <div className="space-y-1.5">
            <textarea value={draft} onChange={e => setDraft(e.target.value)} rows={2}
              autoFocus
              onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) saveNote(); if (e.key === "Escape") setEditing(false); }}
              placeholder="Add a note about this event…"
              className="w-full text-xs rounded-lg px-2.5 py-1.5 resize-none outline-none border"
              style={{ borderColor: "var(--vera-border)", background: "var(--vera-cream)", color: "var(--vera-text)" }} />
            <div className="flex items-center gap-2">
              <button onClick={saveNote} disabled={status === "saving"}
                className="text-[11px] px-2.5 py-1 rounded-lg font-semibold disabled:opacity-40"
                style={{ background: "var(--vera-accent)", color: "#fff" }}>
                {status === "saving" ? "Saving…" : "Save"}
              </button>
              <button onClick={() => { setDraft(note); setEditing(false); }}
                className="text-[11px] px-2.5 py-1 rounded-lg border"
                style={{ borderColor: "var(--vera-border)", color: "var(--vera-muted)" }}>
                Cancel
              </button>
              {status === "saved" && <span className="text-[11px]" style={{ color: "var(--vera-accent)" }}>Saved ✓</span>}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 flex-wrap">
            <button onClick={() => { setDraft(note); setEditing(true); }}
              className="text-[11px] transition-colors hover:opacity-80"
              style={{ color: "var(--vera-subtle)" }}>
              {note ? "edit note" : "+ note"}
            </button>
            {confirmDelete ? (
              <span className="flex items-center gap-1.5">
                <span className="text-[11px]" style={{ color: "#DC2626" }}>Delete?</span>
                <button onClick={deleteEntry} disabled={status === "deleting"}
                  className="text-[11px] font-semibold px-2 py-0.5 rounded disabled:opacity-40"
                  style={{ background: "#FEE2E2", color: "#DC2626" }}>
                  {status === "deleting" ? "…" : "Yes"}
                </button>
                <button onClick={() => setConfirmDelete(false)}
                  className="text-[11px] px-2 py-0.5 rounded"
                  style={{ background: "var(--vera-cream)", color: "var(--vera-muted)" }}>
                  No
                </button>
              </span>
            ) : (
              <button onClick={() => setConfirmDelete(true)}
                className="text-[11px] opacity-40 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity hover:text-red-500 min-h-[36px] px-1"
                style={{ color: "var(--vera-subtle)" }}>
                delete
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function TimelineTab({ entries, captures: initialCaptures = [], caseId }: { entries: Row[]; captures?: Row[]; caseId: string }) {
  const [list, setList]         = useState(entries);
  const [captures, setCaptures] = useState(initialCaptures);
  const [date, setDate]         = useState("");
  const [event, setEvent]       = useState("");
  const [saving, setSaving]     = useState(false);

  // Pick up captures added via FloatingCapture while Timeline was active
  useEffect(() => {
    function onCapture(e: Event) {
      const row = (e as CustomEvent).detail as Row;
      setCaptures(prev => [row, ...prev]);
    }
    window.addEventListener("vera-capture", onCapture);
    return () => window.removeEventListener("vera-capture", onCapture);
  }, []);

  // Refresh captures on mount in case they were added while another tab was open
  useEffect(() => {
    fetch(`/api/cases/${caseId}/captures`)
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setCaptures(data); })
      .catch(() => {});
  }, [caseId]);

  async function addEntry() {
    if (!date || !event.trim()) return;
    setSaving(true);
    const res = await fetch(`/api/cases/${caseId}/timeline`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, event }),
    });
    const row = await res.json();
    setList(prev => [...prev, row].sort((a, b) => (b.date as string).localeCompare(a.date as string)));
    setDate(""); setEvent(""); setSaving(false);
    window.dispatchEvent(new CustomEvent("vera:case-updated"));
  }

  // Merge entries + captures into one descending list
  type Merged = { kind: "entry"; row: Row; sortKey: string } | { kind: "capture"; row: Row; sortKey: string };
  const merged: Merged[] = [
    ...list.map(r => ({ kind: "entry" as const, row: r, sortKey: fmtDate(r.date ?? r.created_at) })),
    ...captures.map(r => ({ kind: "capture" as const, row: r, sortKey: fmtDate(r.created_at) })),
  ].sort((a, b) => b.sortKey.localeCompare(a.sortKey));

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-2">
        <input type="date" className={inputCls + " sm:w-40 flex-shrink-0"} value={date} onChange={e => setDate(e.target.value)} />
        <input className={inputCls} placeholder="Describe what happened…" value={event} onChange={e => setEvent(e.target.value)}
          onKeyDown={e => e.key === "Enter" && addEntry()} />
        <button onClick={addEntry} disabled={saving || !date || !event.trim()} className={btn + " flex-shrink-0"}>Add</button>
      </div>
      {merged.length === 0 ? (
        <div className="py-10 text-center space-y-2 px-4">
          <p className="text-sm font-semibold" style={{ color: "var(--vera-text)" }}>Start with the date it all began.</p>
          <p className="text-xs leading-relaxed" style={{ color: "var(--vera-subtle)" }}>Enter the first event above — even a rough date helps. A clear timeline is often the most persuasive thing you can show a judge or attorney. Add one entry now and build from there.</p>
        </div>
      ) : (
        <div className={card + " divide-y divide-[var(--vera-border)] overflow-hidden"}>
          {merged.map((item, i) => item.kind === "entry"
            ? <TimelineEntry key={`e-${item.row.id as string}`} entry={item.row} caseId={caseId} onDelete={id => setList(prev => prev.filter(r => r.id !== id))} />
            : (
              <div key={`c-${item.row.id as string ?? i}`} className="flex gap-3 px-4 py-3 group">
                <span className="text-xs tabular-nums w-24 flex-shrink-0 pt-0.5" style={{ color: "var(--vera-subtle)" }}>
                  {item.sortKey}
                </span>
                <span className="h-2 w-2 rounded-full flex-shrink-0 mt-1.5" style={{ background: "var(--vera-border)" }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[10px] font-semibold uppercase tracking-widest px-1.5 py-0.5 rounded"
                      style={{ background: "var(--vera-cream)", color: "var(--vera-subtle)", border: "1px solid var(--vera-border)" }}>
                      Quick note
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed" style={{ color: "var(--vera-text)" }}>{item.row.content as string}</p>
                </div>
                <button onClick={async () => {
                  setCaptures(prev => prev.filter(r => r.id !== item.row.id));
                  await fetch(`/api/cases/${caseId}/captures`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: item.row.id }) });
                }} className="text-[11px] opacity-40 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex-shrink-0 self-start pt-0.5 hover:text-red-500 min-h-[36px] px-1"
                  style={{ color: "var(--vera-subtle)" }}>✕</button>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}

// ── Documents Tab ─────────────────────────────────────────────────────────

function DocumentsTab({ docs, caseId, isUnlocked }: { docs: Row[]; caseId: string; isUnlocked: boolean; }) {
  const router = useRouter();
  const [list, setList]             = useState(docs);
  const [uploading, setUploading]   = useState(false);
  const [processing, setProcessing] = useState(false);
  const [log, setLog]               = useState("");
  const [uploadError, setUploadError] = useState("");
  const [viewing, setViewing]       = useState<string | null>(null);
  const [docIntent, setDocIntent] = useState<"standard" | "opposing" | "court_form">("standard");
  const [summary, setSummary]       = useState<{ timeline:{date:string;event:string}[]; evidence:{ref:string;title:string;summary:string}[]; tasks:{title:string;priority:string}[] } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pending       = list.filter(d => !d.processed).length;
  const processedCount = list.filter(d => d.processed).length;
  const freeRemaining  = isUnlocked ? Infinity : Math.max(0, FREE_PROCESS_LIMIT - processedCount);
  const hitFreeLimit   = !isUnlocked && processedCount >= FREE_PROCESS_LIMIT;
  const VIDEO_EXTS    = ["mp4","mov","avi","mkv","webm","m4v","3gp"];
  const WHISPER_LIMIT = 25 * 1024 * 1024;

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (VIDEO_EXTS.includes(ext) && file.size > WHISPER_LIMIT)
      alert(`This video is ${(file.size/1024/1024).toFixed(0)} MB. Files over 25 MB may fail during transcription. The file will be stored safely.`);
    setUploading(true);
    setUploadError("");
    try {
      const data = await uploadToVeraStorage(file, caseId);
      // PATCH the doc record with intent flag — avoids double-POST / row duplication
      if (docIntent !== "standard" && data.id) {
        await fetch(`/api/cases/${caseId}/documents/${data.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            is_opposing:   docIntent === "opposing",
            is_court_form: docIntent === "court_form",
          }),
        });
        data.is_opposing   = docIntent === "opposing";
        data.is_court_form = docIntent === "court_form";
      }
      setList(prev => [data, ...prev]);
      setDocIntent("standard"); // reset for next upload
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      setUploadError(msg);
      console.error(err);
    } finally { setUploading(false); if (inputRef.current) inputRef.current.value = ""; }
  }

  async function processAll() {
    if (!pending) return;
    setProcessing(true); setLog("Analyzing your documents…");
    try {
      const res = await fetch(`/api/cases/${caseId}/process`, { method: "POST" });
      if (!res.ok) {
        let msg = `Server error ${res.status}`;
        try {
          const d = await res.json() as { error?: string };
          if (d.error === "unlock_required") msg = "Unlock AI to process more documents.";
          else if (d.error) msg = d.error;
        } catch { /* ignore */ }
        setLog(msg);
        setProcessing(false);
        return;
      }
      if (res.body) {
        const reader = res.body.getReader(); const decoder = new TextDecoder(); let buf = "";
        while (true) {
          const { done, value } = await reader.read(); if (done) break;
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split("\n"); buf = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            try {
              const ev = JSON.parse(line.slice(6)) as { type: string; message?: string };
              if (ev.type === "progress") setLog(ev.message ?? "");
              if (ev.type === "done") { setLog(ev.message ?? "Done!"); const a = ev as Record<string,unknown>; if (a.summary) setSummary(a.summary as typeof summary); }
              if (ev.type === "error") setLog("⚠️ " + (ev.message ?? "Processing failed"));
            } catch { /* skip */ }
          }
        }
      }
    } catch (e) {
      setLog("Network error — please try again.");
      console.error("[processAll]", e);
    }
    setProcessing(false);
  }

  const total = summary ? summary.timeline.length + summary.evidence.length + summary.tasks.length : 0;

  return (
    <div className="space-y-4">
      {summary && <ProcessingSummary summary={summary} total={total} onDismiss={() => { window.dispatchEvent(new CustomEvent("vera:open-tab", { detail: "Timeline" })); router.refresh(); }} />}
      {/* What are you uploading? */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {([
          { value: "standard",   label: "My document" },
          { value: "opposing",   label: "Filed against me" },
        ] as const).map(opt => (
          <label key={opt.value} className="flex items-center gap-2 cursor-pointer select-none">
            <input type="radio" name="doc-type" checked={docIntent === opt.value}
              onChange={() => setDocIntent(opt.value)}
              className="accent-[var(--vera-accent)]" />
            <span className="text-xs font-medium" style={{ color: docIntent === opt.value ? "var(--vera-text)" : "var(--vera-muted)" }}>{opt.label}</span>
          </label>
        ))}
        {docIntent === "opposing" && <span className="text-xs w-full sm:w-auto" style={{ color: "var(--vera-subtle)" }}>Vera extracts their claims and your response deadline</span>}
      </div>
      <div className="flex gap-2 flex-wrap">
        <input ref={inputRef} type="file" className="hidden"
          accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.heic,.docx,.doc,.txt,.md,.csv,.html,.eml,.mp3,.m4a,.m4v,.wav,.ogg,.aac,.mp4,.mov,.avi,.mkv,.webm,.3gp,.xlsx"
          onChange={handleFileUpload} />
        <button onClick={() => inputRef.current?.click()} disabled={uploading} className={ghostBtn}>
          {uploading ? "Uploading…" : docIntent === "opposing" ? "+ Upload opposing document" : "+ Upload document"}
        </button>
        {pending > 0 && (
          hitFreeLimit ? (
            <button onClick={async () => {
              const res  = await fetch("/api/stripe/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ caseId }) });
              const { url } = await res.json() as { url?: string };
              if (url) window.location.href = url;
            }} className={btn + " flex items-center gap-1.5"}>
              <LockIcon size={14} />
              Unlock AI to process more — $49
            </button>
          ) : (
            <button onClick={processAll} disabled={processing} className={btn}>
              {processing
                ? "Processing…"
                : isUnlocked
                  ? `Process ${pending} document${pending > 1 ? "s" : ""} with AI`
                  : `Process with AI — ${freeRemaining} of ${FREE_PROCESS_LIMIT} free`}
            </button>
          )
        )}
        {!isUnlocked && processedCount > 0 && processedCount < FREE_PROCESS_LIMIT && (
          <p className="text-xs" style={{ color: "var(--vera-subtle)" }}>
            {FREE_PROCESS_LIMIT - processedCount} free AI {FREE_PROCESS_LIMIT - processedCount === 1 ? "process" : "processes"} remaining · Unlock for unlimited
          </p>
        )}
      </div>
      <p className="text-[11px]" style={{ color: "var(--vera-subtle)" }}>
        Files are stored privately and never shared. AI processing uses <a href="https://www.anthropic.com/privacy" target="_blank" rel="noopener" style={{ color: "var(--vera-accent)" }}>Anthropic&apos;s API</a> — your documents are not used to train AI models. <a href="/privacy" style={{ color: "var(--vera-accent)" }}>Privacy policy →</a>
      </p>
      {log && <p className="text-xs px-3 py-2 rounded-lg" style={{ background: "var(--vera-accent-light)", color: "var(--vera-accent)" }}>{log}</p>}
      {uploadError && (
        <div className="rounded-xl px-4 py-3 flex items-start gap-3" style={{ background: "#FEF3C7", border: "1px solid #FCD34D" }}>
          <div className="flex-1 min-w-0">
            <p className="text-sm" style={{ color: "#92400E" }}>{uploadError}</p>
            {uploadError.toLowerCase().includes("upgrade") && (
              <a href="/pricing" className="text-xs font-semibold mt-1 inline-block hover:underline" style={{ color: "#D97706" }}>View Pro plans →</a>
            )}
          </div>
          <button onClick={() => setUploadError("")} className="text-xs flex-shrink-0 ml-1 opacity-60 hover:opacity-100" style={{ color: "#92400E" }}>✕</button>
        </div>
      )}
      {list.length === 0 ? (
        <div className="py-10 text-center space-y-2 px-4">
          <p className="text-sm font-semibold" style={{ color: "var(--vera-text)" }}>Upload your first document.</p>
          <p className="text-xs leading-relaxed" style={{ color: "var(--vera-subtle)" }}>Anything works — a text screenshot, a lease, a court filing, an email, a voicemail. Vera reads it and pulls out what matters. Upload one thing now to see it in action.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {list.map((d, i) => (
            <div key={i} className="space-y-2">
              <div className={card + " px-4 py-3 space-y-1"}>
                <div className="flex items-center gap-3">
                  <span className="text-base flex-shrink-0">📄</span>
                  <div className="flex-1 min-w-0">
                    <button onClick={() => setViewing(viewing === (d.id as string) ? null : (d.id as string))}
                      className="text-sm font-medium truncate block text-left hover:opacity-80"
                      style={{ color: "var(--vera-accent)" }}>
                      {d.filename as string}
                    </button>
                    <p className="text-xs mt-0.5" style={{ color: "var(--vera-subtle)" }}>
                      {fmtDate(d.created_at)}{d.file_size ? ` · ${(Number(d.file_size)/1024).toFixed(1)} KB` : ""}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    {!!d.is_opposing && (
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "#FEE2E2", color: "#DC2626" }}>Opposing</span>
                    )}
                    {!!d.is_opposing && !!d.processed && (
                      <button onClick={() => window.dispatchEvent(new CustomEvent("vera:open-tab", { detail: "Evidence" }))}
                        className="text-[11px] font-medium hover:opacity-80 transition-opacity"
                        style={{ color: "#DC2626", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                        View analysis →
                      </button>
                    )}
                    {!!d.is_court_form && (
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "#EDE9FE", color: "#7C3AED" }}>Court Form</span>
                    )}
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                      style={d.processed ? { background: "#DCFCE7", color: "#15803D" } : { background: "var(--vera-accent-light)", color: "var(--vera-accent)" }}>
                      {d.processed ? "Processed" : "Pending"}
                    </span>
                    {(() => { const fe = (d.filename as string).split(".").pop()?.toLowerCase() ?? ""; return VIDEO_EXTS.includes(fe) && Number(d.file_size) > WHISPER_LIMIT ? (
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" title="Files over 25 MB may fail during AI transcription" style={{ background: "#FEE2E2", color: "#DC2626" }}>⚠ &gt;25 MB</span>
                    ) : null; })()}
                    <button onClick={async () => {
                      if (!confirm(`Delete "${d.filename}"?`)) return;
                      setList(prev => prev.filter(r => r.id !== d.id));
                      await fetch(`/api/cases/${caseId}/documents/${d.id}`, { method:"DELETE" });
                    }} className="text-[11px] hover:text-red-500 transition-colors mt-1 min-h-[36px] px-1" style={{ color: "var(--vera-subtle)" }}>
                      delete
                    </button>
                  </div>
                </div>
                {d.sha256 ? <IntegrityBadge hash={String(d.sha256)} /> : null}
              </div>
              {viewing === (d.id as string) && (() => {
                const ext = (d.filename as string).split(".").pop()?.toLowerCase() ?? "";
                const isImg = ["jpg","jpeg","png","gif","webp","heic"].includes(ext);
                const src = `/api/cases/${caseId}/documents/${d.id}`;
                return isImg
                  ? <img src={src} alt={d.filename as string} className="w-full rounded-2xl border object-contain max-h-[600px]" style={{ borderColor: "var(--vera-border)" }} />
                  : <iframe src={src} className="w-full rounded-2xl border" style={{ height: "600px", borderColor: "var(--vera-border)" }} title={d.filename as string} />;
              })()}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Tasks Tab ─────────────────────────────────────────────────────────────

function TasksTab({ tasks, caseId }: { tasks: Row[]; caseId: string }) {
  const [list, setList]               = useState(tasks);
  const [title, setTitle]             = useState("");
  const [saving, setSaving]           = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const cols = [
    { id: "todo",       label: "To Do",       accent: "var(--vera-border)" },
    { id: "inprogress", label: "In Progress",  accent: "var(--vera-accent)" },
    { id: "done",       label: "Done",         accent: "#22C55E" },
  ] as const;
  async function addTask() {
    if (!title.trim()) return; setSaving(true);
    const row = await (await fetch(`/api/cases/${caseId}/tasks`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({title}) })).json();
    setList(prev => [...prev, row]); setTitle(""); setSaving(false);
  }
  async function moveTask(id: string, col: string) {
    setList(prev => prev.map(t => t.id === id ? { ...t, col } : t));
    await fetch(`/api/cases/${caseId}/tasks/${id}`, { method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify({col}) });
  }
  async function deleteTask(id: string) {
    setList(prev => prev.filter(t => t.id !== id));
    await fetch(`/api/cases/${caseId}/tasks/${id}`, { method:"DELETE" });
  }
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input className={inputCls} placeholder="Add a task…" value={title} onChange={e => setTitle(e.target.value)} onKeyDown={e => e.key === "Enter" && addTask()} />
        <button onClick={addTask} disabled={saving || !title.trim()} className={btn + " flex-shrink-0"}>Add</button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {cols.map(col => {
          const colTasks = list.filter(t => t.col === col.id);
          return (
            <div key={col.id}>
              <div className="flex items-center gap-2 mb-2.5 pb-2 border-b-2" style={{ borderColor: col.accent }}>
                <span className="text-xs font-bold" style={{ color: "var(--vera-text)" }}>{col.label}</span>
                <span className="ml-auto text-[11px] font-medium px-1.5 py-0.5 rounded-full" style={{ background: "var(--vera-cream)", color: "var(--vera-muted)" }}>{colTasks.length}</span>
              </div>
              <div className="space-y-2">
                {colTasks.map((t, i) => (
                  <div key={i} className={card + " p-3 text-xs group"}>
                    <p className="font-medium mb-2" style={{ color: "var(--vera-text)" }}>{t.title as string}</p>
                    <div className="flex gap-2 flex-wrap items-center">
                      {col.id !== "todo"       && <button onClick={() => moveTask(t.id as string, "todo")}       className="text-[11px]" style={{ color: "var(--vera-subtle)" }}>← To Do</button>}
                      {col.id !== "inprogress" && <button onClick={() => moveTask(t.id as string, "inprogress")} className="text-[11px]" style={{ color: "var(--vera-accent)" }}>▶ Start</button>}
                      {col.id !== "done"       && <button onClick={() => moveTask(t.id as string, "done")}       className="text-[11px]" style={{ color: "#16A34A" }}>✓ Done</button>}
                      {confirmDeleteId === (t.id as string) ? (
                        <span className="ml-auto flex items-center gap-1">
                          <button onClick={() => { deleteTask(t.id as string); setConfirmDeleteId(null); }}
                            className="text-[11px] font-semibold px-2 py-0.5 rounded"
                            style={{ background: "#FEE2E2", color: "#DC2626" }}>Yes</button>
                          <button onClick={() => setConfirmDeleteId(null)}
                            className="text-[11px] px-2 py-0.5 rounded"
                            style={{ background: "var(--vera-cream)", color: "var(--vera-muted)" }}>No</button>
                        </span>
                      ) : (
                        <button onClick={() => setConfirmDeleteId(t.id as string)} className="text-[11px] ml-auto opacity-40 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity hover:text-red-500 min-h-[36px] px-1" style={{ color: "var(--vera-subtle)" }}>✕</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Log Tab (captures) ────────────────────────────────────────────────────

function LogTab({ captures, caseId }: { captures: Row[]; caseId: string }) {
  const [list, setList]     = useState(captures);
  const [text, setText]     = useState("");
  const [saving, setSaving] = useState(false);

  // Fetch fresh on mount — captures saved via FloatingCapture while this tab
  // was unmounted would otherwise be missed (the window event fires into nothing).
  useEffect(() => {
    fetch(`/api/cases/${caseId}/captures`)
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setList(data); })
      .catch(() => {});
  }, [caseId]);

  useEffect(() => {
    function onCapture(e: Event) {
      const row = (e as CustomEvent).detail as Row;
      setList(prev => [row, ...prev]);
    }
    window.addEventListener("vera-capture", onCapture);
    return () => window.removeEventListener("vera-capture", onCapture);
  }, []);

  async function submit() {
    if (!text.trim()) return; setSaving(true);
    const row = await (await fetch(`/api/cases/${caseId}/captures`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ content: text.trim() }) })).json();
    setList(prev => [row, ...prev]); setText(""); setSaving(false);
    window.dispatchEvent(new CustomEvent("vera:case-updated"));
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <textarea className={inputCls} rows={2} placeholder="Log an event, call, or observation… (⌘Enter to save)"
          value={text} onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit(); }} />
        <button onClick={submit} disabled={saving || !text.trim()} className={btn + " flex-shrink-0 self-end"}>Log</button>
      </div>
      {list.length === 0 ? (
        <div className="py-10 text-center space-y-2 px-4">
          <p className="text-sm font-semibold" style={{ color: "var(--vera-text)" }}>Write down what happened — right now, while it&apos;s fresh.</p>
          <p className="text-xs leading-relaxed" style={{ color: "var(--vera-subtle)" }}>Type a quick note above about the most recent event in your case. The log is for raw observations — calls, conversations, things you noticed. Use the Capture button (bottom-right) to log on the go.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {list.map((c, i) => (
            <div key={i} className={card + " px-4 py-3 group flex gap-3"}>
              <div className="flex-1 min-w-0">
                <p className="text-sm leading-relaxed" style={{ color: "var(--vera-text)" }}>{c.content as string}</p>
                <p className="text-xs mt-1.5" style={{ color: "var(--vera-subtle)" }}>{fmtDateTime(c.created_at)}</p>
              </div>
              <button onClick={async () => {
                setList(prev => prev.filter(r => r.id !== c.id));
                await fetch(`/api/cases/${caseId}/captures`, { method:"DELETE", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ id: c.id }) });
              }} className="text-[11px] opacity-40 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex-shrink-0 self-start pt-0.5 hover:text-red-500 min-h-[36px] px-1"
                style={{ color: "var(--vera-subtle)" }}>✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Deadlines Tab ─────────────────────────────────────────────────────────

function DeadlinesTab({ deadlines, caseId }: { deadlines: Row[]; caseId: string }) {
  const [list, setList]     = useState(deadlines);
  const [label, setLabel]   = useState("");
  const [date, setDate]     = useState("");
  const [saving, setSaving] = useState(false);

  function daysUntil(dateVal: unknown) {
    const s = dateVal instanceof Date
      ? dateVal.toISOString().slice(0, 10)
      : String(dateVal).slice(0, 10);
    const [y, m, day] = s.split("-").map(Number);
    if (!y || !m || !day) return -999;
    const today = new Date(); today.setHours(0,0,0,0);
    return Math.round((new Date(y, m-1, day).getTime() - today.getTime()) / 86400000);
  }
  const urgencyStyle = (days: number) => {
    if (days < 0)  return { bar: "var(--vera-border)",  badge: { bg: "var(--vera-cream)",        color: "var(--vera-subtle)" } };
    if (days <= 3) return { bar: "#DC2626",              badge: { bg: "#FEE2E2",                  color: "#DC2626" } };
    if (days <= 7) return { bar: "var(--vera-accent)",   badge: { bg: "var(--vera-accent-light)", color: "var(--vera-accent)" } };
    return             { bar: "var(--vera-border)",  badge: { bg: "var(--vera-cream)",        color: "var(--vera-text)" } };
  };

  async function addDeadline() {
    if (!label.trim() || !date) return; setSaving(true);
    const row = await (await fetch(`/api/cases/${caseId}/deadlines`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ label, date }) })).json();
    setList(prev => [...prev, row].sort((a,b) => (a.date as string).localeCompare(b.date as string)));
    setLabel(""); setDate(""); setSaving(false);
    window.dispatchEvent(new CustomEvent("vera:case-updated"));
  }

  async function complete(id: string) {
    setList(prev => prev.map(d => d.id === id ? { ...d, completed: true } : d));
    await fetch(`/api/cases/${caseId}/deadlines`, { method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ id, completed: true }) });
    window.dispatchEvent(new CustomEvent("vera:case-updated"));
  }

  async function deleteDeadline(id: string) {
    setList(prev => prev.filter(d => d.id !== id));
    await fetch(`/api/cases/${caseId}/deadlines`, { method:"DELETE", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ id }) });
    window.dispatchEvent(new CustomEvent("vera:case-updated"));
  }

  const active   = list.filter(d => !d.completed);
  const done     = list.filter(d => d.completed);
  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-2">
        <input className={inputCls} placeholder="Deadline description" value={label} onChange={e => setLabel(e.target.value)} />
        <input type="date" className={inputCls + " sm:w-40 flex-shrink-0"} value={date} onChange={e => setDate(e.target.value)} />
        <button onClick={addDeadline} disabled={saving || !label.trim() || !date} className={btn + " flex-shrink-0"}>Add</button>
      </div>
      {active.length === 0 && done.length === 0 ? (
        <div className="py-10 text-center space-y-2 px-4">
          <p className="text-sm font-semibold" style={{ color: "var(--vera-text)" }}>Add your next court date or filing deadline.</p>
          <p className="text-xs leading-relaxed" style={{ color: "var(--vera-subtle)" }}>Missing a deadline can sink a case. Add anything you know — a hearing date, a response due date, even a rough estimate. Vera will count down the days so nothing sneaks up on you.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {active.length > 0 && (
            <div className={card + " divide-y divide-[var(--vera-border)] overflow-hidden"}>
              {active.map((d, i) => {
                const days  = daysUntil(d.date as string);
                const style = urgencyStyle(days);
                return (
                  <div key={i} className="flex items-center gap-3 px-4 py-3 group" style={{ opacity: days < 0 ? 0.55 : 1 }}>
                    <button onClick={() => complete(d.id as string)}
                      className="h-4 w-4 rounded border-2 flex-shrink-0 transition-colors hover:border-green-500"
                      style={{ borderColor: style.bar }} title="Mark complete" />
                    <div className="w-1 self-stretch rounded-full flex-shrink-0" style={{ background: style.bar }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium" style={{ color: "var(--vera-text)" }}>{d.label as string}</p>
                      <p className="text-xs mt-0.5" style={{ color: "var(--vera-subtle)" }}>{fmtDate(d.date)}</p>
                    </div>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full tabular-nums flex-shrink-0"
                      style={{ background: style.badge.bg, color: style.badge.color }}>
                      {days < 0 ? "Passed" : days === 0 ? "TODAY" : `${days}d`}
                    </span>
                    <button onClick={() => deleteDeadline(d.id as string)}
                      className="text-[11px] opacity-40 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity hover:text-red-500 flex-shrink-0 min-h-[36px] px-1"
                      style={{ color: "var(--vera-subtle)" }}>✕</button>
                  </div>
                );
              })}
            </div>
          )}
          {done.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--vera-subtle)" }}>Completed</p>
              <div className={card + " divide-y divide-[var(--vera-border)] overflow-hidden opacity-50"}>
                {done.map((d, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-2.5 group">
                    <span className="text-green-500 text-xs">✓</span>
                    <p className="text-sm line-through flex-1" style={{ color: "var(--vera-muted)" }}>{d.label as string}</p>
                    <p className="text-xs" style={{ color: "var(--vera-subtle)" }}>{fmtDate(d.date)}</p>
                    <button onClick={() => deleteDeadline(d.id as string)}
                      className="text-[11px] opacity-40 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity hover:text-red-500 flex-shrink-0 min-h-[36px] px-1"
                      style={{ color: "var(--vera-subtle)" }}>✕</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Evidence Tab ──────────────────────────────────────────────────────────

const SOURCE_TYPES = ["Document", "Recording", "Photograph", "Email / Text", "Police Report", "Financial Record", "Witness Statement", "Other"];

function EvidenceTab({ evidence, caseId }: { evidence: Row[]; caseId: string }) {
  const [list, setList]               = useState(evidence);
  const [title, setTitle]             = useState("");
  const [sourceType, setSrcType]      = useState("Document");
  const [summary, setSummary]         = useState("");
  const [saving, setSaving]           = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  async function addEvidence() {
    if (!title.trim()) return;
    setSaving(true);
    const res = await fetch(`/api/cases/${caseId}/evidence`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title.trim(), source_type: sourceType, summary: summary.trim() }),
    });
    const row = await res.json();
    setList(prev => [...prev, row]);
    setTitle(""); setSummary(""); setSaving(false);
    window.dispatchEvent(new CustomEvent("vera:case-updated"));
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex flex-col sm:flex-row gap-2">
          <input className={inputCls + " flex-1"} placeholder="Evidence title (e.g. Recorded call — May 13)" value={title} onChange={e => setTitle(e.target.value)}
            onKeyDown={e => e.key === "Enter" && addEvidence()} />
          <select className={inputCls + " sm:w-44 flex-shrink-0"} value={sourceType} onChange={e => setSrcType(e.target.value)}>
            {SOURCE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="flex gap-2">
          <input className={inputCls + " flex-1"} placeholder="Brief description (optional)" value={summary} onChange={e => setSummary(e.target.value)}
            onKeyDown={e => e.key === "Enter" && addEvidence()} />
          <button onClick={addEvidence} disabled={saving || !title.trim()} className={btn + " flex-shrink-0"}>Add</button>
        </div>
      </div>

      {list.length === 0 ? (
        <div className="py-10 text-center space-y-2 px-4">
          <p className="text-sm font-semibold" style={{ color: "var(--vera-text)" }}>Log your first piece of evidence.</p>
          <p className="text-xs leading-relaxed" style={{ color: "var(--vera-subtle)" }}>Think about what you already have — a recording, a screenshot, an email, a witness. Give it a title above and add it now. Each item gets a reference number so you can cite it precisely later.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {list.map((e, i) => (
            <div key={i} className={card + " px-4 py-3 space-y-1.5 group"}
              style={String(e.source_type) === "Opposing Filing" ? { borderColor: "#FECACA", background: "#FFF5F5" } : {}}>
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold" style={{ color: "var(--vera-text)" }}>{String(e.ref)} — {String(e.title)}</p>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {e.source_type ? (
                    <span className="text-[11px] font-medium px-1.5 py-0.5 rounded"
                      style={String(e.source_type) === "Opposing Filing"
                        ? { background: "#FEE2E2", color: "#DC2626" }
                        : { background: "var(--vera-cream)", color: "var(--vera-muted)" }}>
                      {String(e.source_type)}
                    </span>
                  ) : null}
                  {confirmDeleteId === (e.id as string) ? (
                    <span className="flex items-center gap-1">
                      <button onClick={async () => {
                          await fetch(`/api/cases/${caseId}/evidence/${e.id}`, { method: "DELETE" });
                          setList(prev => prev.filter(r => r.id !== e.id));
                          setConfirmDeleteId(null);
                          window.dispatchEvent(new CustomEvent("vera:case-updated"));
                        }}
                        className="text-[11px] font-semibold px-2 py-0.5 rounded"
                        style={{ background: "#FEE2E2", color: "#DC2626" }}>Yes</button>
                      <button onClick={() => setConfirmDeleteId(null)}
                        className="text-[11px] px-2 py-0.5 rounded"
                        style={{ background: "var(--vera-cream)", color: "var(--vera-muted)" }}>No</button>
                    </span>
                  ) : (
                    <button
                      onClick={() => setConfirmDeleteId(e.id as string)}
                      className="text-[11px] opacity-40 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity hover:text-red-500 min-h-[36px] px-1"
                      style={{ color: "var(--vera-subtle)" }}>
                      delete
                    </button>
                  )}
                </div>
              </div>
              {e.summary ? <p className="text-xs leading-relaxed" style={{ color: "var(--vera-muted)" }}>{String(e.summary)}</p> : null}
              {e.transcript ? (
                <button onClick={() => {
                  const blob = new Blob([String(e.transcript)], { type:"text/plain" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a"); a.href = url; a.download = `${String(e.title)}.txt`; a.click();
                  URL.revokeObjectURL(url);
                }} className="text-xs font-semibold transition-colors hover:opacity-80" style={{ color: "var(--vera-accent)" }}>
                  ↓ Download full transcript
                </button>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Finances Tab ──────────────────────────────────────────────────────────

const CATEGORIES = ["Asset", "Debt", "Income", "Expense"];
const CAT_STYLES: Record<string, { bg: string; color: string }> = {
  Asset:   { bg: "#DCFCE7", color: "#15803D" },
  Debt:    { bg: "#FEE2E2", color: "#DC2626" },
  Income:  { bg: "#DBEAFE", color: "#1D4ED8" },
  Expense: { bg: "var(--vera-accent-light)", color: "var(--vera-accent)" },
};

function FinancesTab({ finances, caseId }: { finances: Row[]; caseId: string }) {
  const [list, setList]         = useState(finances);
  const [category, setCategory] = useState("Asset");
  const [description, setDesc]  = useState("");
  const [amount, setAmount]     = useState("");
  const [date, setDate]         = useState("");
  const [saving, setSaving]     = useState(false);
  const totals = CATEGORIES.reduce((acc, cat) => { acc[cat] = list.filter(i => i.category === cat).reduce((s, i) => s + (Number(i.amount)||0), 0); return acc; }, {} as Record<string, number>);
  async function add() {
    if (!description.trim()) return; setSaving(true);
    const row = await (await fetch(`/api/cases/${caseId}/finances`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ category, description: description.trim(), amount: amount ? parseFloat(amount) : null, date }) })).json();
    setList(prev => [row, ...prev]); setDesc(""); setAmount(""); setDate(""); setSaving(false);
    window.dispatchEvent(new CustomEvent("vera:case-updated"));
  }
  async function remove(id: string) {
    setList(prev => prev.filter(i => i.id !== id));
    await fetch(`/api/cases/${caseId}/finances`, { method:"DELETE", headers:{"Content-Type":"application/json"}, body:JSON.stringify({id}) });
    window.dispatchEvent(new CustomEvent("vera:case-updated"));
  }
  const fmt = (n: number) => n ? `$${n.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}` : "—";
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {CATEGORIES.map(cat => (
          <div key={cat} className="rounded-xl px-3 py-2.5" style={{ background: CAT_STYLES[cat].bg }}>
            <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: CAT_STYLES[cat].color, opacity: 0.7 }}>{cat}s</p>
            <p className="text-sm font-bold mt-0.5" style={{ color: CAT_STYLES[cat].color }}>{fmt(totals[cat])}</p>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
        <select className={inputCls + " sm:w-28 flex-shrink-0 col-span-2 sm:col-span-1"} value={category} onChange={e => setCategory(e.target.value)}>{CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</select>
        <input className={inputCls + " col-span-2 sm:flex-1 sm:min-w-32"} placeholder="Description" value={description} onChange={e => setDesc(e.target.value)} onKeyDown={e => e.key === "Enter" && add()} />
        <input className={inputCls + " sm:w-28 flex-shrink-0"} placeholder="Amount" type="number" value={amount} onChange={e => setAmount(e.target.value)} />
        <input type="date" className={inputCls + " sm:w-36 flex-shrink-0"} value={date} onChange={e => setDate(e.target.value)} />
        <button onClick={add} disabled={saving || !description.trim()} className={btn + " col-span-2 sm:col-span-1 flex-shrink-0"}>Add</button>
      </div>
      {list.length === 0 ? (
        <div className="py-10 text-center space-y-2 px-4">
          <p className="text-sm font-semibold" style={{ color: "var(--vera-text)" }}>List what&apos;s at stake financially.</p>
          <p className="text-xs leading-relaxed" style={{ color: "var(--vera-subtle)" }}>Add the most significant asset, debt, or income item above. Even rough estimates help — this data feeds the Calculator tab so you can model settlement vs. trial outcomes before you walk into any negotiation.</p>
        </div>
      ) : (
        <div className={card + " divide-y divide-[var(--vera-border)] overflow-hidden"}>
          {list.map((item, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-2.5">
              <span className="text-[11px] font-bold px-1.5 py-0.5 rounded flex-shrink-0" style={{ background: (CAT_STYLES[item.category as string] ?? { bg: "var(--vera-cream)" }).bg, color: (CAT_STYLES[item.category as string] ?? { color: "var(--vera-muted)" }).color }}>{String(item.category)}</span>
              <span className="flex-1 text-sm min-w-0 truncate" style={{ color: "var(--vera-text)" }}>{String(item.description)}</span>
              {item.date ? <span className="text-[11px] tabular-nums" style={{ color: "var(--vera-subtle)" }}>{fmtDate(item.date)}</span> : null}
              <span className="text-sm font-semibold tabular-nums flex-shrink-0" style={{ color: (item.category === "Debt" || item.category === "Expense") ? "#DC2626" : "var(--vera-text)" }}>{item.amount ? fmt(Number(item.amount)) : "—"}</span>
              <button onClick={() => remove(item.id as string)} className="flex-shrink-0 text-xs hover:text-red-500 transition-colors" style={{ color: "var(--vera-border)" }}>✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Calculator Tab ─────────────────────────────────────────────────────────

function MoneyInput({ label, hint, value, onChange }: {
  label: string; hint?: string; value: number; onChange: (n: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [raw,     setRaw]     = useState("");

  const fmt  = (n: number) => n > 0 ? n.toLocaleString("en-US") : "";
  const bump = (delta: number) => onChange(Math.max(0, value + delta));

  function startEdit() { setEditing(true); setRaw(value > 0 ? String(value) : ""); }
  function commitEdit() {
    const n = parseInt(raw.replace(/[^0-9]/g, ""), 10);
    onChange(isNaN(n) ? 0 : n);
    setEditing(false);
  }

  return (
    <div>
      <label className="text-xs font-medium block mb-1" style={{ color: "var(--vera-muted)" }}>{label}</label>
      {hint && <p className="text-[11px] mb-2" style={{ color: "var(--vera-subtle)" }}>{hint}</p>}
      <div className="flex items-stretch rounded-xl border overflow-hidden focus-within:ring-2 focus-within:ring-[var(--vera-accent)]/20 focus-within:border-[var(--vera-accent)] transition-colors"
        style={{ borderColor: "var(--vera-border)", background: "#fff" }}>
        <span className="flex items-center px-3 text-sm font-medium border-r flex-shrink-0"
          style={{ color: "var(--vera-subtle)", borderColor: "var(--vera-border)", background: "var(--vera-cream)" }}>$</span>
        {editing ? (
          <input autoFocus type="text" inputMode="numeric"
            value={raw}
            onChange={e => setRaw(e.target.value.replace(/[^0-9]/g, ""))}
            onBlur={commitEdit}
            onKeyDown={e => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") setEditing(false); }}
            className="flex-1 px-3 py-3 text-base font-semibold outline-none tabular-nums min-w-0"
            style={{ color: "var(--vera-text)" }}
          />
        ) : (
          <button onClick={startEdit}
            className="flex-1 px-3 py-3 text-base font-semibold text-left tabular-nums min-w-0"
            style={{ color: value > 0 ? "var(--vera-text)" : "var(--vera-subtle)" }}>
            {value > 0 ? fmt(value) : <span className="font-normal text-sm">Enter amount…</span>}
          </button>
        )}
        <div className="flex flex-col border-l flex-shrink-0" style={{ borderColor: "var(--vera-border)" }}>
          <button onClick={() => bump(1000)}
            className="flex-1 px-3 text-xs font-bold border-b hover:bg-[var(--vera-cream)] transition-colors"
            style={{ borderColor: "var(--vera-border)", color: "var(--vera-muted)" }}>▲</button>
          <button onClick={() => bump(-1000)}
            className="flex-1 px-3 text-xs font-bold hover:bg-[var(--vera-cream)] transition-colors"
            style={{ color: "var(--vera-muted)" }}>▼</button>
        </div>
      </div>
      <p className="text-[11px] mt-1.5" style={{ color: "var(--vera-subtle)" }}>Click to type · ▲▼ adjust by $1,000</p>
    </div>
  );
}

const CALC_COPY: Record<string, { disputeLabel: string; disputeHint: string; shareLabel: string; shareHint: string; trialHint: string; disclaimers: string[] }> = {
  divorce: {
    disputeLabel: "Total marital estate in dispute",
    disputeHint:  "Gross value of all assets being divided — not reduced by debts",
    shareLabel:   "Your share of the estate",
    shareHint:    "50/50 is the default in community property states",
    trialHint:    "Attorney fees, court costs, expert witnesses — contested divorces average $15–40K",
    disclaimers:  ["Trial outcome uncertainty — a judge may award less than your expected share", "Time — contested divorces take 12–24 months", "Emotional cost of prolonged litigation", "Tax implications of asset division"],
  },
  custody: {
    disputeLabel: "Estimated value of custody outcome",
    disputeHint:  "Assign a rough dollar value to your ideal custody arrangement — helps compare legal costs vs. outcome",
    shareLabel:   "Percentage of your ideal outcome",
    shareHint:    "How much of your ideal custody arrangement do you expect to win?",
    trialHint:    "Attorney fees, GAL fees, evaluations, court costs — custody trials average $5–25K",
    disclaimers:  ["Trial outcome uncertainty — a judge may award less than expected", "Time — custody trials take 6–18 months", "Emotional impact on children and family", "Ongoing modification costs if circumstances change"],
  },
  landlord_tenant: {
    disputeLabel: "Amount in dispute",
    disputeHint:  "Security deposit, unpaid rent, damages, or repairs being claimed",
    shareLabel:   "Expected recovery percentage",
    shareHint:    "Percentage of the claimed amount you expect to recover",
    trialHint:    "Filing fees, time off work, service costs — eviction/small claims average $300–2K",
    disclaimers:  ["Outcome uncertainty — judges vary on damage awards", "Time — eviction or small claims typically takes 1–3 months", "Difficulty collecting even after a judgment", "Potential counterclaims from the other party"],
  },
  employment: {
    disputeLabel: "Estimated damages",
    disputeHint:  "Back pay, lost wages, benefits, emotional distress, or reinstatement value",
    shareLabel:   "Expected recovery percentage",
    shareHint:    "Percentage of total damages you expect to win at trial",
    trialHint:    "Attorney fees, expert witnesses, depositions — employment trials average $20–60K",
    disclaimers:  ["Outcome uncertainty — employment cases are hard to predict", "Time — employment litigation takes 1–3 years", "Emotional cost of reliving the workplace experience", "Strict EEOC / agency filing deadlines may limit claims"],
  },
  small_claims: {
    disputeLabel: "Amount owed to you",
    disputeHint:  "The exact amount you are claiming — check your state's small claims dollar limit",
    shareLabel:   "Expected award percentage",
    shareHint:    "Percentage of the claim you expect the court to award",
    trialHint:    "Filing fees, time off work, service costs — small claims average $200–500",
    disclaimers:  ["Winning a judgment does not guarantee collection", "Time — small claims hearings typically within 30–70 days", "Limited to your state's dollar cap (usually $5K–$25K)", "No attorneys allowed in most small claims courts"],
  },
  other: {
    disputeLabel: "Amount in dispute",
    disputeHint:  "Total value of what is being contested",
    shareLabel:   "Expected recovery percentage",
    shareHint:    "Percentage of the disputed amount you expect to receive",
    trialHint:    "Attorney fees, court costs, expert witnesses, and your time",
    disclaimers:  ["Trial outcome uncertainty — results vary widely by case type", "Time — litigation typically takes months to years", "Emotional cost of prolonged dispute", "Consult an attorney to assess your specific situation"],
  },
};

function CalculatorTab({ finances, caseType }: { finances: Row[]; caseType: string }) {
  const copy = CALC_COPY[caseType] ?? CALC_COPY.other;
  const totalAssets = finances.filter(f => f.category === "Asset").reduce((s, f) => s + (Number(f.amount)||0), 0);
  const totalDebts  = finances.filter(f => f.category === "Debt").reduce((s, f) => s + (Number(f.amount)||0), 0);
  const totalIncome = finances.filter(f => f.category === "Income").reduce((s, f) => s + (Number(f.amount)||0), 0);

  const [dispute,   setDispute]   = useState(Math.round(totalAssets) || 0);
  const [offer,     setOffer]     = useState(0);
  const [trialCost, setTrialCost] = useState(15000);
  const [share,     setShare]     = useState(50);
  const [making,    setMaking]    = useState(false); // false = receiving an offer, true = making one

  const yourOutcome = Math.round(dispute * share / 100);
  const netTrial    = yourOutcome - trialCost;
  const delta       = offer > 0 ? netTrial - offer : null;
  const fmt         = (n: number) => new Intl.NumberFormat("en-US", { style:"currency", currency:"USD", maximumFractionDigits:0 }).format(n);

  return (
    <div className="space-y-4 max-w-2xl">

      {totalAssets > 0 && (
        <div className="rounded-xl px-4 py-3 space-y-1" style={{ background: "var(--vera-accent-light)", border: "1px solid #E8D5B0" }}>
          <p className="text-xs font-semibold" style={{ color: "var(--vera-text)" }}>From your Finances tab</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            <span><span style={{ color: "var(--vera-muted)" }}>Assets: </span><strong>{fmt(totalAssets)}</strong></span>
            {totalDebts  > 0 && <span><span style={{ color: "var(--vera-muted)" }}>Debts: </span><strong style={{ color: "#DC2626" }}>{fmt(totalDebts)}</strong></span>}
            {totalIncome > 0 && <span><span style={{ color: "var(--vera-muted)" }}>Income: </span><strong style={{ color: "#1D4ED8" }}>{fmt(totalIncome)}</strong></span>}
          </div>
        </div>
      )}

      <div className={card + " p-5 space-y-5"}>
        <p className="text-sm font-semibold" style={{ color: "var(--vera-text)" }}>Your scenario</p>

        <MoneyInput label={copy.disputeLabel} hint={copy.disputeHint}
          value={dispute} onChange={setDispute} />

        {/* Share */}
        <div>
          <label className="text-xs font-medium block mb-1" style={{ color: "var(--vera-muted)" }}>{copy.shareLabel}</label>
          <p className="text-[11px] mb-2" style={{ color: "var(--vera-subtle)" }}>{copy.shareHint}</p>
          <div className="flex items-center gap-2">
            <button onClick={() => setShare(s => Math.max(1, s - 1))}
              className="w-10 h-10 rounded-xl border text-lg font-bold flex items-center justify-center flex-shrink-0 hover:bg-[var(--vera-cream)] transition-colors"
              style={{ borderColor: "var(--vera-border)", color: "var(--vera-muted)" }}>−</button>
            <div className="flex-1 rounded-xl border overflow-hidden flex focus-within:ring-2 focus-within:ring-[var(--vera-accent)]/20 focus-within:border-[var(--vera-accent)] transition-colors"
              style={{ borderColor: "var(--vera-border)", background: "#fff" }}>
              <input type="number" min={1} max={99} value={share}
                onChange={e => { const n = parseInt(e.target.value, 10); if (n >= 1 && n <= 99) setShare(n); }}
                className="flex-1 text-center text-2xl font-bold py-2 outline-none tabular-nums"
                style={{ color: "var(--vera-text)" }} />
              <span className="flex items-center pr-3 text-lg font-semibold" style={{ color: "var(--vera-subtle)" }}>%</span>
            </div>
            <button onClick={() => setShare(s => Math.min(99, s + 1))}
              className="w-10 h-10 rounded-xl border text-lg font-bold flex items-center justify-center flex-shrink-0 hover:bg-[var(--vera-cream)] transition-colors"
              style={{ borderColor: "var(--vera-border)", color: "var(--vera-muted)" }}>+</button>
          </div>
          <div className="flex gap-2 mt-2">
            {[25, 50, 60, 70].map(p => (
              <button key={p} onClick={() => setShare(p)}
                className="text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-colors hover:opacity-80"
                style={share === p
                  ? { background: "var(--vera-accent)", color: "#fff", borderColor: "var(--vera-accent)" }
                  : { background: "var(--vera-cream)", color: "var(--vera-muted)", borderColor: "var(--vera-border)" }}>
                {p}%
              </button>
            ))}
          </div>
        </div>

        {/* Making vs receiving toggle */}
        <div>
          <label className="text-xs font-medium block mb-2" style={{ color: "var(--vera-muted)" }}>Your position</label>
          <div className="flex rounded-xl overflow-hidden border" style={{ borderColor: "var(--vera-border)" }}>
            {[
              { val: false, label: "I received an offer" },
              { val: true,  label: "I am making an offer" },
            ].map(opt => (
              <button key={String(opt.val)} onClick={() => setMaking(opt.val)}
                className="flex-1 py-2.5 text-sm font-medium transition-colors"
                style={making === opt.val
                  ? { background: "var(--vera-accent)", color: "#fff" }
                  : { background: "#fff", color: "var(--vera-muted)" }}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <MoneyInput
          label={making ? "Amount you are offering to pay" : "Amount they are offering you"}
          hint={making ? "What you're proposing to pay the other party to settle" : "Leave at $0 if no offer has been received yet"}
          value={offer} onChange={setOffer} />

        <MoneyInput label="Estimated cost to go to trial" hint={copy.trialHint}
          value={trialCost} onChange={setTrialCost} />
      </div>

      {/* Results */}
      <div className={card + " p-5 space-y-4"}>
        <p className="text-sm font-semibold" style={{ color: "var(--vera-text)" }}>Outcome comparison</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl p-4 space-y-1" style={{ background: "#DBEAFE", border: "1px solid #BFDBFE" }}>
            <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: "#1D4ED8" }}>
              {making ? "If they accept" : (offer > 0 ? "If you accept" : "If you settle")}
            </p>
            <p className="text-2xl font-bold tabular-nums" style={{ color: "#1D4ED8" }}>
              {offer > 0 ? fmt(making ? yourOutcome - offer : offer) : "—"}
            </p>
            <p className="text-xs" style={{ color: "#3B82F6" }}>
              {offer > 0
                ? (making ? `${fmt(yourOutcome)} your share − ${fmt(offer)} payment` : "Certain. No trial costs.")
                : (making ? "Enter your proposed offer above" : "Enter the offer above")}
            </p>
          </div>
          <div className="rounded-xl p-4 space-y-1" style={{ background: "var(--vera-accent-light)", border: "1px solid #E8D5B0" }}>
            <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: "var(--vera-accent)" }}>
              {making ? "If they reject — trial" : "If you reject — trial"}
            </p>
            <p className="text-2xl font-bold tabular-nums" style={{ color: "var(--vera-text)" }}>{fmt(netTrial)}</p>
            <p className="text-xs" style={{ color: "var(--vera-muted)" }}>{fmt(yourOutcome)} share − {fmt(trialCost)} costs</p>
          </div>
        </div>

        {delta !== null && offer > 0 && (() => {
          const settleNet = making ? yourOutcome - offer : offer;
          const d = netTrial - settleNet;
          return (
            <div className="rounded-xl px-4 py-3 text-sm font-semibold flex justify-between"
              style={{ background: d >= 0 ? "#DCFCE7" : "#FEE2E2", color: d >= 0 ? "#15803D" : "#DC2626" }}>
              <span>{d >= 0 ? "Trial nets you more by" : "Settlement nets you more by"}</span>
              <span className="tabular-nums">{fmt(Math.abs(d))}</span>
            </div>
          );
        })()}

        <div className="rounded-xl px-4 py-3 space-y-1" style={{ background: "var(--vera-cream)", border: "1px solid var(--vera-border)" }}>
          <p className="text-[11px] font-semibold" style={{ color: "var(--vera-text)" }}>What this model does not account for:</p>
          {copy.disclaimers.map(w => (
            <p key={w} className="text-[11px]" style={{ color: "var(--vera-subtle)" }}>· {w}</p>
          ))}
          <p className="text-[11px] pt-1" style={{ color: "var(--vera-subtle)" }}>Consult an attorney before making any settlement decisions.</p>
        </div>
      </div>
    </div>
  );
}

// ── Notes Tab ─────────────────────────────────────────────────────────────

const DRAFT_TYPES = [
  { label: "Police statement",          value: "police_statement" },
  { label: "Letter to opposing counsel",value: "opposing_counsel" },
  { label: "Declaration for court",     value: "declaration" },
  { label: "Demand letter",             value: "demand_letter" },
  { label: "Incident narrative",        value: "narrative" },
];

function NotesTab({ initialNotes, caseId }: { initialNotes: string; caseId: string; isUnlocked: boolean }) {
  const [content, setContent] = useState(initialNotes);
  const [status, setStatus]   = useState<"idle"|"saving"|"saved">("idle");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { return () => { if (saveTimer.current) clearTimeout(saveTimer.current); }; }, []);

  // Fetch fresh on every mount — `initialNotes` is from page-load and goes stale
  // when user edits, navigates away, and returns within the same session.
  useEffect(() => {
    fetch(`/api/cases/${caseId}/notes`)
      .then(r => r.ok ? r.json() as Promise<{ content?: string }> : Promise.resolve({ content: undefined }))
      .then(d => { if (d.content !== undefined) setContent(d.content); })
      .catch(() => {});
  }, [caseId]);

  const save = useCallback(async (text: string) => {
    setStatus("saving");
    await fetch(`/api/cases/${caseId}/notes`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: text }),
    });
    setStatus("saved");
    setTimeout(() => setStatus("idle"), 2000);
  }, [caseId]);

  function onChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const text = e.target.value;
    setContent(text);
    setStatus("idle");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => save(text), 1500);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold" style={{ color: "var(--vera-text)" }}>Case strategy</p>
          <p className="text-xs" style={{ color: "var(--vera-subtle)" }}>Your argument, case theory, and private thinking. Not events — that&apos;s Timeline.</p>
        </div>
        <span className="text-[11px] font-medium" style={{ color: status === "saved" ? "#15803D" : status === "saving" ? "var(--vera-accent)" : "transparent" }}>
          {status === "saved" ? "Saved ✓" : "Saving…"}
        </span>
      </div>
      <textarea
        value={content}
        onChange={onChange}
        placeholder="What is your argument? What do you believe happened and why does it matter? What outcome do you want and what supports it? Write freely — this is for your eyes only."
        className="w-full rounded-2xl px-4 py-4 text-sm outline-none leading-relaxed resize-none transition-colors"
        style={{
          minHeight: "480px",
          border: "1px solid var(--vera-border)",
          background: "var(--vera-surface)",
          color: "var(--vera-text)",
          fontFamily: "inherit",
        }}
      />
    </div>
  );
}

function DraftsTab({ caseId, isUnlocked }: { caseId: string; isUnlocked: boolean }) {
  const [draftType, setDraftType]   = useState(DRAFT_TYPES[0].value);
  const [content, setContent]       = useState("");
  const [loading, setLoading]       = useState(false);
  const [status, setStatus]         = useState<"idle"|"saving"|"saved">("idle");
  const [generating, setGenerating] = useState(false);
  const [error, setError]           = useState("");
  const saveTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typeCache  = useRef<Record<string, string>>({}); // in-memory per-type cache

  useEffect(() => { return () => { if (saveTimer.current) clearTimeout(saveTimer.current); }; }, []);

  // Load content for the selected draft type (from cache or DB)
  useEffect(() => {
    const key = `__case_draft_${draftType}__`;
    if (typeCache.current[draftType] !== undefined) {
      setContent(typeCache.current[draftType]);
      return;
    }
    setLoading(true);
    fetch(`/api/cases/${caseId}/notes?key=${key}`)
      .then(r => r.ok ? r.json() as Promise<{ content?: string }> : Promise.resolve({ content: undefined }))
      .then(d => {
        const text = d.content ?? "";
        typeCache.current[draftType] = text;
        setContent(text);
      })
      .catch(() => setContent(""))
      .finally(() => setLoading(false));
  }, [caseId, draftType]);

  const save = useCallback(async (text: string, type: string) => {
    setStatus("saving");
    typeCache.current[type] = text;
    await fetch(`/api/cases/${caseId}/notes`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: text, key: `__case_draft_${type}__` }),
    });
    setStatus("saved");
    setTimeout(() => setStatus("idle"), 2000);
  }, [caseId]);

  function onChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const text = e.target.value;
    setContent(text);
    typeCache.current[draftType] = text;
    setStatus("idle");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => save(text, draftType), 1500);
  }

  async function generate() {
    if (content.trim() && !window.confirm("This will replace your current draft. Continue?")) return;
    setGenerating(true); setError("");
    try {
      const res = await fetch(`/api/cases/${caseId}/draft`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: draftType }),
      });
      const data = await res.json() as { draft?: string; error?: string };
      if (!res.ok) { setError(data.error ?? "Failed to generate."); return; }
      const text = data.draft ?? "";
      setContent(text);
      save(text, draftType);
    } finally { setGenerating(false); }
  }

  if (!isUnlocked) return <LockCta caseId={caseId} message="Generate court-ready documents from your case file — police statements, declarations, demand letters, and more." />;

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-semibold" style={{ color: "var(--vera-text)" }}>Document drafts</p>
        <p className="text-xs" style={{ color: "var(--vera-subtle)" }}>Vera reads your full case file and writes the document. Edit before using — AI drafts are a starting point, not a final product.</p>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <select className={inputCls + " w-full sm:w-56 flex-shrink-0"} value={draftType} onChange={e => { setDraftType(e.target.value); setStatus("idle"); }}>
          {DRAFT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <button onClick={generate} disabled={generating || loading} className={btn + " flex-shrink-0"}>
          {generating ? "Generating…" : "Generate"}
        </button>
        <span className="text-[11px] font-medium" style={{ color: status === "saved" ? "#15803D" : status === "saving" ? "var(--vera-accent)" : "transparent" }}>
          {status === "saved" ? "Saved ✓" : "Saving…"}
        </span>
      </div>

      {error && (
        <div className="rounded-xl px-4 py-3 flex items-start gap-3" style={{ background: "#FEF3C7", border: "1px solid #FCD34D" }}>
          <p className="text-sm flex-1" style={{ color: "#92400E" }}>{error}</p>
          <button onClick={() => setError("")} className="text-xs opacity-60 hover:opacity-100 flex-shrink-0" style={{ color: "#92400E" }}>✕</button>
        </div>
      )}

      {loading ? (
        <div className="rounded-2xl animate-pulse" style={{ minHeight: 200, background: "var(--vera-border)" }} />
      ) : (
        <textarea
          value={content}
          onChange={onChange}
          placeholder={`No ${DRAFT_TYPES.find(t => t.value === draftType)?.label.toLowerCase() ?? "draft"} yet — click Generate to create one from your case file.`}
          className="w-full rounded-2xl px-4 py-4 text-sm outline-none leading-relaxed resize-none transition-colors"
          style={{
            minHeight: "480px",
            border: "1px solid var(--vera-border)",
            background: "var(--vera-surface)",
            color: "var(--vera-text)",
            fontFamily: "inherit",
          }}
        />
      )}

      <p className="text-[11px]" style={{ color: "var(--vera-subtle)" }}>
        Not legal advice. Review everything carefully before submitting to a court or sending to opposing counsel.
      </p>
    </div>
  );
}

// ── Settings Tab ─────────────────────────────────────────────────────────

function normalize(s: string) {
  return s.trim().toLowerCase().replace(/[–—]/g, "-").replace(/\s+/g, " ");
}

// ── Related Cases ─────────────────────────────────────────────────────────

function RelatedCasesSection({ caseId }: { caseId: string }) {
  const [cases,    setCases]   = useState<Array<{ id: string; name: string; case_type: string }>>([]);
  const [related,  setRelated] = useState<string[]>([]);
  const [saving,   setSaving]  = useState(false);
  const [saved,    setSaved]   = useState(false);

  useEffect(() => {
    // Load all user's cases and current related list in parallel
    Promise.all([
      fetch("/api/cases").then(r => r.json()),
      fetch(`/api/cases/${caseId}`).then(r => r.json()),
    ]).then(([all, current]) => {
      setCases((all as Array<{ id: string; name: string; case_type: string }>).filter(c => c.id !== caseId));
      setRelated((current as Record<string, unknown>).related_case_ids as string[] ?? []);
    }).catch(() => {});
  }, [caseId]);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function toggle(id: string) {
    const next = related.includes(id) ? related.filter(x => x !== id) : [...related, id];
    setRelated(next);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      setSaving(true);
      await fetch(`/api/cases/${caseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ related_case_ids: next }),
      });
      setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 1500);
    }, 600);
  }

  if (cases.length === 0) return null;

  return (
    <div className={card + " p-5 space-y-3"}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--vera-subtle)" }}>Related cases</p>
        {(saving || saved) && <span className="text-xs" style={{ color: saved ? "#15803D" : "var(--vera-subtle)" }}>{saving ? "Saving…" : "Saved ✓"}</span>}
      </div>
      <p className="text-xs" style={{ color: "var(--vera-muted)" }}>Link cases that are connected — e.g. a divorce and a custody matter. Changes save automatically.</p>
      <div className="space-y-2">
        {cases.map(c => (
          <label key={c.id} className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={related.includes(c.id)} onChange={() => toggle(c.id)}
              className="rounded" style={{ accentColor: "var(--vera-accent)" }} />
            <span className="text-sm" style={{ color: "var(--vera-text)" }}>{String(c.name)}</span>
            <span className="text-xs capitalize" style={{ color: "var(--vera-subtle)" }}>{String(c.case_type).replace("_", " ")}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

function SettingsTab({ caseId, initialName, initialOpposing, initialJurisdiction, initialCourt, initialCaseNumber, initialHearingDate, initialStatus, initialPetitionerName }: {
  caseId: string; initialName: string; initialOpposing: string;
  initialJurisdiction: string; initialCourt: string; initialCaseNumber: string;
  initialHearingDate: string; initialStatus: string; initialPetitionerName: string;
}) {
  const [name,           setName]       = useState(initialName);
  const [petitionerName, setPetitioner] = useState(initialPetitionerName);
  const [opposing,       setOpposing]   = useState(initialOpposing);
  const [jurisdiction,   setJuris]      = useState(initialJurisdiction);
  const [court,          setCourt]      = useState(initialCourt);
  const [caseNumber,     setCaseNum]    = useState(initialCaseNumber);
  const [hearingDate, setHearingDate]= useState(initialHearingDate);
  const [status,      setStatus]     = useState(initialStatus || "active");
  const [saving,      setSaving]     = useState(false);
  const [saved,       setSaved]      = useState(false);
  const [deleting,    setDeleting]   = useState(false);
  const [typed,       setTyped]      = useState("");
  const router = useRouter();

  async function save() {
    setSaving(true);
    await fetch(`/api/cases/${caseId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, petitioner_name: petitionerName || null, opposing_party: opposing, jurisdiction, court_name: court, case_number: caseNumber, hearing_date: hearingDate || null, status }),
    });
    window.dispatchEvent(new CustomEvent("vera:case-updated"));
    router.refresh();
    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function deleteCase() {
    if (normalize(typed) !== normalize(name)) return;
    setDeleting(true);
    const res = await fetch(`/api/cases/${caseId}`, { method: "DELETE" });
    if (res.ok) window.location.href = "/dashboard";
    else setDeleting(false);
  }

  const confirmed = normalize(typed) === normalize(name);

  return (
    <div className="max-w-lg space-y-6">
      <div className={card + " p-5 space-y-4"}>
        <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--vera-subtle)" }}>Case details</p>
        {[
          { label: "Case name",            value: name,           set: setName,       ph: "e.g. Smith v. Jones — Divorce" },
          { label: "Your full legal name", value: petitionerName, set: setPetitioner, ph: "e.g. Jane Smith" },
          { label: "Opposing party",       value: opposing,       set: setOpposing,   ph: "Full name" },
          { label: "State / jurisdiction", value: jurisdiction, set: setJuris,   ph: "e.g. Texas" },
          { label: "Court name",           value: court,       set: setCourt,    ph: "e.g. Harris County District Court" },
          { label: "Case number",          value: caseNumber,  set: setCaseNum,  ph: "Official docket number" },
        ].map(f => (
          <div key={f.label}>
            <label className="text-xs font-medium block mb-1" style={{ color: "var(--vera-muted)" }}>{f.label}</label>
            <input className={inputCls} value={f.value} onChange={e => f.set(e.target.value)} placeholder={f.ph} />
          </div>
        ))}
        <div>
          <label className="text-xs font-medium block mb-1" style={{ color: "var(--vera-muted)" }}>Upcoming hearing date</label>
          <input type="date" className={inputCls} value={hearingDate} onChange={e => setHearingDate(e.target.value)} />
        </div>
        <button onClick={save} disabled={saving} className={btn + " w-full justify-center"}>
          {saving ? "Saving…" : saved ? "Saved ✓" : "Save changes"}
        </button>
      </div>

      {/* Related Cases */}
      <RelatedCasesSection caseId={caseId} />

      {/* Case lifecycle — above Danger Zone */}
      <div className={card + " p-5 space-y-3"}>
        <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--vera-subtle)" }}>Case lifecycle</p>
        <p className="text-xs" style={{ color: "var(--vera-muted)" }}>Mark this case as active, on hold, or closed. Saved instantly.</p>
        <div className="flex gap-2">
          {(["active", "on_hold", "closed"] as const).map(s => (
            <button key={s} onClick={async () => {
              setStatus(s);
              await fetch(`/api/cases/${caseId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: s }),
              });
              router.refresh();
            }}
              className="flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors"
              style={status === s
                ? { background: s === "closed" ? "#FEE2E2" : s === "on_hold" ? "#FEF3C7" : "var(--vera-accent-light)", color: s === "closed" ? "#DC2626" : s === "on_hold" ? "#92400E" : "var(--vera-accent)", border: `1px solid ${s === "closed" ? "#FECACA" : s === "on_hold" ? "#FDE68A" : "#E8D5B0"}` }
                : { background: "var(--vera-cream)", color: "var(--vera-muted)", border: "1px solid var(--vera-border)" }}>
              {s === "active" ? "Active" : s === "on_hold" ? "On Hold" : "Closed"}
            </button>
          ))}
        </div>
      </div>

      <div className={card + " p-5 space-y-4"} style={{ borderColor: "#FECACA" }}>
        <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "#DC2626" }}>Danger zone</p>
        <p className="text-sm" style={{ color: "var(--vera-muted)" }}>
          Permanently deletes all documents, evidence, timeline, tasks, and uploaded files. Cannot be undone.
        </p>
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--vera-muted)" }}>
            Type the case name to confirm deletion:
          </label>
          <p className="text-xs font-mono px-2 py-1.5 rounded-lg mb-2 select-all"
            style={{ background: "var(--vera-cream)", color: "var(--vera-text)", border: "1px solid var(--vera-border)" }}>
            {name}
          </p>
          <input className={inputCls} value={typed} onChange={e => setTyped(e.target.value)}
            onKeyDown={e => e.key === "Enter" && confirmed && deleteCase()}
            placeholder="Type the case name…"
            style={{
              borderColor: typed.length > 0 && !confirmed ? "#FCA5A5" : confirmed ? "#86EFAC" : undefined,
            }} />
          {typed.length > 0 && !confirmed && (
            <p className="text-xs mt-1" style={{ color: "#DC2626" }}>Doesn&apos;t match — check spacing and special characters</p>
          )}
        </div>
        <button onClick={deleteCase} disabled={!confirmed || deleting}
          className="text-sm font-semibold px-4 py-2 rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ background: confirmed ? "#DC2626" : "transparent", color: confirmed ? "#fff" : "#DC2626", border: `1px solid ${confirmed ? "#DC2626" : "#FECACA"}` }}>
          {deleting ? "Deleting…" : "Permanently delete"}
        </button>
      </div>
    </div>
  );
}

// ── Rules & Statutes Tab ──────────────────────────────────────────────────

interface Statute { name: string; cite: string; summary: string }
interface Deadline { event: string; timing: string; consequence: string }
interface RulesData {
  disclaimer?: string;
  statutes?: Statute[];
  deadlines?: Deadline[];
  service_requirements?: string;
  mandatory_disclosures?: string[];
  key_warnings?: string[];
}

function RulesTab({ caseId }: { caseId: string }) {
  const [data,          setData]         = useState<RulesData | null>(null);
  const [loading,       setLoading]      = useState(true);
  const [error,         setError]        = useState("");
  const [copiedCiteKey, setCopiedCiteKey]= useState<number | null>(null);
  const loadedRef = useRef(false);

  async function load() {
    setLoading(true); setError("");
    try {
      const res = await fetch(`/api/cases/${caseId}/rules`);
      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try { const d = await res.json() as { error?: string }; if (d.error) msg = d.error; } catch { /* ignore */ }
        throw new Error(msg);
      }
      const d = await res.json() as RulesData & { error?: string };
      if (d.error) throw new Error(d.error);
      setData(d);
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    load();
  }, [caseId]);

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-semibold" style={{ color: "var(--vera-text)" }}>Rules & Statutes</p>
        <p className="text-xs" style={{ color: "var(--vera-subtle)" }}>Procedural rules for your case type and jurisdiction.</p>
      </div>
      <div className="rounded-xl px-4 py-3 flex gap-3" style={{ background: "#FEF3C7", border: "1px solid #FDE68A" }}>
        <span className="flex-shrink-0 font-bold" style={{ color: "#92400E" }}>⚠️</span>
        <div className="text-xs leading-relaxed" style={{ color: "#78350F" }}>
          <strong>AI-generated — verify before acting on anything here.</strong> Deadlines, statute numbers, and procedural rules change. A wrong deadline can lose a case. Always confirm at your court&apos;s official website or with a legal aid resource before filing or responding.
        </div>
      </div>

      {error && (
        <div className="rounded-xl px-4 py-3 flex items-center gap-3" style={{ background: "#FEF3C7", border: "1px solid #FDE68A" }}>
          <span style={{ color: "#92400E" }}>⚠️</span>
          <p className="text-sm" style={{ color: "#92400E" }}>Couldn&apos;t load rules: {error}.</p>
        </div>
      )}
      {loading && (
        <div className="space-y-3">
          <p className="text-xs" style={{ color: "var(--vera-subtle)" }}>Generating rules for your jurisdiction…</p>
          <div className="animate-pulse space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-16 rounded-xl" style={{ background: "var(--vera-border)" }} />)}</div>
        </div>
      )}

      {data && (
        <div className="space-y-5">
          {data.key_warnings && data.key_warnings.length > 0 && (
            <div className="rounded-xl p-4 space-y-1.5" style={{ background: "#FEF3C7", border: "1px solid #FDE68A" }}>
              <p className="text-[11px] font-bold uppercase tracking-widest mb-2" style={{ color: "#92400E" }}>Watch out for</p>
              {data.key_warnings.map((w, i) => <p key={i} className="text-xs leading-relaxed" style={{ color: "#78350F" }}>· {w}</p>)}
            </div>
          )}
          {data.deadlines && data.deadlines.length > 0 && (
            <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--vera-border)" }}>
              <div className="px-4 py-2.5" style={{ background: "var(--vera-cream)", borderBottom: "1px solid var(--vera-border)" }}>
                <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "var(--vera-subtle)" }}>Critical deadlines</p>
              </div>
              <div className="divide-y" style={{ borderColor: "var(--vera-border)" }}>
                {data.deadlines.map((d, i) => (
                  <div key={i} className="px-4 py-3">
                    <p className="text-sm font-medium" style={{ color: "var(--vera-text)" }}>{d.event}</p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--vera-accent)" }}>{d.timing}</p>
                    {d.consequence && <p className="text-xs mt-0.5" style={{ color: "#DC2626" }}>If missed: {d.consequence}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
          {data.statutes && data.statutes.length > 0 && (
            <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--vera-border)" }}>
              <div className="px-4 py-2.5" style={{ background: "var(--vera-cream)", borderBottom: "1px solid var(--vera-border)" }}>
                <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "var(--vera-subtle)" }}>Relevant statutes</p>
              </div>
              <div className="divide-y" style={{ borderColor: "var(--vera-border)" }}>
                {data.statutes.map((s, i) => (
                  <div key={i} className="px-4 py-3 flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium" style={{ color: "var(--vera-text)" }}>{s.name}</p>
                      <p className="text-xs mt-0.5 leading-relaxed" style={{ color: "var(--vera-muted)" }}>{s.summary}</p>
                    </div>
                    <button
                      onClick={() => { navigator.clipboard.writeText(s.cite); setCopiedCiteKey(i); setTimeout(() => setCopiedCiteKey(null), 1500); }}
                      className="flex-shrink-0 text-[11px] font-mono px-2 py-1 rounded-lg border transition-colors"
                      style={{ borderColor: "var(--vera-border)", color: copiedCiteKey === i ? "#15803D" : "var(--vera-accent)", background: copiedCiteKey === i ? "#DCFCE7" : "var(--vera-accent-light)" }}
                      title="Copy citation">
                      {copiedCiteKey === i ? `✓ ${s.cite}` : s.cite}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
          {data.service_requirements && (
            <div className="rounded-xl p-4" style={{ background: "var(--vera-surface)", border: "1px solid var(--vera-border)" }}>
              <p className="text-[11px] font-bold uppercase tracking-widest mb-2" style={{ color: "var(--vera-subtle)" }}>Service of process</p>
              <p className="text-sm leading-relaxed" style={{ color: "var(--vera-text)" }}>{data.service_requirements}</p>
            </div>
          )}
          {data.mandatory_disclosures && data.mandatory_disclosures.length > 0 && (
            <div className="rounded-xl p-4 space-y-1.5" style={{ background: "var(--vera-surface)", border: "1px solid var(--vera-border)" }}>
              <p className="text-[11px] font-bold uppercase tracking-widest mb-2" style={{ color: "var(--vera-subtle)" }}>Mandatory disclosures</p>
              {data.mandatory_disclosures.map((d, i) => <p key={i} className="text-xs leading-relaxed" style={{ color: "var(--vera-text)" }}>· {d}</p>)}
            </div>
          )}
          {data.disclaimer && <p className="text-[11px] text-center" style={{ color: "var(--vera-subtle)" }}>{data.disclaimer}</p>}
        </div>
      )}
    </div>
  );
}

// ── Main Tabs Component ───────────────────────────────────────────────────

const PRIMARY_TABS   = ["Timeline", "Documents", "Evidence", "Deadlines", "Strategy"];
const SECONDARY_TABS = ["Tasks", "Finances", "Calculator", "Drafts", "Rules", "Settings"];

const CALC_CASE_TYPES = new Set(["divorce", "custody", "small_claims", "employment"]);

function buildNavGroups(caseType: string) {
  return [
    { label: "Case File", items: ["Timeline", "Evidence", "Documents", "Strategy"] },
    { label: "Work",      items: CALC_CASE_TYPES.has(caseType) ? ["Tasks", "Deadlines", "Finances", "Calculator"] : ["Tasks", "Deadlines", "Finances"] },
    { label: "AI",        items: ["Drafts", "Rules"] },
  ];
}
const UNLOCK_REQUIRED = new Set(["Drafts"]);

function NavIcon({ name }: { name: string }) {
  const c = "h-4 w-4 flex-shrink-0";
  switch (name) {
    case "Timeline":   return <svg className={c} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><rect x="2" y="3" width="12" height="11" rx="2"/><path d="M5 1v3M11 1v3M2 7h12"/></svg>;
    case "Evidence":   return <svg className={c} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5L14 14"/></svg>;
    case "Documents":  return <svg className={c} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M3 2h7l3 3v9a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z"/><path d="M10 2v4h4M5 9h6M5 12h4"/></svg>;
    case "Notes":
    case "Strategy":   return <svg className={c} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M12 2.5l1.5 1.5-8.5 8.5-2 .5.5-2 8.5-8.5z"/><path d="M11 3.5l1.5 1.5"/></svg>;
    case "Tasks":      return <svg className={c} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><rect x="2" y="2" width="12" height="12" rx="2"/><path d="M5.5 8l2 2L11 6"/></svg>;
    case "Deadlines":  return <svg className={c} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="8" cy="8" r="6"/><path d="M8 5v3.5l2.5 2"/></svg>;
    case "Finances":   return <svg className={c} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="8" cy="8" r="6"/><path d="M8 4v8M6 5.5a2 2 0 0 1 4 0c0 1.5-2 2-2 3s2 1.5 2 3a2 2 0 0 1-4 0"/></svg>;
    case "Calculator": return <svg className={c} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><rect x="3" y="2" width="10" height="12" rx="2"/><path d="M5 6h6"/><circle cx="5.5" cy="9.5" r="0.7" fill="currentColor" stroke="none"/><circle cx="8" cy="9.5" r="0.7" fill="currentColor" stroke="none"/><circle cx="10.5" cy="9.5" r="0.7" fill="currentColor" stroke="none"/><circle cx="5.5" cy="12" r="0.7" fill="currentColor" stroke="none"/><circle cx="8" cy="12" r="0.7" fill="currentColor" stroke="none"/><circle cx="10.5" cy="12" r="0.7" fill="currentColor" stroke="none"/></svg>;
    case "Drafts":     return <svg className={c} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M3 2h7l3 3v9a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z"/><path d="M10 2v4h3"/><path d="M5 8h6M5 11h4"/><path d="M10.5 10.5l2.5-2.5 1 1-2.5 2.5-1.5.5.5-1.5z"/></svg>;
    case "Rules":      return <svg className={c} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M8 2v12M5 14h6M2 5h12M2 5L1 9h4L4 5M14 5l1 4h-4l1-4"/></svg>;
    case "Log":        return <svg className={c} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M2.5 4.5h11M2.5 8h11M2.5 11.5h7"/></svg>;
    case "Settings":   return <svg className={c} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="8" cy="8" r="2.5"/><path d="M8 2v1.5M8 12.5v1.5M2 8h1.5M12.5 8H14M3.9 3.9l1.1 1.1M11 11l1.1 1.1M3.9 12.1L5 11M11 5l1.1-1.1"/></svg>;
    default:           return null;
  }
}

export default function CaseTabs({ caseId, caseType, caseName, caseOpposing, caseJurisdiction, caseCourt, caseCaseNumber, caseHearingDate, caseStatus, casePetitionerName, relatedCases, timeline, evidence, documents, tasks, captures, deadlines, finances, initialNotes, isUnlocked }: Props) {
  const [active,   setActive]   = useState("Timeline");
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef      = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const isSecondaryActive = SECONDARY_TABS.includes(active);

  function pickTab(tab: string) { setActive(tab); setMoreOpen(false); }

  useEffect(() => {
    function onOpenTab(e: Event) {
      pickTab((e as CustomEvent<string>).detail);
      setTimeout(() => containerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    }
    window.addEventListener("vera:open-tab", onOpenTab);
    return () => window.removeEventListener("vera:open-tab", onOpenTab);
  }, []);

  const tabContent = (
    <div className="flex-1 min-w-0" role="tabpanel" aria-label={active}>
      {active === "Timeline"   && <TimelineTab  entries={timeline} captures={captures} caseId={caseId} />}
      {/* Always mounted so in-progress uploads/processing survive tab switches */}
      <div style={{ display: active === "Documents" ? undefined : "none" }}>
        <DocumentsTab docs={documents} caseId={caseId} isUnlocked={isUnlocked} />
      </div>
      {active === "Evidence"   && <EvidenceTab  evidence={evidence}  caseId={caseId} />}
      {active === "Tasks"      && <TasksTab     tasks={tasks}        caseId={caseId} />}
      {active === "Finances"   && <FinancesTab  finances={finances}  caseId={caseId} />}
      {active === "Calculator" && <CalculatorTab finances={finances} caseType={caseType} />}
      {active === "Deadlines"  && <DeadlinesTab deadlines={deadlines} caseId={caseId} />}
      {(active === "Notes" || active === "Strategy") && <NotesTab initialNotes={initialNotes} caseId={caseId} isUnlocked={isUnlocked} />}
      {active === "Drafts"     && <DraftsTab    caseId={caseId} isUnlocked={isUnlocked} />}
      {active === "Rules"      && <RulesTab     caseId={caseId} />}
      {active === "Settings"   && <SettingsTab  caseId={caseId} initialName={caseName} initialOpposing={caseOpposing} initialJurisdiction={caseJurisdiction} initialCourt={caseCourt} initialCaseNumber={caseCaseNumber} initialHearingDate={caseHearingDate} initialStatus={caseStatus} initialPetitionerName={casePetitionerName} />}
    </div>
  );

  return (
    <div ref={containerRef}>
      {/* ── Mobile: horizontal scrolling tab bar ── */}
      <div className="md:hidden">
        <div className="relative flex items-end border-b mb-6" style={{ borderColor: "var(--vera-border)" }}>
          <div className="pointer-events-none absolute right-8 top-0 bottom-0 w-8 sm:hidden"
            style={{ background: "linear-gradient(to right, transparent, var(--vera-surface))", zIndex: 1 }} />
          <div className="flex gap-0 overflow-x-auto scrollbar-none flex-1 min-w-0" role="tablist" aria-label="Case sections">
            {PRIMARY_TABS.map(tab => (
              <button key={tab} onClick={() => pickTab(tab)}
                role="tab" aria-selected={active === tab}
                className="flex-shrink-0 px-2.5 sm:px-4 pb-3 pt-1 text-xs sm:text-sm font-medium transition-colors border-b-2 -mb-px min-h-[44px]"
                style={active === tab
                  ? { color: "var(--vera-text)", borderColor: "var(--vera-accent)" }
                  : { color: "var(--vera-muted)", borderColor: "transparent" }}>
                {tab}
              </button>
            ))}
            {isSecondaryActive && (
              <button onClick={() => setMoreOpen(o => !o)}
                className="flex-shrink-0 px-2.5 sm:px-4 pb-3 pt-1 text-xs sm:text-sm font-medium border-b-2 -mb-px min-h-[44px]"
                style={{ color: "var(--vera-text)", borderColor: "var(--vera-accent)" }}>
                {active}
              </button>
            )}
          </div>
          <div ref={moreRef} className="relative flex-shrink-0">
            <button onClick={() => setMoreOpen(o => !o)}
              className="flex items-center gap-1 px-2.5 sm:px-4 pb-3 pt-1 text-xs sm:text-sm font-medium transition-colors border-b-2 -mb-px min-h-[44px]"
              style={{ color: moreOpen ? "var(--vera-text)" : "var(--vera-subtle)", borderColor: moreOpen ? "var(--vera-accent)" : "transparent" }}>
              More
              <svg className={`h-3 w-3 transition-transform ${moreOpen ? "rotate-180" : ""}`} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <path d="M2 4l4 4 4-4"/>
              </svg>
            </button>
            {moreOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMoreOpen(false)} />
                <div className="absolute right-0 top-full mt-1 z-20 rounded-xl overflow-hidden shadow-lg"
                  style={{ background: "var(--vera-surface)", border: "1px solid var(--vera-border)", minWidth: 160 }}>
                  {SECONDARY_TABS.map(tab => (
                    <button key={tab} onClick={() => pickTab(tab)}
                      className="w-full text-left px-4 py-3 text-sm transition-colors hover:bg-[var(--vera-cream)] min-h-[44px]"
                      style={{ color: active === tab ? "var(--vera-accent)" : "var(--vera-text)", fontWeight: active === tab ? 600 : 400 }}>
                      {tab}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Content + optional desktop nav ── tabContent rendered ONCE here */}
      <div className="md:flex md:items-start">
        {/* Left nav — desktop only (hidden on mobile via 'hidden', shown via md:flex) */}
        <nav aria-label="Case sections" className="hidden md:flex flex-col w-44 flex-shrink-0 self-start sticky top-4 border-r pr-4 mr-6 overflow-y-auto"
          style={{ borderColor: "var(--vera-border)", maxHeight: "calc(100vh - 2rem)" }}>
          {buildNavGroups(caseType).map(group => (
            <div key={group.label} className="mb-5">
              <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5 px-2"
                style={{ color: "var(--vera-subtle)" }}>{group.label}</p>
              {group.items.map(tab => (
                <button key={tab} onClick={() => pickTab(tab)}
                  role="tab" aria-selected={active === tab}
                  className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-sm font-medium transition-colors text-left mb-0.5 ${active === tab ? "" : "hover:bg-[var(--vera-cream)]"}`}
                  style={active === tab
                    ? { background: "var(--vera-accent-light)", color: "var(--vera-accent)" }
                    : { color: "var(--vera-muted)", background: "transparent" }}>
                  <NavIcon name={tab} />
                  <span className="flex-1">{tab}</span>
                  {UNLOCK_REQUIRED.has(tab) && !isUnlocked && (
                    <svg className="h-3 w-3 flex-shrink-0 opacity-60" viewBox="0 0 16 16" fill="currentColor">
                      <path fillRule="evenodd" d="M8 1a4 4 0 0 0-4 4v1H3a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1h-1V5a4 4 0 0 0-4-4zm2 5V5a2 2 0 1 0-4 0v1h4z" clipRule="evenodd"/>
                    </svg>
                  )}
                </button>
              ))}
            </div>
          ))}
          {/* Settings standalone at the bottom */}
          <div className="mt-auto pt-3 border-t" style={{ borderColor: "var(--vera-border)" }}>
            <button onClick={() => pickTab("Settings")}
              className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-sm font-medium transition-colors text-left ${active === "Settings" ? "" : "hover:bg-[var(--vera-cream)]"}`}
              style={active === "Settings"
                ? { background: "var(--vera-accent-light)", color: "var(--vera-accent)" }
                : { color: "var(--vera-muted)", background: "transparent" }}>
              <NavIcon name="Settings" />
              <span>Settings</span>
            </button>
          </div>
        </nav>
        {tabContent}
      </div>
    </div>
  );
}
