import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { verifyCase } from "@/lib/caseAuth";

export const dynamic = "force-dynamic";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ caseId: string; evidenceId: string }> }
) {
  const { caseId, evidenceId } = await params;
  if (!await verifyCase(caseId)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await sql`DELETE FROM evidence WHERE id = ${evidenceId} AND case_id = ${caseId}`;
  await sql`DELETE FROM notes WHERE case_id = ${caseId} AND key = '__vera_analysis__'`;
  return NextResponse.json({ ok: true });
}
