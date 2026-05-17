import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { verifyCase } from "@/lib/caseAuth";

export const dynamic = "force-dynamic";

async function invalidateAnalysis(caseId: string) {
  await sql`DELETE FROM notes WHERE case_id = ${caseId} AND key = '__vera_analysis__'`;
}

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
  await invalidateAnalysis(caseId);
  return NextResponse.json({ ok: true });
}
