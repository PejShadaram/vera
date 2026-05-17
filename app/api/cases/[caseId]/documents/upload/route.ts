import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { del } from "@vercel/blob";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import sql from "@/lib/db";
import { verifyCase } from "@/lib/caseAuth";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ caseId: string }> }
) {
  const { caseId } = await params;
  const { userId }  = await auth();
  if (!userId || !await verifyCase(caseId)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as HandleUploadBody;

  const jsonResponse = await handleUpload({
    body,
    request,
    onBeforeGenerateToken: async (pathname) => {
      const fullPath = `cases/${caseId}/${pathname}`;

      // If a blob already exists at this path, delete it so the upload succeeds cleanly
      const existing = await sql`SELECT blob_url FROM documents WHERE case_id = ${caseId} AND filename = ${pathname} LIMIT 1`;
      if (existing.length > 0 && existing[0].blob_url) {
        try { await del(existing[0].blob_url as string); } catch { /* already gone */ }
      }

      return {
        pathname:     fullPath,
        access:       "private" as const,
        tokenPayload: JSON.stringify({ caseId, userId }),
      };
    },
    onUploadCompleted: async ({ blob, tokenPayload }) => {
      const { caseId: cId } = JSON.parse(tokenPayload ?? "{}") as { caseId: string };
      const filename = blob.pathname.split("/").pop() ?? blob.pathname;
      const existing = await sql`SELECT id FROM documents WHERE case_id = ${cId} AND filename = ${filename} LIMIT 1`;
      if (existing.length > 0) {
        await sql`UPDATE documents SET blob_url = ${blob.url}, blob_pathname = ${blob.pathname},
          processed = false, processed_at = null WHERE id = ${existing[0].id}`;
      } else {
        await sql`INSERT INTO documents (case_id, filename, blob_url, blob_pathname)
          VALUES (${cId}, ${filename}, ${blob.url}, ${blob.pathname})`;
      }
    },
  });

  return NextResponse.json(jsonResponse);
}
