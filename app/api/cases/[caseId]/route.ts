import { NextResponse } from "next/server";
import { del } from "@vercel/blob";
import { auth } from "@clerk/nextjs/server";
import sql from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ caseId: string }> }
) {
  const { caseId } = await params;
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const [row] = await sql`SELECT * FROM cases WHERE id = ${caseId} AND user_id = ${userId}`;
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(row);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ caseId: string }> }
) {
  const { caseId } = await params;
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, opposing_party, jurisdiction, court_name, case_number, related_case_ids, hearing_date } = await request.json();
  const [row] = await sql`
    UPDATE cases SET
      name              = COALESCE(${name ?? null}, name),
      opposing_party    = COALESCE(${opposing_party ?? null}, opposing_party),
      jurisdiction      = COALESCE(${jurisdiction ?? null}, jurisdiction),
      court_name        = COALESCE(${court_name ?? null}, court_name),
      case_number       = COALESCE(${case_number ?? null}, case_number),
      hearing_date      = COALESCE(${hearing_date ?? null}, hearing_date),
      related_case_ids  = COALESCE(${related_case_ids ?? null}::uuid[], related_case_ids)
    WHERE id = ${caseId} AND user_id = ${userId}
    RETURNING *`;
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(row);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ caseId: string }> }
) {
  const { caseId } = await params;
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Confirm ownership before touching anything
  const [c] = await sql`SELECT id FROM cases WHERE id = ${caseId} AND user_id = ${userId}`;
  if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // 1. Collect every blob URL stored for this case
  const docs = await sql`SELECT blob_url FROM documents WHERE case_id = ${caseId} AND blob_url IS NOT NULL AND blob_url != ''`;
  const blobUrls = docs.map(d => d.blob_url as string).filter(Boolean);

  // 2. Delete all blobs from Vercel Blob storage
  if (blobUrls.length > 0) {
    try {
      await del(blobUrls);
    } catch (e) {
      console.error("[delete-case] blob deletion failed, retrying individually:", e);
      // Retry one-by-one — batch del can fail if any URL is malformed
      for (const url of blobUrls) {
        try { await del(url); } catch (e2) {
          console.error("[delete-case] could not delete blob:", url, e2);
        }
      }
    }
  }

  // 3. Nullify purchases.case_id (NO ACTION FK — preserve billing records)
  await sql`UPDATE purchases SET case_id = NULL WHERE case_id = ${caseId}`;

  // 4. Delete the case — all other tables cascade (documents, timeline_entries,
  //    evidence, tasks, notes, captures, deadlines, progress_steps, financial_items)
  await sql`DELETE FROM cases WHERE id = ${caseId} AND user_id = ${userId}`;

  return NextResponse.json({ ok: true });
}
