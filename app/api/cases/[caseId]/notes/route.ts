import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { verifyCase } from "@/lib/caseAuth";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ caseId: string }> }
) {
  const { caseId } = await params;
  if (!await verifyCase(caseId)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const [row] = await sql`SELECT content FROM notes WHERE case_id = ${caseId} AND key = '__case_notes__'`;
  return NextResponse.json({ content: row?.content ?? "" });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ caseId: string }> }
) {
  const { caseId } = await params;
  if (!await verifyCase(caseId)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { content } = await request.json();
  await sql`
    INSERT INTO notes (case_id, key, content) VALUES (${caseId}, '__case_notes__', ${content})
    ON CONFLICT (case_id, key) DO UPDATE SET content = ${content}, updated_at = now()`;
  return NextResponse.json({ ok: true });
}
