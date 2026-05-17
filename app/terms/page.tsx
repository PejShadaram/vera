import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Terms of Service — Vera" };

const S = { cream: "#FAF7F2", surface: "#FFFFFF", border: "#E8E2D9", text: "#1C1917", muted: "#78716C", subtle: "#A8A29E", accent: "#C2853A" };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h2 className="text-base font-bold" style={{ color: S.text }}>{title}</h2>
      <div className="text-sm leading-relaxed space-y-2" style={{ color: S.muted }}>{children}</div>
    </div>
  );
}

export default function TermsPage() {
  return (
    <div className="min-h-screen" style={{ background: S.cream }}>
      <header className="border-b px-6 py-4 flex items-center justify-between" style={{ borderColor: S.border, background: S.surface }}>
        <Link href="/" className="text-xl font-bold tracking-tight" style={{ color: S.text }}>Vera</Link>
      </header>
      <main className="max-w-2xl mx-auto px-6 py-12 space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-2" style={{ color: S.text }}>Terms of Service</h1>
          <p className="text-sm" style={{ color: S.subtle }}>Effective date: May 16, 2026</p>
        </div>

        <Section title="Acceptance">
          <p>By creating an account or using Vera, you agree to these terms. If you do not agree, do not use the service.</p>
        </Section>

        <Section title="What Vera is">
          <p>Vera is a case management and document organization tool for self-represented individuals. Vera is not a law firm. It does not provide legal advice. It does not create an attorney-client relationship. No information provided by Vera — including AI-generated analysis, document drafts, or suggestions — constitutes legal advice.</p>
          <p>You are solely responsible for your legal decisions and for verifying any information before relying on it in legal proceedings.</p>
        </Section>

        <Section title="Your account">
          <p>You must provide accurate information when creating an account. You are responsible for maintaining the security of your account credentials. You may not share your account with others.</p>
          <p>You must be at least 18 years old to use Vera.</p>
        </Section>

        <Section title="Your content">
          <p>You own all content you upload to Vera — documents, notes, timeline entries, and other case data. By using the service, you grant Vera a limited license to process and store that content solely to provide the service.</p>
          <p>You are responsible for ensuring you have the right to upload any content you provide. Do not upload content that violates applicable law or the rights of third parties.</p>
        </Section>

        <Section title="Acceptable use">
          <p>You agree not to use Vera to harass or defame others, to upload malware or malicious content, to attempt to gain unauthorized access to the service or its infrastructure, or for any unlawful purpose.</p>
        </Section>

        <Section title="AI-generated content">
          <p>Vera uses AI to analyze your case file and generate analysis, drafts, and suggestions. This content is generated automatically and may be inaccurate, incomplete, or outdated. Always review AI-generated content carefully before using it in any legal proceeding. Vera is not liable for errors in AI-generated output.</p>
        </Section>

        <Section title="Subscriptions and billing">
          <p>Vera offers a free tier and a paid Pro subscription. Subscription fees are billed in advance on a monthly or annual basis. You may cancel at any time through the billing portal; cancellation takes effect at the end of the current billing period.</p>
          <p>All fees are non-refundable except where required by law.</p>
        </Section>

        <Section title="Service availability">
          <p>We aim for high availability but do not guarantee uninterrupted service. We may modify, suspend, or discontinue features at any time. We will provide reasonable notice for significant changes.</p>
        </Section>

        <Section title="Limitation of liability">
          <p>To the maximum extent permitted by law, Vera is provided "as is" without warranties of any kind. We are not liable for any damages arising from your use of the service, including lost data, missed deadlines, or adverse legal outcomes. Our total liability to you shall not exceed the amount you paid us in the 12 months preceding the claim.</p>
        </Section>

        <Section title="Governing law">
          <p>These terms are governed by the laws of the State of Texas, without regard to conflict of law principles.</p>
        </Section>

        <Section title="Contact">
          <p>Questions about these terms: <a href="mailto:support@vera-opal-zeta.vercel.app" style={{ color: S.accent }}>support@vera-opal-zeta.vercel.app</a></p>
        </Section>

        <p className="text-sm pt-4" style={{ color: S.subtle }}>
          <Link href="/privacy" style={{ color: S.accent }}>Privacy Policy</Link> · <Link href="/" style={{ color: S.subtle }}>Back to Vera</Link>
        </p>
      </main>
    </div>
  );
}
