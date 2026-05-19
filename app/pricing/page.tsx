import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Vera Pricing — $49 to unlock AI on your case",
  description:
    "Vera is free to start. Unlock AI document processing, case analysis, and drafts for $49 per case — one-time, no subscription.",
  alternates: { canonical: "https://veracase.app/pricing" },
};

const S = {
  cream:       "#F9FAFB",
  surface:     "#FFFFFF",
  border:      "#E5E7EB",
  text:        "#111827",
  muted:       "#6B7280",
  subtle:      "#9CA3AF",
  accent:      "#C2853A",
  accentLight: "#FEF3C7",
};

const FREE_FEATURES = [
  "Unlimited cases",
  "Timeline, evidence & task tracking",
  "Deadlines with email reminders",
  "Document upload & secure storage",
  "Finances tracker & settlement calculator",
  "Rules & statutes for your case type",
  "Notes pad",
];

const UNLOCK_FEATURES = [
  "Everything in Free",
  "AI document processing — PDFs, images, audio, spreadsheets",
  "Vera's Take — case analysis with gaps, patterns & next steps",
  "Ask Vera — chat with your entire case file",
  "AI draft generation — declarations, demand letters, police statements",
  "Court form guide with pre-filled fields for your jurisdiction",
  "Opposing document analysis — claims, arguments & response deadline",
  "Hearing prep — personalized talking points for your court date",
];

export default function PricingPage() {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: S.cream }}>

      <header className="border-b px-6 py-4 flex items-center justify-between" style={{ borderColor: S.border, background: S.surface }}>
        <Link href="/" className="flex items-center gap-2">
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <circle cx="11" cy="11" r="11" fill="#C2853A"/>
            <path d="M6.5 7.5L11 15L15.5 7.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span className="text-xl font-bold tracking-tight" style={{ color: S.text }}>Vera</span>
        </Link>
        <div className="flex gap-3 items-center">
          <Link href="/sign-in" className="text-sm font-medium" style={{ color: S.muted }}>Sign in</Link>
          <Link href="/dashboard" className="text-sm font-semibold px-4 py-2 rounded-lg" style={{ background: S.accent, color: "#fff" }}>Dashboard</Link>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center px-6 py-20">
        <p className="text-xs font-bold uppercase tracking-[0.2em] mb-4" style={{ color: S.accent }}>Pricing</p>
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-center mb-3" style={{ color: S.text }}>
          Free to organize.<br />$49 to unlock AI.
        </h1>
        <p className="text-lg text-center max-w-lg mb-4" style={{ color: S.muted }}>
          Build your case for free. When you&apos;re ready to let AI read it — one payment, this case, forever.
        </p>
        <p className="text-sm text-center mb-14 font-medium" style={{ color: S.accent }}>
          One hour with an attorney costs $300–500. Vera costs $49, once.
        </p>

        {/* Main pricing cards */}
        <div className="grid sm:grid-cols-2 gap-5 w-full max-w-2xl">

          {/* Free */}
          <div className="rounded-2xl p-7 flex flex-col" style={{ background: S.surface, border: `1px solid ${S.border}` }}>
            <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: S.subtle }}>Free</p>
            <div className="flex items-baseline gap-1 mb-1">
              <span className="text-5xl font-bold" style={{ color: S.text }}>$0</span>
            </div>
            <p className="text-sm mb-7" style={{ color: S.muted }}>Unlimited cases. No credit card.</p>
            <ul className="space-y-3 mb-8 flex-1">
              {FREE_FEATURES.map(f => (
                <li key={f} className="flex items-start gap-2.5 text-sm" style={{ color: S.text }}>
                  <span className="mt-0.5 flex-shrink-0 font-bold" style={{ color: S.subtle }}>✓</span>
                  {f}
                </li>
              ))}
            </ul>
            <Link href="/sign-up"
              className="w-full text-center py-3 rounded-xl text-sm font-semibold border transition-colors hover:opacity-80"
              style={{ borderColor: S.border, color: S.muted }}>
              Get started free
            </Link>
          </div>

          {/* AI Unlock */}
          <div className="rounded-2xl p-7 flex flex-col relative overflow-hidden"
            style={{ background: S.accent, border: `2px solid ${S.accent}`, color: "#fff" }}>
            <span className="absolute top-4 right-4 text-[11px] font-bold px-2.5 py-1 rounded-full"
              style={{ background: "rgba(255,255,255,0.2)" }}>
              Per case · One time
            </span>
            <p className="text-xs font-bold uppercase tracking-widest mb-2 opacity-80">AI Unlock</p>
            <div className="flex items-baseline gap-1 mb-1">
              <span className="text-5xl font-bold">$49</span>
            </div>
            <p className="text-sm mb-7 opacity-70">One case · No subscription · Yours forever</p>
            <ul className="space-y-3 mb-8 flex-1">
              {UNLOCK_FEATURES.map(f => (
                <li key={f} className="flex items-start gap-2.5 text-sm">
                  <span className="mt-0.5 flex-shrink-0 opacity-70">✓</span>
                  {f}
                </li>
              ))}
            </ul>
            <Link href="/dashboard"
              className="w-full text-center py-3 rounded-xl text-sm font-bold transition-colors hover:opacity-90"
              style={{ background: "#fff", color: S.accent }}>
              Go to your case to unlock
            </Link>
          </div>
        </div>

        {/* Bundle option */}
        <div className="mt-5 w-full max-w-2xl rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center gap-4"
          style={{ background: S.surface, border: `1px solid ${S.border}` }}>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-1">
              <p className="text-sm font-bold" style={{ color: S.text }}>2-Case Bundle</p>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: S.accentLight, color: S.accent }}>Save $19</span>
            </div>
            <p className="text-sm" style={{ color: S.muted }}>
              Have two related cases — a divorce and a custody matter, or two separate filings?
              Unlock AI on both for $79. Credits apply to any cases, now or later.
            </p>
          </div>
          <div className="flex-shrink-0 text-right">
            <p className="text-2xl font-bold mb-0.5" style={{ color: S.text }}>$79</p>
            <p className="text-xs mb-3" style={{ color: S.subtle }}>2 case unlocks · One time</p>
            <BundleButton />
          </div>
        </div>

        {/* How it works */}
        <div className="mt-14 max-w-lg text-center space-y-3">
          <p className="text-sm font-semibold" style={{ color: S.text }}>How it works</p>
          <p className="text-sm" style={{ color: S.muted }}>
            Open any case, add your documents and timeline for free. Upload a document and Vera reads it —
            extracting your timeline, evidence, and tasks automatically. When you&apos;re ready for the full
            AI analysis — click <strong style={{ color: S.text }}>"Unlock AI — $49"</strong> from inside the case.
            AI activates instantly.
          </p>
        </div>

        {/* FAQ */}
        <div className="mt-12 grid sm:grid-cols-3 gap-5 w-full max-w-2xl text-center">
          {[
            { q: "Does this renew?", a: "No. $49 is one-time. The AI stays on for the life of the case — no subscription, no renewals." },
            { q: "What about multiple cases?", a: "Each case unlocks for $49. Buy a 2-case bundle for $79 and save $19. Credits apply to any cases, whenever you're ready." },
            { q: "Is this legal advice?", a: "No. Vera is an AI reading your documents and helping you organize. Always consult an attorney for legal decisions." },
          ].map(({ q, a }) => (
            <div key={q} className="rounded-2xl p-5 text-left" style={{ background: S.surface, border: `1px solid ${S.border}` }}>
              <p className="text-sm font-semibold mb-1.5" style={{ color: S.text }}>{q}</p>
              <p className="text-xs leading-relaxed" style={{ color: S.muted }}>{a}</p>
            </div>
          ))}
        </div>
      </main>

      <footer className="border-t px-6 py-5 text-center text-sm" style={{ borderColor: S.border, color: S.subtle }}>
        © {new Date().getFullYear()} Vera. Not a law firm. Not legal advice.
        {" · "}
        <a href="mailto:support@veracase.app" style={{ color: S.accent }}>support@veracase.app</a>
      </footer>
    </div>
  );
}

function BundleButton() {
  return (
    <Link href="/dashboard?bundle=1"
      className="text-sm font-bold px-5 py-2.5 rounded-xl transition-colors hover:opacity-90 inline-block"
      style={{ background: "#111827", color: "#fff" }}>
      Get bundle — $79
    </Link>
  );
}
