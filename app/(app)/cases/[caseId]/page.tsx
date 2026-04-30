import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";
import sql from "@/lib/db";
import CaseTabs from "./CaseTabs";

export const dynamic = "force-dynamic";

export default async function CasePage({ params }: { params: Promise<{ caseId: string }> }) {
  const { userId } = await auth();
  const { caseId } = await params;

  const [c] = await sql`SELECT * FROM cases WHERE id = ${caseId} AND user_id = ${userId}`;
  if (!c) notFound();

  const [timeline, evidence, documents, tasks, captures, deadlines, finances] = await Promise.all([
    sql`SELECT * FROM timeline_entries WHERE case_id = ${caseId} ORDER BY date, created_at`,
    sql`SELECT * FROM evidence WHERE case_id = ${caseId} ORDER BY created_at`,
    sql`SELECT * FROM documents WHERE case_id = ${caseId} ORDER BY created_at DESC`,
    sql`SELECT * FROM tasks WHERE case_id = ${caseId} ORDER BY created_at`,
    sql`SELECT * FROM captures WHERE case_id = ${caseId} ORDER BY created_at DESC LIMIT 50`,
    sql`SELECT * FROM deadlines WHERE case_id = ${caseId} ORDER BY date`,
    sql`SELECT * FROM financial_items WHERE case_id = ${caseId} ORDER BY date DESC, created_at DESC`,
  ]);

  return (
    <div className="space-y-6">
      <div>
        <a href="/dashboard" className="text-sm text-gray-400 hover:text-gray-600 mb-1 flex items-center gap-1 w-fit">
          <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10 4l-4 4 4 4"/></svg>
          All cases
        </a>
        <h1 className="text-2xl font-bold text-gray-900">{c.name as string}</h1>
        <p className="text-gray-500 text-sm mt-0.5">
          {(c.case_type as string).replace("_", " ")}
          {c.opposing_party ? " · vs. " + (c.opposing_party as string) : ""}
          {c.jurisdiction ? " · " + (c.jurisdiction as string) : ""}
        </p>
      </div>
      <CaseTabs
        caseId={caseId}
        caseType={c.case_type as string}
        timeline={timeline}
        evidence={evidence}
        documents={documents}
        tasks={tasks}
        captures={captures}
        deadlines={deadlines}
        finances={finances}
      />
    </div>
  );
}
