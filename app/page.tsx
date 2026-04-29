import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="border-b border-gray-100 px-6 py-4 flex items-center justify-between">
        <span className="text-xl font-bold text-gray-900">Vera</span>
        <div className="flex gap-3">
          <Button variant="ghost" asChild><Link href="/sign-in">Sign in</Link></Button>
          <Button asChild><Link href="/sign-up">Get started</Link></Button>
        </div>
      </header>
      <main className="flex-1 flex flex-col items-center justify-center text-center px-6 py-24">
        <p className="text-sm font-semibold text-blue-600 uppercase tracking-widest mb-4">AI-powered legal case companion</p>
        <h1 className="text-5xl font-bold text-gray-900 leading-tight max-w-2xl">Know where you stand.</h1>
        <p className="mt-6 text-xl text-gray-500 max-w-xl leading-relaxed">
          Vera helps you organize documents, track evidence, and stay on top of deadlines — so you can represent yourself with confidence.
        </p>
        <div className="mt-10 flex gap-4">
          <Button size="lg" asChild><Link href="/sign-up">Start your case — free</Link></Button>
          <Button size="lg" variant="outline" asChild><Link href="/sign-in">Sign in</Link></Button>
        </div>
        <p className="mt-6 text-sm text-gray-400">No attorney required. No legal advice provided.</p>
      </main>
      <footer className="border-t border-gray-100 px-6 py-5 text-center text-sm text-gray-400">
        © {new Date().getFullYear()} Vera. Not a law firm. Not legal advice.
      </footer>
    </div>
  );
}
