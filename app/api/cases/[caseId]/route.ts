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

  const body = await request.json() as Record<string, unknown>;
  const { name, opposing_party, jurisdiction, court_name, case_number, related_case_ids, hearing_date, status, petitioner_name } = body;
  const validStatus = ["active", "closed", "on_hold"].includes(status as string ?? "") ? status as string : null;

  // Validate related_case_ids belong to this user before writing
  let safeRelatedIds: string[] | null = null;
  if (Array.isArray(related_case_ids) && related_case_ids.length > 0) {
    const owned = await sql`SELECT id FROM cases WHERE id = ANY(${related_case_ids as string[]}::uuid[]) AND user_id = ${userId}`;
    safeRelatedIds = owned.map(r => r.id as string);
  } else if (related_case_ids !== undefined) {
    safeRelatedIds = [];
  }

  // Use explicit SET only for fields present in the body — allows clearing to null
  const has = (k: string) => Object.hasOwn(body, k);
  const [row] = await sql`
    UPDATE cases SET
      name              = ${has("name")             ? (name ?? null)                      : sql`name`},
      opposing_party    = ${has("opposing_party")   ? (opposing_party ?? null)            : sql`opposing_party`},
      jurisdiction      = ${has("jurisdiction")     ? (jurisdiction ?? null)              : sql`jurisdiction`},
      court_name        = ${has("court_name")       ? (court_name ?? null)                : sql`court_name`},
      case_number       = ${has("case_number")      ? (case_number ?? null)               : sql`case_number`},
      hearing_date      = ${has("hearing_date")     ? (hearing_date ?? null)              : sql`hearing_date`},
      related_case_ids  = ${safeRelatedIds !== null ? sql`${safeRelatedIds}::uuid[]`      : sql`related_case_ids`},
      status            = ${validStatus             ? validStatus                         : sql`status`},
      petitioner_name   = ${has("petitioner_name")  ? (petitioner_name ?? null)           : sql`petitioner_name`}
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
