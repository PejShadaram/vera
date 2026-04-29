import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { verifyCase } from "@/lib/caseAuth";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params;
  if (!await verifyCase(caseId)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { title, description, priority } = await request.json();
  const [row] = await sql`INSERT INTO tasks (case_id, title, description, priority) VALUES (${caseId}, ${title}, ${description ?? ""}, ${priority ?? "medium"}) RETURNING *`;
  return NextResponse.json(row, { status: 201 });
}
