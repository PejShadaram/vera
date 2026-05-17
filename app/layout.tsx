import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

export const metadata: Metadata = {
  title: "Vera — Your case, organized.",
  description: "Case management for self-represented litigants. Upload documents, build your timeline, track evidence — and ask Vera what it all means.",
  openGraph: {
    title: "Vera — Your case, organized.",
    description: "Case management for self-represented litigants. Upload documents, build your timeline, track evidence — and ask Vera what it all means.",
    type: "website",
    siteName: "Vera",
  },
  twitter: {
    card: "summary",
    title: "Vera — Your case, organized.",
    description: "Case management for self-represented litigants. Upload documents, build your timeline, track evidence — and ask Vera what it all means.",
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
        <body className="min-h-full">{children}</body>
      </html>
    </ClerkProvider>
  );
}
