import sql from "@/lib/db";
import { verifyCase } from "@/lib/caseAuth";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ caseId: string; docId: string }> }
) {
  const { caseId, docId } = await params;
  if (!await verifyCase(caseId)) return new Response("Unauthorized", { status: 401 });

  const [doc] = await sql`SELECT blob_url, filename FROM documents WHERE id = ${docId} AND case_id = ${caseId}`;
  if (!doc) return new Response("Not found", { status: 404 });

  const res = await fetch(doc.blob_url as string, {
    headers: { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` },
  });

  const isPdf = (doc.filename as string).toLowerCase().endsWith(".pdf");
  return new Response(res.body, {
    headers: {
      "Content-Type": isPdf ? "application/pdf" : (res.headers.get("Content-Type") ?? "application/octet-stream"),
      "Content-Disposition": `inline; filename="${doc.filename}"`,
    },
  });
}
