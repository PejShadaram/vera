export const dynamic = "force-dynamic";
import { UserButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import sql from "@/lib/db";
import { isAdminUser } from "@/lib/adminAuth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  const isAdmin = await isAdminUser(userId);

  return (
    <div className="min-h-screen" style={{ background: "var(--vera-cream)" }}>
      <header className="sticky top-0 z-10 border-b" style={{ background: "var(--vera-surface)", borderColor: "var(--vera-border)" }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-5 py-3.5 flex items-center justify-between gap-3">
          <Link href="/dashboard" className="flex items-center gap-2 flex-shrink-0">
            <svg width="28" height="28" viewBox="0 0 22 22" fill="none">
              <circle cx="11" cy="11" r="11" fill="#C2853A"/>
              <path d="M6.5 7.5L11 15L15.5 7.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className="text-lg font-bold tracking-tight" style={{ color: "var(--vera-text)" }}>Vera</span>
            <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-widest hidden sm:inline"
              style={{ background: "var(--vera-accent-light)", color: "var(--vera-accent)" }}>
              Beta
            </span>
          </Link>
          <div className="flex items-center gap-3 sm:gap-4">
            {isAdmin && (
              <Link href="/admin" className="text-sm font-medium hidden sm:block" style={{ color: "var(--vera-accent)" }}>
                Admin
              </Link>
            )}
            <Link href="/account" className="text-sm font-medium hidden sm:block" style={{ color: "var(--vera-muted)" }}>
              Account
            </Link>
            <UserButton />
          </div>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 sm:px-5 py-6 sm:py-8">{children}</main>
    </div>
  );
}
