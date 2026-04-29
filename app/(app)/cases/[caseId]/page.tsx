import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";
import sql from "@/lib/db";
import Link from "next/link";

export default async function CasePage({ params }: { params: Promise<{ caseId: string }> }) {
  const { userId } = await auth();
  const { caseId } = await params;

  const [caseData] = await sql`
    SELECT * FROM cases WHERE id = ${caseId} AND user_id = ${userId}
  `;
  if (!caseData) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <Link href="/dashboard" className="text-sm text-gray-400 hover:text-gray-600 mb-1 block">← All cases</Link>
          <h1 className="text-2xl font-bold text-gray-900">{caseData.name as string}</h1>
          <p className="text-gray-500 text-sm mt-0.5 capitalize">{(caseData.case_type as string).replace("_", " ")} · {caseData.jurisdiction as string}</p>
        </div>
      </div>

      {/* Placeholder tabs — we'll build these out next */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {["Timeline", "Evidence", "Documents", "Tasks", "Deadlines", "Calculator"].map(tab => (
          <div key={tab} className="bg-white border border-gray-200 rounded-2xl p-5 text-center">
            <p className="font-semibold text-gray-900">{tab}</p>
            <p className="text-xs text-gray-400 mt-1">Coming soon</p>
          </div>
        ))}
      </div>
    </div>
  );
}
