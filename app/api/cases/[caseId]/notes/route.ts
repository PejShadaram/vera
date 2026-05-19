import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { verifyCase } from "@/lib/caseAuth";

export const dynamic = "force-dynamic";

const ALLOWED_KEYS = new Set([
  "__case_notes__",
  "__case_draft_police_statement__",
  "__case_draft_opposing_counsel__",
  "__case_draft_declaration__",
  "__case_draft_demand_letter__",
  "__case_draft_narrative__",
]);

export async function GET(
  request: Request,
  { params }: { params: Promise<{ caseId: string }> }
) {
  const { caseId } = await params;
  if (!await verifyCase(caseId)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const key = new URL(request.url).searchParams.get("key") ?? "__case_notes__";
  if (!ALLOWED_KEYS.has(key)) return NextResponse.json({ error: "Invalid key" }, { status: 400 });
  const [row] = await sql`SELECT content FROM notes WHERE case_id = ${caseId} AND key = ${key}`;
  return NextResponse.json({ content: row?.content ?? "" });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ caseId: string }> }
) {
  const { caseId } = await params;
  if (!await verifyCase(caseId)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { content, key: rawKey } = await request.json() as { content: string; key?: string };
  const key = rawKey ?? "__case_notes__";
  if (!ALLOWED_KEYS.has(key)) return NextResponse.json({ error: "Invalid key" }, { status: 400 });
  await sql`
    INSERT INTO notes (case_id, key, content) VALUES (${caseId}, ${key}, ${content})
    ON CONFLICT (case_id, key) DO UPDATE SET content = ${content}, updated_at = now()`;
  return NextResponse.json({ ok: true });
}
