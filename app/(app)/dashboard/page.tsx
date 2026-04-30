import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import sql from "@/lib/db";

export const dynamic = "force-dynamic";

const TYPE_LABELS: Record<string, string> = {
  divorce: "Divorce", custody: "Child Custody", landlord_tenant: "Landlord / Tenant",
  employment: "Employment", small_claims: "Small Claims", other: "Other",
};
const TYPE_COLORS: Record<string, string> = {
  divorce: "bg-rose-50 text-rose-700 border-rose-200",
  custody: "bg-blue-50 text-blue-700 border-blue-200",
  landlord_tenant: "bg-amber-50 text-amber-700 border-amber-200",
  employment: "bg-purple-50 text-purple-700 border-purple-200",
  small_claims: "bg-green-50 text-green-700 border-green-200",
  other: "bg-gray-50 text-gray-600 border-gray-200",
};

export default async function DashboardPage() {
  let userId: string | null = null;
  let cases: Record<string, unknown>[] = [];

  try {
    const authResult = await auth();
    userId = authResult.userId;
    if (userId) {
      cases = await sql`SELECT * FROM cases WHERE user_id = ${userId} ORDER BY created_at DESC`;
    }
  } catch (e: unknown) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-2xl text-sm text-red-700">
        <p className="font-semibold mb-1">Server error — details:</p>
        <pre className="whitespace-pre-wrap text-xs">{String(e)}</pre>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Your Cases</h1>
          <p className="text-gray-500 mt-0.5 text-sm">Manage and track your legal matters.</p>
        </div>
        <Link href="/cases/new" className="bg-gray-900 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-gray-700 transition-colors">
          + New case
        </Link>
      </div>

      {cases.length === 0 ? (
        <div className="border-2 border-dashed border-gray-200 rounded-2xl p-16 text-center">
          <p className="text-4xl mb-4">⚖️</p>
          <p className="text-lg font-semibold text-gray-900 mb-1">No cases yet</p>
          <p className="text-gray-500 mb-6 text-sm">Start by creating your first case.</p>
          <Link href="/cases/new" className="bg-gray-900 text-white px-6 py-2.5 rounded-xl font-medium hover:bg-gray-700 transition-colors text-sm">
            + Start a new case
          </Link>
        </div>
      ) : (
        <div className="grid gap-3">
          {cases.map((c) => (
            <Link key={c.id as string} href={`/cases/${c.id}`}
              className="bg-white border border-gray-200 rounded-2xl p-5 hover:shadow-sm hover:border-gray-300 transition-all flex items-center gap-4 group">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-semibold text-gray-900 truncate">{c.name as string}</p>
                  <span className={`flex-shrink-0 text-[11px] font-medium px-2 py-0.5 rounded-full border ${TYPE_COLORS[c.case_type as string] ?? TYPE_COLORS.other}`}>
                    {TYPE_LABELS[c.case_type as string] ?? "Other"}
                  </span>
                </div>
                <p className="text-sm text-gray-400">
                  {c.opposing_party ? `vs. ${c.opposing_party as string}` : ""}
                  {c.jurisdiction ? ` · ${c.jurisdiction as string}` : ""}
                </p>
              </div>
              <svg className="h-4 w-4 text-gray-400 flex-shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M6 12l4-4-4-4"/>
              </svg>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
