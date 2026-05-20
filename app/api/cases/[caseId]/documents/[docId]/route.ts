import { del } from "@vercel/blob";
import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { verifyCase } from "@/lib/caseAuth";
import { invalidateAnalysisCache } from "@/lib/analysisCache";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ caseId: string; docId: string }> }
) {
  const { caseId, docId } = await params;
  if (!await verifyCase(caseId)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json() as { is_opposing?: boolean; is_court_form?: boolean };
  if (body.is_opposing !== undefined)   await sql`UPDATE documents SET is_opposing   = ${!!body.is_opposing}   WHERE id = ${docId} AND case_id = ${caseId}`;
  if (body.is_court_form !== undefined) await sql`UPDATE documents SET is_court_form = ${!!body.is_court_form} WHERE id = ${docId} AND case_id = ${caseId}`;
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ caseId: string; docId: string }> }
) {
  const { caseId, docId } = await params;
  if (!await verifyCase(caseId)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const [doc] = await sql`SELECT blob_url FROM documents WHERE id=${docId} AND case_id=${caseId}`;
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  try {
    await del(doc.blob_url as string);
  } catch (e2) {
    // Never log the blob URL — it functions as a capability token for the file.
    console.error("[delete-case] blob deletion failed:", { caseId, error: (e2 as Error).message });
  }
  await sql`DELETE FROM documents WHERE id=${docId} AND case_id=${caseId}`;
  await invalidateAnalysisCache(caseId);
  return NextResponse.json({ ok: true });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ caseId: string; docId: string }> }
) {
  const { caseId, docId } = await params;
  const userId = await verifyCase(caseId);
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const [doc] = await sql`SELECT blob_url, filename FROM documents WHERE id = ${docId} AND case_id = ${caseId}`;
  if (!doc) return new Response("Not found", { status: 404 });

  const blobUrl = doc.blob_url as string;
  const { hostname } = new URL(blobUrl);
  if (!hostname.endsWith(".vercel-storage.com")) return new Response("Invalid blob", { status: 400 });
  const res = await fetch(blobUrl, {
    headers: { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` },
    cache: "no-store",
  });

  // Best-effort access log — never block the response on logging failure
  await sql`INSERT INTO events (user_id, case_id, event) VALUES (${userId}, ${caseId}, ${'doc_view:' + docId})`.catch(() => {});

  const isPdf = (doc.filename as string).toLowerCase().endsWith(".pdf");
  const safeFilename = (doc.filename as string).replace(/["\r\n\\]/g, "");
  return new Response(res.body, {
    headers: {
      "Content-Type": isPdf ? "application/pdf" : (res.headers.get("Content-Type") ?? "application/octet-stream"),
      "Content-Disposition": `inline; filename="${safeFilename}"`,
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    },
  });
}
