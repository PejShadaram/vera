import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy Policy — Vera" };

const S = { cream: "#FAF7F2", surface: "#FFFFFF", border: "#E8E2D9", text: "#1C1917", muted: "#78716C", subtle: "#A8A29E", accent: "#C2853A" };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h2 className="text-base font-bold" style={{ color: S.text }}>{title}</h2>
      <div className="text-sm leading-relaxed space-y-2" style={{ color: S.muted }}>{children}</div>
    </div>
  );
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen" style={{ background: S.cream }}>
      <header className="border-b px-6 py-4 flex items-center justify-between" style={{ borderColor: S.border, background: S.surface }}>
        <Link href="/" className="text-xl font-bold tracking-tight" style={{ color: S.text }}>Vera</Link>
      </header>
      <main className="max-w-2xl mx-auto px-6 py-12 space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-2" style={{ color: S.text }}>Privacy Policy</h1>
          <p className="text-sm" style={{ color: S.subtle }}>Effective date: May 16, 2026</p>
        </div>

        <Section title="Who we are">
          <p>Vera is a case management tool for self-represented individuals. We are operated as an independent software product. Questions about this policy can be directed to <a href="mailto:support@veracase.app" style={{ color: S.accent }}>support@veracase.app</a>.</p>
        </Section>

        <Section title="What we collect">
          <p><strong style={{ color: S.text }}>Account information:</strong> Your email address and name, provided through Clerk authentication (Google, email/password).</p>
          <p><strong style={{ color: S.text }}>Case data:</strong> Documents you upload, timeline entries, evidence logs, financial information, notes, and other case-related content you enter into Vera.</p>
          <p><strong style={{ color: S.text }}>Usage data:</strong> Basic analytics about how you use the product (page views, feature usage). We do not use third-party advertising trackers.</p>
          <p><strong style={{ color: S.text }}>Payment information:</strong> Billing is handled entirely by Stripe. Vera does not store credit card numbers or payment details.</p>
        </Section>

        <Section title="How we use your data">
          <p>We use your data solely to provide the Vera service — storing your case file, running AI analysis, sending deadline reminders, and processing payments. We do not sell your data to third parties. We do not use your case content to train AI models.</p>
        </Section>

        <Section title="AI processing">
          <p>Documents and case data you provide are sent to Anthropic (Claude) for analysis. This includes document text, timeline entries, and evidence summaries. Anthropic processes this data subject to their <a href="https://www.anthropic.com/privacy" target="_blank" rel="noopener" style={{ color: S.accent }}>privacy policy</a>. Audio files are transcribed using OpenAI Whisper, subject to OpenAI&apos;s <a href="https://openai.com/policies/privacy-policy" target="_blank" rel="noopener" style={{ color: S.accent }}>privacy policy</a>.</p>
          <p>We recommend not uploading documents containing third-party personal information beyond what is necessary for your case.</p>
        </Section>

        <Section title="Data storage">
          <p>Case data is stored in a PostgreSQL database hosted on Neon (US East). Uploaded files are stored in Vercel Blob storage. Authentication is managed by Clerk. All data is encrypted in transit and at rest.</p>
        </Section>

        <Section title="Data retention">
          <p>Your data is retained for as long as your account is active. You can delete individual cases (and all associated data) at any time from the case Settings tab. To delete your entire account, contact us at the email above.</p>
        </Section>

        <Section title="Your rights">
          <p>You have the right to access, export, or delete your personal data at any time. To request a full data export or account deletion, contact us. We will respond within 30 days.</p>
        </Section>

        <Section title="Not legal advice">
          <p>Vera is a case management and organization tool. It is not a law firm, does not provide legal advice, and does not create an attorney-client relationship. Nothing in Vera constitutes legal advice.</p>
        </Section>

        <Section title="Changes">
          <p>We may update this policy from time to time. We will notify you by email if we make material changes. Continued use of Vera after notice constitutes acceptance.</p>
        </Section>

        <p className="text-sm pt-4" style={{ color: S.subtle }}>
          <Link href="/terms" style={{ color: S.accent }}>Terms of Service</Link> · <Link href="/" style={{ color: S.subtle }}>Back to Vera</Link>
        </p>
      </main>
    </div>
  );
}
