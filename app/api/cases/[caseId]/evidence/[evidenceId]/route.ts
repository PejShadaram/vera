import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { verifyCase } from "@/lib/caseAuth";
import { invalidateAnalysisCache } from "@/lib/analysisCache";

export const dynamic = "force-dynamic";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ caseId: string; evidenceId: string }> }
) {
  const { caseId, evidenceId } = await params;
  if (!await verifyCase(caseId)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await sql`DELETE FROM evidence WHERE id = ${evidenceId} AND case_id = ${caseId}`;
  await invalidateAnalysisCache(caseId);
  return NextResponse.json({ ok: true });
}
