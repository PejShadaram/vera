import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { verifyCase } from "@/lib/caseAuth";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params;
  if (!await verifyCase(caseId)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { content } = await request.json();
  const [row] = await sql`INSERT INTO captures (case_id, content) VALUES (${caseId}, ${content}) RETURNING *`;
  return NextResponse.json(row, { status: 201 });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params;
  if (!await verifyCase(caseId)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await request.json();
  await sql`DELETE FROM captures WHERE id=${id} AND case_id=${caseId}`;
  return NextResponse.json({ ok: true });
}
