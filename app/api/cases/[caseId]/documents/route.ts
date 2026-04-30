import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { createHash } from "crypto";
import sql from "@/lib/db";
import { verifyCase } from "@/lib/caseAuth";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params;
  if (!await verifyCase(caseId)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await request.formData();
  const file = form.get("file") as File;
  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

  try {
    // Read file bytes once — used for hash + upload
    const buf  = await file.arrayBuffer();
    const sha256 = createHash("sha256").update(Buffer.from(buf)).digest("hex");
    const size   = buf.byteLength;

    // Upload original bytes untouched — no modification of content, EXIF, or metadata
    const blob = await put(`cases/${caseId}/${file.name}`, new Blob([buf], { type: file.type }), { access: "private" });

    const [row] = await sql`INSERT INTO documents (case_id, filename, blob_url, blob_pathname, sha256, file_size)
      VALUES (${caseId}, ${file.name}, ${blob.url}, ${blob.pathname}, ${sha256}, ${size}) RETURNING *`;
    return NextResponse.json(row, { status: 201 });
  } catch (e: unknown) {
    console.error("[documents upload]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
