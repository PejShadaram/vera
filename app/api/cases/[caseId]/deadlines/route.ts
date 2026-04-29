import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { verifyCase } from "@/lib/caseAuth";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params;
  if (!await verifyCase(caseId)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { label, date, priority, note } = await request.json();
  const [row] = await sql`INSERT INTO deadlines (case_id, label, date, priority, note) VALUES (${caseId}, ${label}, ${date}, ${priority ?? "medium"}, ${note ?? ""}) RETURNING *`;
  return NextResponse.json(row, { status: 201 });
}
