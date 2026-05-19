"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";

// ── Chat types ────────────────────────────────────────────────────────────

interface ChatMessage { role: "user" | "assistant"; content: string }

const CHIPS = [
  "Summarize the key events so far",
  "What evidence do I have on file?",
  "Are there any gaps in my case?",
  "What rules and deadlines apply to my case?",
];

// ── Chat drawer ────────────────────────────────────────────────────────────

function ChatDrawer({ caseId, isUnlocked, hearingDate, onClose }: {
  caseId: string; isUnlocked: boolean; hearingDate?: string; onClose: () => void;
}) {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput]       = useState("");
  const [loading, setLoading]   = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function send(override?: string) {
    const text = (override ?? input).trim();
    if (!text || loading) return;
    const next: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(next); setInput(""); setLoading(true);
    setMessages(prev => [...prev, { role: "assistant", content: "" }]);
    try {
      const res = await fetch(`/api/cases/${caseId}/chat`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      if (!res.ok) {
        const errMsg = res.status === 403 ? "This case needs to be unlocked to use Ask Vera." : `Something went wrong (${res.status}) — please try again.`;
        setMessages(prev => [...prev.slice(0, -1), { role: "assistant", content: errMsg }]);
        setLoading(false); return;
      }
      if (!res.body) { setLoading(false); return; }
      const reader = res.body.getReader(); const decoder = new TextDecoder(); let assistant = "";
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        assistant += decoder.decode(value, { stream: true });
        setMessages(prev => [...prev.slice(0, -1), { role: "assistant", content: assistant }]);
      }
    } catch { setMessages(prev => [...prev.slice(0, -1), { role: "assistant", content: "Something went wrong — please try again." }]); }
    setLoading(false);
  }

  async function unlock() {
    const res = await fetch("/api/stripe/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ caseId }) });
    const { url } = await res.json() as { url?: string };
    if (url) router.push(url);
  }

  const hearingLabel = hearingDate ? `my hearing on ${hearingDate}` : "my upcoming hearing";
  const HEARING_PROMPT = `I have ${hearingLabel}. Based on everything in my case file, please help me prepare: what are my strongest points, what will the other side likely argue, what evidence should I bring, and what should I say?`;

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[1px]" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed top-0 right-0 bottom-0 z-50 flex flex-col w-full sm:w-[400px] print:hidden"
        style={{ background: "var(--vera-surface)", borderLeft: "1px solid var(--vera-border)", boxShadow: "-8px 0 32px rgba(28,25,23,0.12)" }}>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b flex-shrink-0"
          style={{ borderColor: "var(--vera-border)", background: "linear-gradient(135deg, #FDF4E6 0%, #FAF0DC 100%)" }}>
          <div className="flex items-center gap-2.5">
            <span className="h-2.5 w-2.5 rounded-full animate-pulse" style={{ background: "var(--vera-accent)" }} />
            <span className="text-sm font-bold" style={{ color: "var(--vera-text)" }}>Ask Vera</span>
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wider"
              style={{ background: "var(--vera-accent-light)", color: "var(--vera-accent)" }}>
              {isUnlocked ? "AI" : "Locked"}
            </span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg transition-colors hover:bg-black/5"
            style={{ color: "var(--vera-muted)" }}>
            <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M12 4L4 12M4 4l8 8"/>
            </svg>
          </button>
        </div>

        {!isUnlocked ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6 text-center">
            <p className="text-sm font-semibold" style={{ color: "var(--vera-text)" }}>Your case is ready for Vera&apos;s full analysis</p>
            <p className="text-xs leading-relaxed" style={{ color: "var(--vera-muted)" }}>Ask anything about your case — timeline gaps, what to prepare, what to do next.</p>
            <button onClick={unlock}
              className="flex items-center gap-2 text-sm font-bold px-6 py-2.5 rounded-xl"
              style={{ background: "var(--vera-accent)", color: "#fff" }}>
              Unlock this case — $49
            </button>
            <p className="text-[11px]" style={{ color: "var(--vera-subtle)" }}>One-time · No subscription</p>
          </div>
        ) : (
          <>
            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
              {messages.length === 0 ? (
                <div className="space-y-4 pt-2">
                  <p className="text-sm font-medium" style={{ color: "var(--vera-text)" }}>Ask anything about your case.</p>
                  <div className="flex flex-wrap gap-2">
                    {CHIPS.map(q => (
                      <button key={q} onClick={() => { setInput(q); setTimeout(() => send(q), 0); }}
                        className="text-xs px-3 py-1.5 rounded-full border transition-colors hover:opacity-80"
                        style={{ borderColor: "var(--vera-border)", color: "var(--vera-muted)", background: "var(--vera-cream)" }}>
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              ) : messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className="max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed"
                    style={m.role === "user"
                      ? { background: "var(--vera-accent)", color: "#fff" }
                      : { background: "var(--vera-cream)", border: "1px solid var(--vera-border)", color: "var(--vera-text)" }}>
                    {m.content
                      ? m.role === "assistant"
                        ? <ReactMarkdown
                            components={{
                              h1: ({children}) => <p className="font-bold text-base mb-1">{children}</p>,
                              h2: ({children}) => <p className="font-bold mb-1">{children}</p>,
                              h3: ({children}) => <p className="font-semibold mb-0.5">{children}</p>,
                              p:  ({children}) => <p className="mb-2 last:mb-0">{children}</p>,
                              strong: ({children}) => <strong className="font-semibold">{children}</strong>,
                              ul: ({children}) => <ul className="list-disc pl-4 mb-2 space-y-0.5">{children}</ul>,
                              ol: ({children}) => <ol className="list-decimal pl-4 mb-2 space-y-0.5">{children}</ol>,
                              li: ({children}) => <li>{children}</li>,
                              hr: () => <hr className="my-2" style={{ borderColor: "var(--vera-border)" }} />,
                              table: ({children}) => <div className="overflow-x-auto my-2"><table className="text-xs border-collapse w-full">{children}</table></div>,
                              th: ({children}) => <th className="px-2 py-1 text-left font-semibold border" style={{ borderColor: "var(--vera-border)", background: "var(--vera-surface)" }}>{children}</th>,
                              td: ({children}) => <td className="px-2 py-1 border" style={{ borderColor: "var(--vera-border)" }}>{children}</td>,
                              code: ({children}) => <code className="px-1 rounded text-xs" style={{ background: "var(--vera-surface)" }}>{children}</code>,
                            }}>
                            {m.content}
                          </ReactMarkdown>
                        : m.content
                      : <span className="opacity-40">Vera is thinking…</span>
                    }
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="flex-shrink-0 px-4 pb-4 pt-3 border-t space-y-2.5" style={{ borderColor: "var(--vera-border)" }}>
              <div className="flex gap-2">
                <input
                  className="flex-1 border rounded-xl px-3 py-2.5 text-sm outline-none transition-colors"
                  style={{ borderColor: "var(--vera-border)", background: "var(--vera-cream)", color: "var(--vera-text)" }}
                  placeholder="Ask about your case…"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && !e.shiftKey && send()}
                  disabled={loading}
                />
                <button onClick={() => send()} disabled={loading || !input.trim()}
                  className="px-4 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40 flex-shrink-0"
                  style={{ background: "var(--vera-accent)", color: "#fff" }}>
                  {loading ? "…" : "Send"}
                </button>
              </div>
              <button onClick={() => { setInput(HEARING_PROMPT); setTimeout(() => send(HEARING_PROMPT), 0); }}
                className="text-xs px-3 py-1.5 rounded-full font-medium transition-colors hover:opacity-80"
                style={{ background: "var(--vera-accent-light)", color: "var(--vera-accent)", border: "1px solid #E8D5B0" }}>
                ⚖️ {hearingDate ? `Prep for hearing on ${hearingDate}` : "Hearing prep"}
              </button>
              <p className="text-[10px]" style={{ color: "var(--vera-subtle)" }}>Vera reads your full case file. Not legal advice.</p>
            </div>
          </>
        )}
      </div>
    </>
  );
}

// ── Quick capture panel ────────────────────────────────────────────────────

function CapturePanel({ caseId, onClose }: { caseId: string; onClose: () => void }) {
  const [text, setText]     = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);

  async function submit() {
    if (!text.trim()) return;
    setSaving(true);
    const res = await fetch(`/api/cases/${caseId}/captures`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: text.trim() }),
    });
    const row = await res.json();
    window.dispatchEvent(new CustomEvent("vera-capture", { detail: row }));
    window.dispatchEvent(new CustomEvent("vera:case-updated"));
    setText(""); setSaving(false); setSaved(true);
    setTimeout(() => { setSaved(false); onClose(); }, 1200);
  }

  return (
    <div className="absolute bottom-16 right-0 z-50 w-80 rounded-2xl overflow-hidden"
      style={{ background: "var(--vera-surface)", border: "1px solid var(--vera-border)", boxShadow: "0 8px 32px rgba(28,25,23,0.14)" }}>
      <div className="px-4 py-2.5 border-b flex items-center gap-2" style={{ borderColor: "var(--vera-border)", background: "var(--vera-accent-light)" }}>
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--vera-accent)" }} />
        <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--vera-accent)" }}>Quick note</span>
      </div>
      <div className="p-3 space-y-2.5">
        <textarea autoFocus value={text} onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit(); if (e.key === "Escape") onClose(); }}
          placeholder="Log an event, call, or observation… (⌘Enter to save)"
          rows={3}
          className="w-full text-sm rounded-xl px-3 py-2.5 resize-none outline-none transition-colors"
          style={{ border: "1px solid var(--vera-border)", background: "var(--vera-cream)", color: "var(--vera-text)" }} />
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-3 py-1.5 rounded-lg text-xs font-medium" style={{ color: "var(--vera-muted)" }}>Cancel</button>
          <button onClick={submit} disabled={saving || !text.trim()}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-40"
            style={{ background: "var(--vera-accent)", color: "#fff" }}>
            {saved ? "Saved ✓" : saving ? "Saving…" : "Log it"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main FAB ──────────────────────────────────────────────────────────────

export default function FloatingActions({ caseId, isUnlocked, hearingDate }: {
  caseId: string; isUnlocked: boolean; hearingDate?: string;
}) {
  const [fabOpen,     setFabOpen]     = useState(false);
  const [chatOpen,    setChatOpen]    = useState(false);
  const [captureOpen, setCaptureOpen] = useState(false);

  function openChat()    { setFabOpen(false); setChatOpen(true); }
  function openCapture() { setFabOpen(false); setCaptureOpen(true); }
  function closeAll()    { setFabOpen(false); setChatOpen(false); setCaptureOpen(false); }

  return (
    <>
      {/* Chat drawer */}
      {chatOpen && (
        <ChatDrawer caseId={caseId} isUnlocked={isUnlocked} hearingDate={hearingDate} onClose={() => setChatOpen(false)} />
      )}

      {/* FAB container */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-2.5 print:hidden">

        {/* Quick capture panel */}
        {captureOpen && <CapturePanel caseId={caseId} onClose={() => setCaptureOpen(false)} />}

        {/* Option pills — fade in when fab is open */}
        <div className="flex flex-col items-end gap-2 transition-all duration-150 relative z-[51]"
          style={{ opacity: fabOpen ? 1 : 0, transform: fabOpen ? "translateY(0)" : "translateY(8px)", pointerEvents: fabOpen ? "auto" : "none" }}>

          <button onClick={openChat}
            className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl text-sm font-semibold transition-all hover:scale-105 active:scale-95"
            style={{ background: "var(--vera-surface)", border: "1.5px solid var(--vera-accent)", color: "var(--vera-accent)", boxShadow: "0 4px 16px rgba(194,133,58,0.2)" }}>
            <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M13 2H3a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h2l2.5 3L10 11h3a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1z"/>
              <path d="M6 6.5h4M6 8.5h2.5"/>
            </svg>
            Ask Vera
          </button>

          <button onClick={openCapture}
            className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl text-sm font-semibold transition-all hover:scale-105 active:scale-95"
            style={{ background: "var(--vera-surface)", border: "1.5px solid var(--vera-border)", color: "var(--vera-text)", boxShadow: "0 4px 12px rgba(28,25,23,0.1)" }}>
            <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M8 3v10M3 8h10"/>
            </svg>
            Log a note
          </button>
        </div>

        {/* Background dismiss */}
        {fabOpen && <div className="fixed inset-0 z-[49]" onClick={closeAll} />}

        {/* Main Vera dot */}
        <button
          onClick={() => { if (captureOpen || chatOpen) { closeAll(); } else { setFabOpen(o => !o); } }}
          className="h-14 w-14 rounded-full flex items-center justify-center transition-all hover:scale-105 active:scale-95"
          style={{ background: "var(--vera-accent)", boxShadow: "0 4px 16px rgba(194,133,58,0.4)" }}>
          <svg className="transition-transform duration-200" style={{ transform: fabOpen ? "rotate(45deg)" : "none" }}
            width="22" height="22" viewBox="0 0 22 22" fill="none">
            <circle cx="11" cy="11" r="11" fill="var(--vera-accent)"/>
            <path d="M6.5 7.5L11 15L15.5 7.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>
    </>
  );
}
