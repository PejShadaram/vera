import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { verifyCase } from "@/lib/caseAuth";
import { invalidateAnalysisCache } from "@/lib/analysisCache";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ caseId: string; entryId: string }> }
) {
  const { caseId, entryId } = await params;
  if (!await verifyCase(caseId)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { note } = await request.json();
  const [row] = await sql`
    UPDATE timeline_entries SET note = ${note ?? ""}
    WHERE id = ${entryId} AND case_id = ${caseId}
    RETURNING *`;
  return NextResponse.json(row);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ caseId: string; entryId: string }> }
) {
  const { caseId, entryId } = await params;
  if (!await verifyCase(caseId)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await sql`DELETE FROM timeline_entries WHERE id = ${entryId} AND case_id = ${caseId}`;
  await invalidateAnalysisCache(caseId);
  return NextResponse.json({ ok: true });
}
