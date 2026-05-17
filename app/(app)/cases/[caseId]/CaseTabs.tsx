"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { upload } from "@vercel/blob/client";
import ProcessingSummary from "./ProcessingSummary";

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
  return String(v).slice(0, 10);
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

interface Props {
  caseId: string; caseType: string;
  caseName: string; caseOpposing: string; caseJurisdiction: string;
  caseCourt: string; caseCaseNumber: string;
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
    <div className="rounded-2xl px-5 py-10 text-center space-y-3" style={{ background: "linear-gradient(135deg, #FDF4E6, #FAF0DC)", border: "2px solid #E8D5B0" }}>
      <div className="inline-flex items-center justify-center w-10 h-10 rounded-full mx-auto" style={{ background: "var(--vera-accent-light)", color: "var(--vera-accent)" }}>
        <LockIcon size={18} />
      </div>
      <p className="text-sm font-semibold" style={{ color: "var(--vera-text)" }}>{message}</p>
      <p className="text-xs" style={{ color: "var(--vera-muted)" }}>Unlock AI for this case once — $49, no subscription.</p>
      <button onClick={unlock} disabled={loading}
        className="flex items-center gap-2 mx-auto text-sm font-bold px-6 py-2.5 rounded-xl transition-colors disabled:opacity-50"
        style={{ background: "var(--vera-accent)", color: "#fff" }}>
        <LockIcon size={14} />
        {loading ? "Redirecting…" : "Unlock this case — $49"}
      </button>
    </div>
  );
}

// ── Timeline Tab ──────────────────────────────────────────────────────────

function TimelineEntry({ entry, caseId, onDelete }: { entry: Row; caseId: string; onDelete: (id: string) => void }) {
  const [note, setNote]         = useState((entry.note as string) ?? "");
  const [draft, setDraft]       = useState((entry.note as string) ?? "");
  const [editing, setEditing]   = useState(false);
  const [status, setStatus]     = useState<"idle"|"saving"|"saved"|"deleting">("idle");

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
    if (!confirm("Delete this timeline entry?")) return;
    setStatus("deleting");
    await fetch(`/api/cases/${caseId}/timeline/${entry.id}`, { method: "DELETE" });
    onDelete(entry.id as string);
  }

  return (
    <div className="flex gap-3 px-4 py-3 group">
      <span className="text-xs tabular-nums w-24 flex-shrink-0 pt-0.5" style={{ color: "var(--vera-subtle)" }}>
        {entry.date as string}
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
          <div className="flex items-center gap-3">
            <button onClick={() => { setDraft(note); setEditing(true); }}
              className="text-[11px] transition-colors hover:opacity-80"
              style={{ color: "var(--vera-subtle)" }}>
              {note ? "edit note" : "+ note"}
            </button>
            <button onClick={deleteEntry} disabled={status === "deleting"}
              className="text-[11px] opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-500 disabled:opacity-40"
              style={{ color: "var(--vera-subtle)" }}>
              delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function TimelineTab({ entries, caseId }: { entries: Row[]; caseId: string }) {
  const [list, setList]     = useState(entries);
  const [date, setDate]     = useState("");
  const [event, setEvent]   = useState("");
  const [saving, setSaving] = useState(false);

  async function addEntry() {
    if (!date || !event.trim()) return;
    setSaving(true);
    const res = await fetch(`/api/cases/${caseId}/timeline`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, event }),
    });
    const row = await res.json();
    setList(prev => [...prev, row].sort((a, b) => (a.date as string).localeCompare(b.date as string)));
    setDate(""); setEvent(""); setSaving(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-2">
        <input type="date" className={inputCls + " sm:w-40 flex-shrink-0"} value={date} onChange={e => setDate(e.target.value)} />
        <input className={inputCls} placeholder="Describe what happened…" value={event} onChange={e => setEvent(e.target.value)}
          onKeyDown={e => e.key === "Enter" && addEntry()} />
        <button onClick={addEntry} disabled={saving || !date || !event.trim()} className={btn + " flex-shrink-0"}>Add</button>
      </div>
      {list.length === 0 ? (
        <div className="py-10 text-center space-y-2">
          <p className="text-sm font-medium" style={{ color: "var(--vera-text)" }}>No timeline entries yet.</p>
          <p className="text-xs" style={{ color: "var(--vera-subtle)" }}>Add key dates above, or process documents with AI to build the timeline automatically.</p>
        </div>
      ) : (
        <div className={card + " divide-y divide-[var(--vera-border)] overflow-hidden"}>
          {list.map((e, i) => <TimelineEntry key={i} entry={e} caseId={caseId} onDelete={id => setList(prev => prev.filter(r => r.id !== id))} />)}
        </div>
      )}
    </div>
  );
}

// ── Documents Tab ─────────────────────────────────────────────────────────

function DocumentsTab({ docs, caseId, isUnlocked }: { docs: Row[]; caseId: string; isUnlocked: boolean }) {
  const [list, setList]             = useState(docs);
  const [uploading, setUploading]   = useState(false);
  const [processing, setProcessing] = useState(false);
  const [log, setLog]               = useState("");
  const [uploadError, setUploadError] = useState("");
  const [viewing, setViewing]       = useState<string | null>(null);
  const [summary, setSummary]       = useState<{ timeline:{date:string;event:string}[]; evidence:{ref:string;title:string;summary:string}[]; tasks:{title:string;priority:string}[] } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pending  = list.filter(d => !d.processed).length;
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
      setList(prev => [data, ...prev]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      setUploadError(msg);
      console.error(err);
    } finally { setUploading(false); if (inputRef.current) inputRef.current.value = ""; }
  }

  async function processAll() {
    if (!pending) return;
    setProcessing(true); setLog("Analyzing your documents…");
    const res = await fetch(`/api/cases/${caseId}/process`, { method: "POST" });
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
            if (ev.type === "error") setLog("Error: " + (ev.message ?? "unknown"));
          } catch { /* skip */ }
        }
      }
    }
    setProcessing(false);
  }

  const total = summary ? summary.timeline.length + summary.evidence.length + summary.tasks.length : 0;

  return (
    <div className="space-y-4">
      {summary && <ProcessingSummary summary={summary} total={total} onDismiss={() => window.location.reload()} />}
      <div className="flex gap-2 flex-wrap">
        <input ref={inputRef} type="file" className="hidden"
          accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.heic,.docx,.doc,.txt,.md,.csv,.html,.eml,.mp3,.m4a,.wav,.ogg,.mp4,.mov,.webm,.xlsx"
          onChange={handleFileUpload} />
        <button onClick={() => inputRef.current?.click()} disabled={uploading} className={ghostBtn}>
          {uploading ? "Uploading…" : "+ Upload document"}
        </button>
        {pending > 0 && (
          isUnlocked ? (
            <button onClick={processAll} disabled={processing} className={btn}>
              {processing ? "Processing…" : `Process ${pending} document${pending > 1 ? "s" : ""} with AI`}
            </button>
          ) : (
            <button onClick={async () => {
              const res  = await fetch("/api/stripe/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ caseId }) });
              const { url } = await res.json() as { url?: string };
              if (url) window.location.href = url;
            }} className={btn + " flex items-center gap-1.5"}>
              <LockIcon size={14} />
              Unlock AI to process
            </button>
          )
        )}
      </div>
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
        <p className="text-sm italic py-6 text-center" style={{ color: "var(--vera-subtle)" }}>No documents yet.</p>
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
                    }} className="text-[11px] hover:text-red-500 transition-colors mt-1" style={{ color: "var(--vera-subtle)" }}>
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
  const [list, setList]     = useState(tasks);
  const [title, setTitle]   = useState("");
  const [saving, setSaving] = useState(false);
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
                      <button onClick={() => deleteTask(t.id as string)} className="text-[11px] ml-auto opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-500" style={{ color: "var(--vera-subtle)" }}>✕</button>
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
        <p className="text-sm italic py-6 text-center" style={{ color: "var(--vera-subtle)" }}>No log entries yet. Use the Capture button (bottom-right) or type above.</p>
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
              }} className="text-[11px] opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 self-start pt-0.5 hover:text-red-500"
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
  }

  async function complete(id: string) {
    setList(prev => prev.map(d => d.id === id ? { ...d, completed: true } : d));
    await fetch(`/api/cases/${caseId}/deadlines`, { method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ id, completed: true }) });
  }

  async function deleteDeadline(id: string) {
    setList(prev => prev.filter(d => d.id !== id));
    await fetch(`/api/cases/${caseId}/deadlines`, { method:"DELETE", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ id }) });
  }

  const active   = list.filter(d => !d.completed);
  const done     = list.filter(d => d.completed);
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input className={inputCls} placeholder="Deadline description" value={label} onChange={e => setLabel(e.target.value)} />
        <input type="date" className={inputCls + " w-40 flex-shrink-0"} value={date} onChange={e => setDate(e.target.value)} />
        <button onClick={addDeadline} disabled={saving || !label.trim() || !date} className={btn + " flex-shrink-0"}>Add</button>
      </div>
      {active.length === 0 && done.length === 0 ? (
        <div className="py-10 text-center space-y-1">
          <p className="text-sm font-medium" style={{ color: "var(--vera-text)" }}>No deadlines yet.</p>
          <p className="text-xs" style={{ color: "var(--vera-subtle)" }}>Add court dates, filing deadlines, or response deadlines above.</p>
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
                      <p className="text-xs mt-0.5" style={{ color: "var(--vera-subtle)" }}>{d.date as string}</p>
                    </div>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full tabular-nums flex-shrink-0"
                      style={{ background: style.badge.bg, color: style.badge.color }}>
                      {days < 0 ? "Passed" : days === 0 ? "TODAY" : `${days}d`}
                    </span>
                    <button onClick={() => deleteDeadline(d.id as string)}
                      className="text-[11px] opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-500 flex-shrink-0"
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
                    <p className="text-xs" style={{ color: "var(--vera-subtle)" }}>{d.date as string}</p>
                    <button onClick={() => deleteDeadline(d.id as string)}
                      className="text-[11px] opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-500 flex-shrink-0"
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
  const [list, setList]         = useState(evidence);
  const [title, setTitle]       = useState("");
  const [sourceType, setSrcType] = useState("Document");
  const [summary, setSummary]   = useState("");
  const [saving, setSaving]     = useState(false);

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
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex gap-2">
          <input className={inputCls + " flex-1"} placeholder="Evidence title (e.g. Recorded call — May 13)" value={title} onChange={e => setTitle(e.target.value)}
            onKeyDown={e => e.key === "Enter" && addEvidence()} />
          <select className={inputCls + " w-44 flex-shrink-0"} value={sourceType} onChange={e => setSrcType(e.target.value)}>
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
        <div className="py-10 text-center space-y-2">
          <p className="text-sm font-medium" style={{ color: "var(--vera-text)" }}>No evidence on file yet.</p>
          <p className="text-xs" style={{ color: "var(--vera-subtle)" }}>Add items manually above, or process documents with AI on the Documents tab.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {list.map((e, i) => (
            <div key={i} className={card + " px-4 py-3 space-y-1.5 group"}>
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold" style={{ color: "var(--vera-text)" }}>{String(e.ref)} — {String(e.title)}</p>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {e.source_type ? <span className="text-[11px] font-medium px-1.5 py-0.5 rounded" style={{ background: "var(--vera-cream)", color: "var(--vera-muted)" }}>{String(e.source_type)}</span> : null}
                  <button
                    onClick={async () => {
                      if (!confirm("Delete this evidence entry?")) return;
                      await fetch(`/api/cases/${caseId}/evidence/${e.id}`, { method: "DELETE" });
                      setList(prev => prev.filter(r => r.id !== e.id));
                    }}
                    className="text-[11px] opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-500"
                    style={{ color: "var(--vera-subtle)" }}>
                    delete
                  </button>
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
  }
  async function remove(id: string) {
    setList(prev => prev.filter(i => i.id !== id));
    await fetch(`/api/cases/${caseId}/finances`, { method:"DELETE", headers:{"Content-Type":"application/json"}, body:JSON.stringify({id}) });
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
      <div className="flex flex-wrap gap-2">
        <select className={inputCls + " w-28 flex-shrink-0"} value={category} onChange={e => setCategory(e.target.value)}>{CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</select>
        <input className={inputCls + " flex-1 min-w-32"} placeholder="Description" value={description} onChange={e => setDesc(e.target.value)} onKeyDown={e => e.key === "Enter" && add()} />
        <input className={inputCls + " w-28 flex-shrink-0"} placeholder="Amount" type="number" value={amount} onChange={e => setAmount(e.target.value)} />
        <input type="date" className={inputCls + " w-36 flex-shrink-0"} value={date} onChange={e => setDate(e.target.value)} />
        <button onClick={add} disabled={saving || !description.trim()} className={btn + " flex-shrink-0"}>Add</button>
      </div>
      {list.length === 0 ? (
        <p className="text-sm italic text-center py-6" style={{ color: "var(--vera-subtle)" }}>No financial items yet.</p>
      ) : (
        <div className={card + " divide-y divide-[var(--vera-border)] overflow-hidden"}>
          {list.map((item, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-2.5">
              <span className="text-[11px] font-bold px-1.5 py-0.5 rounded flex-shrink-0" style={CAT_STYLES[item.category as string] ?? { bg:"var(--vera-cream)", color:"var(--vera-muted)" }}>{String(item.category)}</span>
              <span className="flex-1 text-sm min-w-0 truncate" style={{ color: "var(--vera-text)" }}>{String(item.description)}</span>
              {item.date ? <span className="text-xs tabular-nums hidden sm:block" style={{ color: "var(--vera-subtle)" }}>{fmtDate(item.date)}</span> : null}
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
            {value > 0 ? fmt(value) : "0"}
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

function CalculatorTab({ finances }: { finances: Row[] }) {
  const totalAssets = finances.filter(f => f.category === "Asset").reduce((s, f) => s + (Number(f.amount)||0), 0);
  const totalDebts  = finances.filter(f => f.category === "Debt").reduce((s, f) => s + (Number(f.amount)||0), 0);
  const totalIncome = finances.filter(f => f.category === "Income").reduce((s, f) => s + (Number(f.amount)||0), 0);

  const [dispute,   setDispute]   = useState(Math.round(totalAssets) || 100000);
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

        <MoneyInput label="Total marital estate in dispute" hint="Gross value of all assets being divided — not reduced by debts"
          value={dispute} onChange={setDispute} />

        {/* Share */}
        <div>
          <label className="text-xs font-medium block mb-1" style={{ color: "var(--vera-muted)" }}>Your share of the estate</label>
          <p className="text-[11px] mb-2" style={{ color: "var(--vera-subtle)" }}>50/50 is the default in community property states like Texas</p>
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

        <MoneyInput label="Estimated cost to go to trial" hint="Attorney fees, court costs, expert witnesses — Texas contested divorces average $15–40K"
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
          {["Trial outcome uncertainty — a judge may award less than your expected share", "Time — contested trials take 12–24 months", "Emotional cost of prolonged litigation", "Tax implications of asset division"].map(w => (
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

function NotesTab({ initialNotes, caseId, isUnlocked }: { initialNotes: string; caseId: string; isUnlocked: boolean }) {
  const [content, setContent]     = useState(initialNotes);
  const [status, setStatus]       = useState<"idle"|"saving"|"saved">("idle");
  const [draftType, setDraftType] = useState(DRAFT_TYPES[0].value);
  const [drafting, setDrafting]   = useState(false);
  const [draftError, setDraftError] = useState("");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  async function generateDraft() {
    setDrafting(true);
    setDraftError("");
    try {
      const res = await fetch(`/api/cases/${caseId}/draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: draftType }),
      });
      const data = await res.json() as { draft?: string; error?: string };
      if (!res.ok) { setDraftError(data.error ?? "Failed to generate draft."); return; }
      const newContent = content
        ? content + "\n\n---\n\n" + (data.draft ?? "")
        : (data.draft ?? "");
      setContent(newContent);
      save(newContent);
    } finally {
      setDrafting(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <select className={inputCls + " w-52 flex-shrink-0"} value={draftType} onChange={e => setDraftType(e.target.value)}>
          {DRAFT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        {isUnlocked ? (
          <button onClick={generateDraft} disabled={drafting} className={btn + " flex-shrink-0"}>
            {drafting ? "Drafting…" : "Generate draft"}
          </button>
        ) : (
          <button onClick={async () => {
            const res = await fetch("/api/stripe/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ caseId }) });
            const { url } = await res.json() as { url?: string };
            if (url) window.location.href = url;
          }} className={btn + " flex-shrink-0 flex items-center gap-1.5"}>
            <LockIcon size={14} />
            Unlock to generate
          </button>
        )}
        <p className="text-xs flex-1" style={{ color: "var(--vera-subtle)" }}>
          {isUnlocked ? "Vera reads your case file and drafts the document. Edit freely — it saves automatically." : "AI draft generation · Unlock this case for $49"}
        </p>
        <span className="text-[11px] font-medium ml-auto" style={{ color: status === "saved" ? "#15803D" : status === "saving" ? "var(--vera-accent)" : "var(--vera-subtle)" }}>
          {status === "saved" ? "Saved ✓" : status === "saving" ? "Saving…" : ""}
        </span>
      </div>
      {draftError && (
        <div className="rounded-xl px-4 py-3 flex items-start gap-3" style={{ background: "#FEF3C7", border: "1px solid #FCD34D" }}>
          <div className="flex-1 min-w-0">
            <p className="text-sm" style={{ color: "#92400E" }}>{draftError}</p>
            {draftError.toLowerCase().includes("upgrade") && (
              <a href="/pricing" className="text-xs font-semibold mt-1 inline-block hover:underline" style={{ color: "#D97706" }}>View Pro plans →</a>
            )}
          </div>
          <button onClick={() => setDraftError("")} className="text-xs flex-shrink-0 ml-1 opacity-60 hover:opacity-100" style={{ color: "#92400E" }}>✕</button>
        </div>
      )}
      <textarea
        value={content}
        onChange={onChange}
        placeholder="Start writing — or use Generate draft above to create a police statement, letter to opposing counsel, declaration for court, and more."
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

// ── Settings Tab ─────────────────────────────────────────────────────────

function normalize(s: string) {
  return s.trim().toLowerCase().replace(/[–—]/g, "-").replace(/\s+/g, " ");
}

function SettingsTab({ caseId, initialName, initialOpposing, initialJurisdiction, initialCourt, initialCaseNumber }: {
  caseId: string; initialName: string; initialOpposing: string;
  initialJurisdiction: string; initialCourt: string; initialCaseNumber: string;
}) {
  const [name,        setName]       = useState(initialName);
  const [opposing,    setOpposing]   = useState(initialOpposing);
  const [jurisdiction,setJuris]      = useState(initialJurisdiction);
  const [court,       setCourt]      = useState(initialCourt);
  const [caseNumber,  setCaseNum]    = useState(initialCaseNumber);
  const [saving,      setSaving]     = useState(false);
  const [saved,       setSaved]      = useState(false);
  const [deleting,    setDeleting]   = useState(false);
  const [typed,       setTyped]      = useState("");

  async function save() {
    setSaving(true);
    await fetch(`/api/cases/${caseId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, opposing_party: opposing, jurisdiction, court_name: court, case_number: caseNumber }),
    });
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
          { label: "Case name",            value: name,        set: setName,     ph: "e.g. Smith v. Jones — Divorce" },
          { label: "Opposing party",       value: opposing,    set: setOpposing, ph: "Full name" },
          { label: "State / jurisdiction", value: jurisdiction, set: setJuris,   ph: "e.g. Texas" },
          { label: "Court name",           value: court,       set: setCourt,    ph: "e.g. Harris County District Court" },
          { label: "Case number",          value: caseNumber,  set: setCaseNum,  ph: "Official docket number" },
        ].map(f => (
          <div key={f.label}>
            <label className="text-xs font-medium block mb-1" style={{ color: "var(--vera-muted)" }}>{f.label}</label>
            <input className={inputCls} value={f.value} onChange={e => f.set(e.target.value)} placeholder={f.ph} />
          </div>
        ))}
        <button onClick={save} disabled={saving} className={btn + " w-full justify-center"}>
          {saving ? "Saving…" : saved ? "Saved ✓" : "Save changes"}
        </button>
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

// ── Ask Vera (Chat) Tab ───────────────────────────────────────────────────

interface ChatMessage { role: "user" | "assistant"; content: string }

function ChatTab({ caseId, isUnlocked }: { caseId: string; isUnlocked: boolean }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput]       = useState("");
  const [loading, setLoading]   = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    const next: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setLoading(true);

    const res = await fetch(`/api/cases/${caseId}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: next }),
    });

    if (!res.body) { setLoading(false); return; }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let assistant = "";
    setMessages(prev => [...prev, { role: "assistant", content: "" }]);

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      assistant += decoder.decode(value, { stream: true });
      setMessages(prev => [...prev.slice(0, -1), { role: "assistant", content: assistant }]);
    }
    setLoading(false);
  }

  if (!isUnlocked) return <LockCta caseId={caseId} message="Ask Vera anything about your case — timeline gaps, what to prepare, what to do next." />;

  return (
    <div className="flex flex-col" style={{ height: "560px" }}>
      <div className="flex-1 overflow-y-auto space-y-3 pb-4">
        {messages.length === 0 ? (
          <div className="py-10 text-center space-y-3">
            <p className="text-sm font-medium" style={{ color: "var(--vera-text)" }}>Ask Vera anything about your case.</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {[
                "Summarize the key events so far",
                "What evidence do I have on file?",
                "What should I focus on this week?",
                "Are there any gaps in my case?",
              ].map(q => (
                <button key={q} onClick={() => { setInput(q); }}
                  className="text-xs px-3 py-1.5 rounded-full border transition-colors hover:opacity-80"
                  style={{ borderColor: "var(--vera-border)", color: "var(--vera-muted)", background: "var(--vera-cream)" }}>
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed`}
                style={m.role === "user"
                  ? { background: "var(--vera-accent)", color: "#fff" }
                  : { background: "var(--vera-surface)", border: "1px solid var(--vera-border)", color: "var(--vera-text)" }}>
                {m.content || <span className="opacity-50">Vera is thinking…</span>}
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      <div className="flex gap-2 pt-3 border-t" style={{ borderColor: "var(--vera-border)" }}>
        <input
          className={inputCls}
          placeholder="Ask about your case…"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && !e.shiftKey && send()}
          disabled={loading}
        />
        <button onClick={send} disabled={loading || !input.trim()} className={btn + " flex-shrink-0"}>
          {loading ? "…" : "Send"}
        </button>
      </div>
      <p className="text-[11px] mt-2" style={{ color: "var(--vera-subtle)" }}>Vera reads your full case file. Not legal advice.</p>
    </div>
  );
}

// ── Main Tabs Component ───────────────────────────────────────────────────

const PRIMARY_TABS   = ["Timeline", "Documents", "Evidence", "Tasks", "Deadlines"];
const SECONDARY_TABS = ["Notes", "Ask Vera", "Finances", "Calculator", "Log", "Settings"];

export default function CaseTabs({ caseId, caseType, caseName, caseOpposing, caseJurisdiction, caseCourt, caseCaseNumber, timeline, evidence, documents, tasks, captures, deadlines, finances, initialNotes, isUnlocked }: Props) {
  const [active,   setActive]   = useState("Timeline");
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  const isSecondaryActive = SECONDARY_TABS.includes(active);

  function pickTab(tab: string) { setActive(tab); setMoreOpen(false); }

  return (
    <div>
      <div className="relative flex items-end border-b mb-6" style={{ borderColor: "var(--vera-border)" }}>
        {/* Primary tabs */}
        <div className="flex gap-0 overflow-x-auto scrollbar-none flex-1">
          {PRIMARY_TABS.map(tab => (
            <button key={tab} onClick={() => pickTab(tab)}
              className="flex-shrink-0 px-4 pb-3 pt-1 text-sm font-medium transition-colors border-b-2 -mb-px"
              style={active === tab
                ? { color: "var(--vera-text)", borderColor: "var(--vera-accent)" }
                : { color: "var(--vera-muted)", borderColor: "transparent" }}>
              {tab}
            </button>
          ))}
          {/* If a secondary tab is active, show it inline */}
          {isSecondaryActive && (
            <button onClick={() => setMoreOpen(o => !o)}
              className="flex-shrink-0 px-4 pb-3 pt-1 text-sm font-medium border-b-2 -mb-px"
              style={{ color: "var(--vera-text)", borderColor: "var(--vera-accent)" }}>
              {active}
            </button>
          )}
        </div>
        {/* More button */}
        <div ref={moreRef} className="relative flex-shrink-0">
          <button
            onClick={() => setMoreOpen(o => !o)}
            className="flex items-center gap-1 px-4 pb-3 pt-1 text-sm font-medium transition-colors border-b-2 -mb-px"
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
                    className="w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-[var(--vera-cream)]"
                    style={{ color: active === tab ? "var(--vera-accent)" : "var(--vera-text)", fontWeight: active === tab ? 600 : 400 }}>
                    {tab}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
      <div>
        {active === "Timeline"   && <TimelineTab  entries={timeline}   caseId={caseId} />}
        {active === "Documents"  && <DocumentsTab docs={documents}     caseId={caseId} isUnlocked={isUnlocked} />}
        {active === "Evidence"   && <EvidenceTab  evidence={evidence}  caseId={caseId} />}
        {active === "Tasks"      && <TasksTab     tasks={tasks}        caseId={caseId} />}
        {active === "Finances"   && <FinancesTab  finances={finances}  caseId={caseId} />}
        {active === "Calculator" && <CalculatorTab finances={finances} />}
        {active === "Log"        && <LogTab       captures={captures}  caseId={caseId} />}
        {active === "Deadlines"  && <DeadlinesTab deadlines={deadlines} caseId={caseId} />}
        {active === "Notes"      && <NotesTab     initialNotes={initialNotes} caseId={caseId} isUnlocked={isUnlocked} />}
        {active === "Ask Vera"  && <ChatTab     caseId={caseId} isUnlocked={isUnlocked} />}
        {active === "Settings"  && <SettingsTab caseId={caseId} initialName={caseName} initialOpposing={caseOpposing} initialJurisdiction={caseJurisdiction} initialCourt={caseCourt} initialCaseNumber={caseCaseNumber} />}
      </div>
    </div>
  );
}
