import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { verifyCase } from "@/lib/caseAuth";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params;
  if (!await verifyCase(caseId)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { category, description, amount, date, notes } = await request.json();
  const [row] = await sql`INSERT INTO financial_items (case_id, category, description, amount, date, notes)
    VALUES (${caseId}, ${category}, ${description}, ${amount ?? null}, ${date ?? ""}, ${notes ?? ""}) RETURNING *`;
  return NextResponse.json(row, { status: 201 });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params;
  if (!await verifyCase(caseId)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await request.json();
  await sql`DELETE FROM financial_items WHERE id = ${id} AND case_id = ${caseId}`;
  return NextResponse.json({ ok: true });
}
