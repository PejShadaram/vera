import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { verifyCase } from "@/lib/caseAuth";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params;
  if (!await verifyCase(caseId)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { date, event, source, highlight } = await request.json();
  const [row] = await sql`INSERT INTO timeline_entries (case_id, date, event, source, highlight) VALUES (${caseId}, ${date}, ${event}, ${source ?? ""}, ${highlight ?? false}) RETURNING *`;
  return NextResponse.json(row, { status: 201 });
}
