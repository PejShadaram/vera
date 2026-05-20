import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { verifyCase } from "@/lib/caseAuth";
import { invalidateAnalysisCache } from "@/lib/analysisCache";

export const dynamic = "force-dynamic";

function isValidBlobUrl(url: string, caseId: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return false;
    if (!u.hostname.endsWith(".vercel-storage.com")) return false;
    // Must live under this case's namespace
    if (!u.pathname.startsWith(`/cases/${caseId}/`)) return false;
    return true;
  } catch { return false; }
}

export async function POST(request: Request, { params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params;
  if (!await verifyCase(caseId)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { filename, blob_url, blob_pathname, sha256, file_size } = await request.json();
  if (!filename || !blob_url) return NextResponse.json({ error: "Missing filename or blob_url" }, { status: 400 });
  if (!isValidBlobUrl(blob_url, caseId)) return NextResponse.json({ error: "Invalid blob URL" }, { status: 400 });
  if (blob_pathname !== undefined && blob_pathname !== null && blob_pathname !== "" &&
      !String(blob_pathname).startsWith(`cases/${caseId}/`)) {
    return NextResponse.json({ error: "Invalid blob pathname" }, { status: 400 });
  }

  // Upsert: if a document with this filename already exists for the case,
  // overwrite its blob reference and reset processed so it queues for reprocessing.
  const existing = await sql`SELECT id FROM documents WHERE case_id = ${caseId} AND filename = ${filename} LIMIT 1`;

  let row;
  if (existing.length > 0) {
    [row] = await sql`
      UPDATE documents
      SET blob_url = ${blob_url}, blob_pathname = ${blob_pathname ?? ""},
          sha256 = ${sha256 ?? ""}, file_size = ${file_size ?? 0},
          processed = false, processed_at = null
      WHERE id = ${existing[0].id}
      RETURNING id, case_id, filename, sha256, file_size, is_opposing, is_court_form,
                processed, processed_at, processing_error, uploaded_at, created_at`;
  } else {
    [row] = await sql`
      INSERT INTO documents (case_id, filename, blob_url, blob_pathname, sha256, file_size)
      VALUES (${caseId}, ${filename}, ${blob_url}, ${blob_pathname ?? ""}, ${sha256 ?? ""}, ${file_size ?? 0})
      RETURNING id, case_id, filename, sha256, file_size, is_opposing, is_court_form,
                processed, processed_at, processing_error, uploaded_at, created_at`;
  }

  await invalidateAnalysisCache(caseId);
  return NextResponse.json(row, { status: 200 });
}
