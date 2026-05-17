import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

export const metadata: Metadata = {
  metadataBase: new URL("https://veracase.app"),
  title: "Vera — Legal Case Management for Self-Represented Litigants",
  description:
    "Organize your case, track evidence, and let AI read your documents. Built for people going to court without an attorney. Free to start, $49 to unlock AI.",
  keywords: [
    "pro se",
    "self-represented litigant",
    "legal case management",
    "divorce documents",
    "court case organizer",
    "legal AI tool",
  ],
  openGraph: {
    title: "Vera — Legal Case Management for Self-Represented Litigants",
    description:
      "Organize your case, track evidence, and let AI read your documents. Built for people going to court without an attorney. Free to start, $49 to unlock AI.",
    url: "https://veracase.app",
    siteName: "Vera",
    type: "website",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Vera — Legal Case Management for Self-Represented Litigants",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Vera — Legal Case Management for Self-Represented Litigants",
    description:
      "Organize your case, track evidence, and let AI read your documents. Built for people going to court without an attorney. Free to start, $49 to unlock AI.",
    images: ["/twitter-image"],
  },
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: "https://veracase.app",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      signInFallbackRedirectUrl="/dashboard"
      signUpFallbackRedirectUrl="/dashboard"
    >
      <html lang="en" className={`${geist.variable} ${geistMono.variable} h-full`}>
        <body className="min-h-full">{children}<Analytics /></body>
      </html>
    </ClerkProvider>
  );
}
