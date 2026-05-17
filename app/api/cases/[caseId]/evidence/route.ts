import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { verifyCase } from "@/lib/caseAuth";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ caseId: string }> }
) {
  const { caseId } = await params;
  if (!await verifyCase(caseId)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { title, source_type, summary } = await req.json();
  if (!title?.trim()) return NextResponse.json({ error: "Title required" }, { status: 400 });

  const [row] = await sql`
    WITH next_ref AS (
      SELECT COALESCE(MAX(CAST(SUBSTRING(ref FROM 3) AS INTEGER)), 0) + 1 AS num
      FROM evidence WHERE case_id = ${caseId}
    )
    INSERT INTO evidence (case_id, ref, title, source_type, summary)
    SELECT ${caseId}, 'E-' || LPAD(num::text, 3, '0'), ${title.trim()}, ${source_type ?? ""}, ${summary?.trim() ?? ""}
    FROM next_ref
    RETURNING *`;

  await sql`DELETE FROM notes WHERE case_id = ${caseId} AND key = '__vera_analysis__'`;
  return NextResponse.json(row);
}
