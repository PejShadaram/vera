import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { verifyCase } from "@/lib/caseAuth";
import { invalidateAnalysisCache } from "@/lib/analysisCache";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params;
  if (!await verifyCase(caseId)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { label, date, priority, note } = await request.json();
  const [row] = await sql`INSERT INTO deadlines (case_id, label, date, priority, note) VALUES (${caseId}, ${label}, ${date}, ${priority ?? "medium"}, ${note ?? ""}) RETURNING *`;
  await invalidateAnalysisCache(caseId);
  return NextResponse.json(row, { status: 201 });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params;
  if (!await verifyCase(caseId)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id, completed } = await request.json();
  const [row] = await sql`UPDATE deadlines SET completed=${completed} WHERE id=${id} AND case_id=${caseId} RETURNING *`;
  return NextResponse.json(row);
}

export async function DELETE(request: Request, { params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params;
  if (!await verifyCase(caseId)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await request.json();
  await sql`DELETE FROM deadlines WHERE id = ${id} AND case_id = ${caseId}`;
  await invalidateAnalysisCache(caseId);
  return NextResponse.json({ ok: true });
}
