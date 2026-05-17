import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Vera — Legal Case Management for Self-Represented Litigants",
  description:
    "Organize your case, track evidence, and let AI read your documents. Built for people going to court without an attorney. Free to start, $49 to unlock AI.",
  alternates: {
    canonical: "https://veracase.app",
  },
};

const S = {
  cream:       "#FAF7F2",
  surface:     "#FFFFFF",
  border:      "#E8E2D9",
  text:        "#1C1917",
  muted:       "#78716C",
  subtle:      "#A8A29E",
  accent:      "#C2853A",
  accentLight: "#FDF4E6",
};

function Check() {
  return (
    <svg className="h-4 w-4 flex-shrink-0 mt-0.5" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="7" fill="#FDF4E6"/>
      <path d="M5 8l2 2 4-4" stroke="#C2853A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: S.cream }}>

      {/* Nav */}
      <header className="border-b px-6 py-4 flex items-center justify-between sticky top-0 z-10"
        style={{ borderColor: S.border, background: S.surface }}>
        <span className="flex items-center gap-2">
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <circle cx="11" cy="11" r="11" fill="#C2853A"/>
            <path d="M6.5 7.5L11 15L15.5 7.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span className="text-xl font-bold tracking-tight" style={{ color: S.text }}>Vera</span>
        </span>
        <div className="flex gap-4 items-center">
          <Link href="/pricing" className="text-sm font-medium hidden sm:block" style={{ color: S.muted }}>Pricing</Link>
          <Link href="/sign-in" className="text-sm font-medium" style={{ color: S.muted }}>Sign in</Link>
          <Link href="/sign-up"
            className="text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
            style={{ background: S.accent, color: "#fff" }}>
            Get started free
          </Link>
        </div>
      </header>

      <main className="flex-1">

        {/* Hero */}
        <section className="flex flex-col items-center text-center px-6 pt-20 pb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-6"
            style={{ background: S.accentLight, color: S.accent, border: `1px solid #E8D5B0` }}>
            Case management for self-represented litigants
          </div>
          <h1 className="text-5xl sm:text-6xl font-bold leading-[1.06] tracking-tight max-w-2xl mb-5"
            style={{ color: S.text }}>
            Don&apos;t go to court<br />unprepared.
          </h1>
          <p className="text-lg max-w-xl leading-relaxed mb-10" style={{ color: S.muted }}>
            Vera reads your documents, builds your timeline, tracks your evidence, and tells you
            exactly what you have — and what&apos;s missing. Built for people representing themselves.
          </p>
          <div className="flex gap-3 flex-wrap justify-center">
            <Link href="/sign-up"
              className="px-8 py-3.5 rounded-xl font-semibold text-base transition-colors"
              style={{ background: S.accent, color: "#fff" }}>
              Start your case — free
            </Link>
            <Link href="/pricing"
              className="px-8 py-3.5 rounded-xl font-semibold text-base border transition-colors"
              style={{ borderColor: S.border, color: S.muted }}>
              See pricing
            </Link>
          </div>
          <p className="mt-4 text-sm" style={{ color: S.subtle }}>No credit card. No attorney required.</p>
        </section>

        {/* UI mockup */}
        <section className="px-6 pb-20 flex justify-center">
          <div className="w-full max-w-3xl rounded-2xl overflow-hidden shadow-2xl"
            style={{ border: `1px solid ${S.border}` }}>
            <div className="flex items-center gap-2 px-4 py-3" style={{ background: "#F5F5F4", borderBottom: `1px solid ${S.border}` }}>
              <span className="h-3 w-3 rounded-full" style={{ background: "#FC5857" }} />
              <span className="h-3 w-3 rounded-full" style={{ background: "#FDBC2C" }} />
              <span className="h-3 w-3 rounded-full" style={{ background: "#34C749" }} />
              <span className="flex-1 mx-4 text-xs text-center py-1 rounded-md" style={{ background: S.surface, color: S.subtle, border: `1px solid ${S.border}` }}>
                veracase.app/cases/smith-v-jones
              </span>
            </div>
            <div className="p-6 space-y-4" style={{ background: S.cream }}>
              <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${S.border}`, background: S.surface }}>
                <div className="px-5 py-3 flex items-center gap-2.5" style={{ background: S.accentLight, borderBottom: `1px solid #E8D5B0` }}>
                  <span className="h-2 w-2 rounded-full" style={{ background: S.accent }} />
                  <span className="text-sm font-bold" style={{ color: S.text }}>Vera&apos;s Take</span>
                  <span className="text-xs" style={{ color: S.muted }}>— based on everything in your case file</span>
                </div>
                <div className="px-5 py-4 space-y-3">
                  <p className="text-sm leading-relaxed" style={{ color: S.text }}>
                    This is a contested divorce in Travis County, TX. The marital home is the primary asset in dispute, and opposing counsel has been unresponsive to the last two settlement offers.
                  </p>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: S.subtle }}>What I notice</p>
                      <ul className="space-y-1.5">
                        {["The timeline shows a pattern of delayed responses from opposing counsel", "Your email thread is your strongest documented evidence"].map(o => (
                          <li key={o} className="flex gap-2 text-xs"><span className="mt-0.5 h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ background: S.accent }} /><span style={{ color: S.text }}>{o}</span></li>
                        ))}
                      </ul>
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: S.subtle }}>What may be missing</p>
                      <ul className="space-y-1.5">
                        {["Bank statements for the past 3 years", "Property appraisal or current market value"].map(g => (
                          <li key={g} className="flex gap-2 text-xs"><span className="mt-0.5 flex-shrink-0" style={{ color: "#DC2626" }}>○</span><span style={{ color: S.text }}>{g}</span></li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  <div className="rounded-xl px-4 py-3 flex gap-3" style={{ background: S.accentLight, border: "1px solid #E8D5B0" }}>
                    <span className="text-[11px] font-bold uppercase tracking-widest flex-shrink-0" style={{ color: S.accent }}>Next</span>
                    <p className="text-sm" style={{ color: S.text }}>File your financial disclosure before the November 4th deadline — required before the court will schedule a hearing on property division.</p>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-2.5">
                {[["Timeline events","14"],["Documents","11"],["Active tasks","6"],["Next deadline","3d"]].map(([l,v]) => (
                  <div key={l} className="rounded-xl px-3 py-2.5" style={{ background: S.surface, border: `1px solid ${S.border}` }}>
                    <p className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: S.subtle }}>{l}</p>
                    <p className="text-lg font-bold" style={{ color: S.text }}>{v}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="px-6 pb-20">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl font-bold tracking-tight text-center mb-12" style={{ color: S.text }}>
              How it works
            </h2>
            <div className="grid sm:grid-cols-3 gap-8">
              {[
                {
                  n: "1",
                  title: "Upload your documents",
                  desc: "PDFs, photos, emails, voicemails, Word docs, spreadsheets. Vera accepts everything. Drop them in and hit Process.",
                },
                {
                  n: "2",
                  title: "Vera reads everything",
                  desc: "AI extracts your timeline, logs your evidence, flags missing documents, and builds a structured case file from your uploads.",
                },
                {
                  n: "3",
                  title: "Stay organized and ahead",
                  desc: "Track deadlines, generate court documents, ask Vera questions about your own case, and know exactly where you stand.",
                },
              ].map(s => (
                <div key={s.n} className="text-center sm:text-left">
                  <div className="inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold mb-4"
                    style={{ background: S.accentLight, color: S.accent }}>
                    {s.n}
                  </div>
                  <p className="text-base font-semibold mb-2" style={{ color: S.text }}>{s.title}</p>
                  <p className="text-sm leading-relaxed" style={{ color: S.muted }}>{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="px-6 pb-20" style={{ background: S.surface, borderTop: `1px solid ${S.border}`, borderBottom: `1px solid ${S.border}` }}>
          <div className="max-w-3xl mx-auto py-20">
            <h2 className="text-3xl font-bold tracking-tight text-center mb-3" style={{ color: S.text }}>
              Everything in one place.
            </h2>
            <p className="text-center mb-12 text-base" style={{ color: S.muted }}>
              ChatGPT doesn&apos;t know your case. Vera does.
            </p>
            <div className="grid sm:grid-cols-2 gap-4">
              {[
                { title: "AI document processing", desc: "Upload PDFs, photos, emails, audio. Vera reads everything and automatically builds your timeline, evidence log, and task list." },
                { title: "Vera's Take", desc: "Every time you open your case, Vera reads the full file and tells you what you have, what's missing, and what to do next." },
                { title: "Ask Vera", desc: "Ask questions about your own case. Vera answers from your documents — not from generic legal information." },
                { title: "Generate court documents", desc: "Draft a police statement, letter to opposing counsel, or court declaration in one click — pre-filled with your case details." },
                { title: "Tamper-evident evidence log", desc: "Every uploaded file gets a SHA-256 fingerprint. Admissible proof that documents weren't altered after upload." },
                { title: "Deadline tracking", desc: "Add court dates, filing deadlines, response deadlines. Email reminders 7 days and 1 day before each one." },
              ].map(f => (
                <div key={f.title} className="rounded-2xl p-5 space-y-2" style={{ background: S.cream, border: `1px solid ${S.border}` }}>
                  <div className="flex items-start gap-2.5">
                    <Check />
                    <p className="text-sm font-semibold" style={{ color: S.text }}>{f.title}</p>
                  </div>
                  <p className="text-sm leading-relaxed pl-6" style={{ color: S.muted }}>{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Trust */}
        <section className="px-6 py-20">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl font-bold tracking-tight text-center mb-3" style={{ color: S.text }}>
              Your documents are safe.
            </h2>
            <p className="text-center text-sm mb-12" style={{ color: S.muted }}>
              Legal documents are sensitive. Here is exactly what happens to yours.
            </p>
            <div className="grid sm:grid-cols-2 gap-5">
              {[
                {
                  title: "Private storage, no public URL",
                  desc: "Every file you upload is stored in private Vercel Blob storage with a unique access key. There is no public URL for your documents. Only your authenticated account can retrieve them.",
                },
                {
                  title: "AI processes it — never learns from it",
                  desc: "When you process a document, its text is sent to Anthropic's Claude API. Anthropic's commercial API terms prohibit using customer data to train or improve AI models. Your case content is never used for that purpose.",
                },
                {
                  title: "Three named services, nothing else",
                  desc: "Your data touches exactly three services: Vercel (hosting + file storage), Neon (database), and Anthropic (AI). No advertising networks, data brokers, or analytics platforms ever see your case content.",
                },
                {
                  title: "You can delete everything",
                  desc: "Delete individual documents, cases, or your entire account from the Settings tab. All associated files are permanently removed from storage within seconds. We do not keep backups of deleted accounts.",
                },
              ].map(t => (
                <div key={t.title} className="rounded-2xl p-5" style={{ background: S.surface, border: `1px solid ${S.border}` }}>
                  <p className="text-sm font-semibold mb-2" style={{ color: S.text }}>{t.title}</p>
                  <p className="text-sm leading-relaxed" style={{ color: S.muted }}>{t.desc}</p>
                </div>
              ))}
            </div>
            <p className="text-center text-xs mt-6" style={{ color: S.subtle }}>
              <a href="/privacy" style={{ color: S.accent }}>Read our full privacy policy →</a>
            </p>
          </div>
        </section>

        {/* FAQ */}
        <section className="px-6 pb-20" style={{ background: S.surface, borderTop: `1px solid ${S.border}` }}>
          <div className="max-w-2xl mx-auto py-20 space-y-8">
            <h2 className="text-3xl font-bold tracking-tight text-center" style={{ color: S.text }}>
              Common questions
            </h2>
            {[
              {
                q: "Is this legal advice?",
                a: "No. Vera is a case management and organization tool. It helps you organize documents and understand your case file. It does not provide legal advice and does not create an attorney-client relationship. Always consult an attorney before making legal decisions.",
              },
              {
                q: "What types of cases does Vera support?",
                a: "Vera is built for divorce, custody, landlord/tenant disputes, employment matters, and small claims. The document processing and AI analysis work for any civil legal matter.",
              },
              {
                q: "Can I use this alongside an attorney?",
                a: "Yes — many users share their Vera case export with an attorney to speed up intake. The structured timeline and evidence log gives an attorney a clear picture of your case immediately.",
              },
              {
                q: "What file types can I upload?",
                a: "PDFs, Word documents, images (JPG, PNG, HEIC), emails, audio recordings (MP3, M4A, WAV), video files, Excel spreadsheets, and plain text files. Vera transcribes audio and video automatically.",
              },
              {
                q: "How is my data protected?",
                a: "Files are stored in private Vercel Blob storage — no public URL exists for your documents. AI processing is done via Anthropic's API, which prohibits using customer data for model training. Your data touches three services total: Vercel, Neon (database), and Anthropic. No advertising networks or data brokers. You can delete your account and all data at any time.",
              },
              {
                q: "What does the free plan include?",
                a: "Unlimited cases with full case management — timeline, tasks, deadlines, evidence, documents. AI features (document processing, Vera's Take, Ask Vera chat, AI drafts) unlock per case for $49 one-time. No subscription, no renewal.",
              },
            ].map(({ q, a }) => (
              <div key={q} className="space-y-2 pb-8 border-b last:border-0 last:pb-0" style={{ borderColor: S.border }}>
                <p className="text-base font-semibold" style={{ color: S.text }}>{q}</p>
                <p className="text-sm leading-relaxed" style={{ color: S.muted }}>{a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Pricing callout */}
        <section className="px-6 pb-16" style={{ background: S.surface, borderTop: `1px solid ${S.border}` }}>
          <div className="max-w-2xl mx-auto py-16">
            <h2 className="text-3xl font-bold tracking-tight text-center mb-3" style={{ color: S.text }}>
              Free to organize. $49 to unlock AI.
            </h2>
            <p className="text-center text-base mb-10" style={{ color: S.muted }}>
              No subscription. No monthly bill. Pay once per case, keep the AI forever.
            </p>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="rounded-2xl p-5 space-y-3" style={{ background: S.cream, border: `1px solid ${S.border}` }}>
                <p className="text-xs font-bold uppercase tracking-widest" style={{ color: S.subtle }}>Always free</p>
                <ul className="space-y-2">
                  {["Unlimited cases","Timeline, tasks & deadlines","Document upload & storage","Evidence log","Finances tracker"].map(f => (
                    <li key={f} className="flex items-center gap-2 text-sm" style={{ color: S.text }}>
                      <span className="text-xs" style={{ color: S.subtle }}>✓</span>{f}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-2xl p-5 space-y-3" style={{ background: S.accentLight, border: `1px solid #E8D5B0` }}>
                <p className="text-xs font-bold uppercase tracking-widest" style={{ color: S.accent }}>AI unlock — $49 once per case</p>
                <ul className="space-y-2">
                  {["AI document processing","Vera's Take case analysis","Ask Vera chat","AI draft generation","No renewal, ever"].map(f => (
                    <li key={f} className="flex items-center gap-2 text-sm" style={{ color: S.text }}>
                      <span className="text-xs" style={{ color: S.accent }}>✓</span>{f}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="px-6 pb-24 text-center">
          <h2 className="text-3xl font-bold mb-3" style={{ color: S.text }}>Start today. It&apos;s free.</h2>
          <p className="text-base mb-8" style={{ color: S.muted }}>Build your case for free. Unlock AI when you&apos;re ready.</p>
          <Link href="/sign-up"
            className="inline-block px-10 py-4 rounded-xl font-semibold text-base transition-colors"
            style={{ background: S.accent, color: "#fff" }}>
            Create your case file →
          </Link>
        </section>
      </main>

      <footer className="border-t px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm"
        style={{ borderColor: S.border, color: S.subtle }}>
        <span>© {new Date().getFullYear()} Vera. Not a law firm. Not legal advice.</span>
        <div className="flex gap-4">
          <Link href="/pricing" style={{ color: S.subtle }}>Pricing</Link>
          <Link href="/privacy" style={{ color: S.subtle }}>Privacy</Link>
          <Link href="/terms" style={{ color: S.subtle }}>Terms</Link>
          <Link href="/sign-in" style={{ color: S.subtle }}>Sign in</Link>
        </div>
      </footer>
    </div>
  );
}
