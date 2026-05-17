import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { verifyCase } from "@/lib/caseAuth";

export const dynamic  = "force-dynamic";
export const maxDuration = 60;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ caseId: string }> }
) {
  const { caseId } = await params;
  const userId = await verifyCase(caseId);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await request.formData();
  const file   = formData.get("file") as File | null;
  const sha256 = formData.get("sha256") as string | null;
  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

  const blob = await put(`cases/${caseId}/${file.name}`, file, {
    access: "private",
    allowOverwrite: true,
  });

  const existing = await sql`SELECT id FROM documents WHERE case_id = ${caseId} AND filename = ${file.name} LIMIT 1`;
  let row;
  if (existing.length > 0) {
    [row] = await sql`
      UPDATE documents
      SET blob_url = ${blob.url}, blob_pathname = ${blob.pathname},
          sha256 = ${sha256 ?? ""}, file_size = ${file.size},
          processed = false, processed_at = null
      WHERE id = ${existing[0].id}
      RETURNING *`;
  } else {
    [row] = await sql`
      INSERT INTO documents (case_id, filename, blob_url, blob_pathname, sha256, file_size)
      VALUES (${caseId}, ${file.name}, ${blob.url}, ${blob.pathname}, ${sha256 ?? ""}, ${file.size})
      RETURNING *`;
  }

  return NextResponse.json(row);
}
