import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { verifyCase } from "@/lib/caseAuth";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, { params }: { params: Promise<{ caseId: string; taskId: string }> }) {
  const { caseId, taskId } = await params;
  if (!await verifyCase(caseId)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { col } = await request.json();
  const now = new Date().toISOString();
  const started_at   = col === "inprogress" ? now : col === "todo" ? null : undefined;
  const completed_at = col === "done" ? now : null;
  const [row] = await sql`UPDATE tasks SET col=${col}, started_at=COALESCE(${started_at ?? null}, started_at), completed_at=${completed_at} WHERE id=${taskId} AND case_id=${caseId} RETURNING *`;
  return NextResponse.json(row);
}
