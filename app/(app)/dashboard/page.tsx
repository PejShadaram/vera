import { auth } from "@clerk/nextjs/server";
import Link from "next/link";

export default async function DashboardPage() {
  await auth();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Your Cases</h1>
        <p className="text-gray-500 mt-1">Manage and track your legal matters.</p>
      </div>

      <div className="border-2 border-dashed border-gray-200 rounded-2xl p-12 text-center">
        <p className="text-lg font-medium text-gray-900 mb-1">No cases yet</p>
        <p className="text-gray-500 mb-6">Start by creating your first case. Vera will help you organize everything.</p>
        <Link href="/cases/new" className="bg-gray-900 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-gray-700 transition-colors text-sm">
          + Start a new case
        </Link>
      </div>
    </div>
  );
}
