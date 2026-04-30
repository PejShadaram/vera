import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
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
    const blob = await put(`cases/${caseId}/${file.name}`, file, { access: "private" });
    const [row] = await sql`INSERT INTO documents (case_id, filename, blob_url, blob_pathname) VALUES (${caseId}, ${file.name}, ${blob.url}, ${blob.pathname}) RETURNING *`;
    return NextResponse.json(row, { status: 201 });
  } catch (e: unknown) {
    console.error("[documents upload]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
