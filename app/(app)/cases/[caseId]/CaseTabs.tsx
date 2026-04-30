"use client";

import { useState, useRef } from "react";

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

// ── Types ─────────────────────────────────────────────────────────────────

interface Row { [key: string]: unknown }

interface Props {
  caseId: string;
  caseType: string;
  timeline: Row[];
  evidence: Row[];
  documents: Row[];
  tasks: Row[];
  captures: Row[];
  deadlines: Row[];
}

// ── Shared styles ─────────────────────────────────────────────────────────

const btn = "bg-gray-900 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-gray-700 transition-colors disabled:opacity-40";
const ghostBtn = "border border-gray-200 text-gray-600 px-4 py-2 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors";
const inputCls = "w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 bg-white";

// ── Timeline Tab ──────────────────────────────────────────────────────────

function TimelineTab({ entries, caseId }: { entries: Row[]; caseId: string }) {
  const [list, setList]   = useState(entries);
  const [date, setDate]   = useState("");
  const [event, setEvent] = useState("");
  const [saving, setSaving] = useState(false);

  async function addEntry() {
    if (!date || !event.trim()) return;
    setSaving(true);
    const res = await fetch(`/api/cases/${caseId}/timeline`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, event }),
    });
    const row = await res.json();
    setList(prev => [...prev, row].sort((a, b) => (a.date as string).localeCompare(b.date as string)));
    setDate(""); setEvent(""); setSaving(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input type="date" className={inputCls + " w-40 flex-shrink-0"} value={date} onChange={e => setDate(e.target.value)} />
        <input className={inputCls} placeholder="What happened?" value={event} onChange={e => setEvent(e.target.value)}
          onKeyDown={e => e.key === "Enter" && addEntry()} />
        <button onClick={addEntry} disabled={saving || !date || !event.trim()} className={btn + " flex-shrink-0"}>Add</button>
      </div>

      {list.length === 0 ? (
        <p className="text-sm text-gray-400 italic py-4 text-center">No timeline entries yet. Add your first event above.</p>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-50 overflow-hidden">
          {list.map((e, i) => (
            <div key={i} className="flex gap-3 px-4 py-3">
              <span className="text-xs text-gray-400 tabular-nums w-24 flex-shrink-0 pt-0.5">{e.date as string}</span>
              <span className="h-2 w-2 rounded-full bg-gray-300 flex-shrink-0 mt-1.5" />
              <p className="text-sm text-gray-700 flex-1">{e.event as string}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Documents Tab ─────────────────────────────────────────────────────────

function DocumentsTab({ docs, caseId }: { docs: Row[]; caseId: string }) {
  const [list, setList]      = useState(docs);
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [log, setLog]        = useState("");
  const [viewing, setViewing] = useState<string | null>(null);
  const inputRef             = useRef<HTMLInputElement>(null);

  const pending = list.filter(d => !d.processed).length;

  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const form = new FormData();
    form.append("file", file);
    const res  = await fetch(`/api/cases/${caseId}/documents`, { method: "POST", body: form });
    const data = await res.json();
    if (res.ok) setList(prev => [data, ...prev]);
    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function processAll() {
    if (pending === 0) return;
    setProcessing(true);
    setLog("Sending to Claude…");
    const res = await fetch(`/api/cases/${caseId}/process`, { method: "POST" });
    if (res.body) {
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
            if (ev.type === "progress") setLog(ev.message ?? "");
            if (ev.type === "done") { setLog(ev.message ?? "Done!"); setTimeout(() => window.location.reload(), 3000); }
            if (ev.type === "error") setLog("Error: " + (ev.message ?? "unknown"));
          } catch { /* skip */ }
        }
      }
    }
    setProcessing(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 items-center">
        <input ref={inputRef} type="file" className="hidden"
          accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.heic,.docx,.doc,.txt,.md,.csv,.html,.eml,.mp3,.m4a,.wav,.ogg,.mp4,.mov,.webm,.xlsx"
          onChange={upload} />
        <button onClick={() => inputRef.current?.click()} disabled={uploading} className={ghostBtn}>
          {uploading ? "Uploading…" : "+ Upload document"}
        </button>
        {pending > 0 && (
          <button onClick={processAll} disabled={processing} className={btn}>
            {processing ? "Processing…" : `Process ${pending} document${pending > 1 ? "s" : ""} with AI`}
          </button>
        )}
      </div>
      {log && <p className="text-xs text-gray-500 bg-gray-50 px-3 py-2 rounded-lg">{log}</p>}

      {list.length === 0 ? (
        <p className="text-sm text-gray-400 italic py-4 text-center">No documents yet. Upload your first document above.</p>
      ) : (
        <div className="space-y-2">
          {list.map((d, i) => (
            <div key={i} className="space-y-2">
              <div className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl px-4 py-3">
                <span className="text-lg">📄</span>
                <div className="flex-1 min-w-0">
                  <button onClick={() => setViewing(viewing === (d.id as string) ? null : (d.id as string))}
                    className="text-sm font-medium text-blue-600 hover:underline truncate block text-left">
                    {d.filename as string}
                  </button>
                  <p className="text-xs text-gray-400">{fmtDate(d.created_at)}</p>
                </div>
                <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${d.processed ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                  {d.processed ? "Processed" : "Pending"}
                </span>
              </div>
              {viewing === (d.id as string) && (
                <iframe
                  src={`/api/cases/${caseId}/documents/${d.id}`}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50"
                  style={{ height: "600px" }}
                  title={d.filename as string}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Tasks Tab ─────────────────────────────────────────────────────────────

function TasksTab({ tasks, caseId }: { tasks: Row[]; caseId: string }) {
  const [list, setList]   = useState(tasks);
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);

  const cols = [
    { id: "todo",       label: "To Do",       color: "border-gray-300" },
    { id: "inprogress", label: "In Progress",  color: "border-blue-400" },
    { id: "done",       label: "Done",         color: "border-green-400" },
  ] as const;

  async function addTask() {
    if (!title.trim()) return;
    setSaving(true);
    const res = await fetch(`/api/cases/${caseId}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    const row = await res.json();
    setList(prev => [...prev, row]);
    setTitle(""); setSaving(false);
  }

  async function moveTask(id: string, col: string) {
    setList(prev => prev.map(t => t.id === id ? { ...t, col } : t));
    await fetch(`/api/cases/${caseId}/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ col }),
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input className={inputCls} placeholder="Add a task…" value={title} onChange={e => setTitle(e.target.value)}
          onKeyDown={e => e.key === "Enter" && addTask()} />
        <button onClick={addTask} disabled={saving || !title.trim()} className={btn + " flex-shrink-0"}>Add</button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {cols.map(col => {
          const colTasks = list.filter(t => t.col === col.id);
          return (
            <div key={col.id}>
              <div className={`flex items-center gap-2 mb-2 pb-2 border-b-2 ${col.color}`}>
                <span className="text-xs font-bold text-gray-700">{col.label}</span>
                <span className="ml-auto text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">{colTasks.length}</span>
              </div>
              <div className="space-y-2">
                {colTasks.map((t, i) => (
                  <div key={i} className="bg-white border border-gray-200 rounded-xl p-3 text-xs">
                    <p className="font-medium text-gray-900 mb-2">{t.title as string}</p>
                    <div className="flex gap-1">
                      {col.id !== "todo"       && <button onClick={() => moveTask(t.id as string, "todo")}       className="text-gray-400 hover:text-gray-600 text-[11px]">← To Do</button>}
                      {col.id !== "inprogress" && <button onClick={() => moveTask(t.id as string, "inprogress")} className="text-blue-500 hover:text-blue-700 text-[11px]">▶ Start</button>}
                      {col.id !== "done"       && <button onClick={() => moveTask(t.id as string, "done")}       className="text-green-500 hover:text-green-700 text-[11px]">✓ Done</button>}
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

// ── Captures Tab ──────────────────────────────────────────────────────────

function CapturesTab({ captures, caseId }: { captures: Row[]; caseId: string }) {
  const [list, setList]   = useState(captures);
  const [text, setText]   = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!text.trim()) return;
    setSaving(true);
    const res = await fetch(`/api/cases/${caseId}/captures`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: text.trim() }),
    });
    const row = await res.json();
    setList(prev => [row, ...prev]);
    setText(""); setSaving(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <textarea className={inputCls} rows={2} placeholder="Log an event, call, or observation… (⌘Enter to save)"
          value={text} onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit(); }} />
        <button onClick={submit} disabled={saving || !text.trim()} className={btn + " flex-shrink-0 self-end"}>Log</button>
      </div>
      <div className="space-y-2">
        {list.map((c, i) => (
          <div key={i} className="bg-white border border-gray-200 rounded-xl px-4 py-3">
            <p className="text-sm text-gray-700">{c.content as string}</p>
            <p className="text-xs text-gray-400 mt-1">{fmtDateTime(c.created_at)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Deadlines Tab ─────────────────────────────────────────────────────────

function DeadlinesTab({ deadlines, caseId }: { deadlines: Row[]; caseId: string }) {
  const [list, setList]   = useState(deadlines);
  const [label, setLabel] = useState("");
  const [date, setDate]   = useState("");
  const [saving, setSaving] = useState(false);

  function daysUntil(d: string) {
    const [y, m, day] = d.split("-").map(Number);
    const today = new Date(); today.setHours(0,0,0,0);
    const target = new Date(y, m-1, day);
    return Math.round((target.getTime() - today.getTime()) / 86400000);
  }

  async function addDeadline() {
    if (!label.trim() || !date) return;
    setSaving(true);
    const res = await fetch(`/api/cases/${caseId}/deadlines`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label, date }),
    });
    const row = await res.json();
    setList(prev => [...prev, row].sort((a,b) => (a.date as string).localeCompare(b.date as string)));
    setLabel(""); setDate(""); setSaving(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input className={inputCls} placeholder="Deadline description" value={label} onChange={e => setLabel(e.target.value)} />
        <input type="date" className={inputCls + " w-40 flex-shrink-0"} value={date} onChange={e => setDate(e.target.value)} />
        <button onClick={addDeadline} disabled={saving || !label.trim() || !date} className={btn + " flex-shrink-0"}>Add</button>
      </div>
      <div className="space-y-2">
        {list.filter(d => !d.completed).map((d, i) => {
          const days = daysUntil(d.date as string);
          const color = days < 0 ? "text-gray-400" : days <= 3 ? "text-red-600 font-semibold" : days <= 7 ? "text-amber-600" : "text-gray-600";
          return (
            <div key={i} className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center gap-3">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">{d.label as string}</p>
                <p className="text-xs text-gray-400">{d.date as string}</p>
              </div>
              <span className={`text-sm tabular-nums ${color}`}>
                {days < 0 ? "Passed" : days === 0 ? "Today" : `${days}d`}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main Tabs Component ───────────────────────────────────────────────────

const TABS = ["Timeline", "Documents", "Tasks", "Captures", "Deadlines", "Evidence"];

export default function CaseTabs({ caseId, caseType, timeline, evidence, documents, tasks, captures, deadlines }: Props) {
  const [active, setActive] = useState("Timeline");

  return (
    <div>
      {/* Tab bar */}
      <div className="flex gap-1 overflow-x-auto pb-1 mb-5 scrollbar-none">
        {TABS.map(tab => (
          <button key={tab} onClick={() => setActive(tab)}
            className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              active === tab ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-100"
            }`}>
            {tab}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 min-h-64">
        {active === "Timeline"  && <TimelineTab  entries={timeline}  caseId={caseId} />}
        {active === "Documents" && <DocumentsTab docs={documents}    caseId={caseId} />}
        {active === "Tasks"     && <TasksTab     tasks={tasks}       caseId={caseId} />}
        {active === "Captures"  && <CapturesTab  captures={captures} caseId={caseId} />}
        {active === "Deadlines" && <DeadlinesTab deadlines={deadlines} caseId={caseId} />}
        {active === "Evidence"  && (
          <div className="space-y-2">
            {evidence.length === 0
              ? <p className="text-sm text-gray-400 italic text-center py-4">Evidence entries are built automatically when you process documents with AI.</p>
              : evidence.map((e, i) => (
                <div key={i} className="border border-gray-200 rounded-xl px-4 py-3">
                  <p className="text-sm font-medium text-gray-900">{String(e.ref)} — {String(e.title)}</p>
                  {e.summary ? <p className="text-xs text-gray-500 mt-1">{String(e.summary)}</p> : null}
                </div>
              ))
            }
          </div>
        )}
      </div>
    </div>
  );
}
