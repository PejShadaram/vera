import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import sql from "@/lib/db";

export const dynamic = "force-dynamic";

// Ensure the user row exists (upsert on first call)
async function ensureUser(userId: string, email: string) {
  await sql`
    INSERT INTO users (id, email) VALUES (${userId}, ${email})
    ON CONFLICT (id) DO NOTHING
  `;
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const cases = await sql`SELECT * FROM cases WHERE user_id = ${userId} ORDER BY created_at DESC`;
  return NextResponse.json(cases);
}

export async function POST(request: Request) {
  const { userId, sessionClaims } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const email = (sessionClaims?.email as string) ?? "";
  await ensureUser(userId, email);

  const body = await request.json();
  const { name, case_type, opposing_party, jurisdiction, metadata } = body;

  if (!name || !case_type) {
    return NextResponse.json({ error: "name and case_type are required" }, { status: 400 });
  }

  const [newCase] = await sql`
    INSERT INTO cases (user_id, name, case_type, opposing_party, jurisdiction, metadata)
    VALUES (${userId}, ${name}, ${case_type}, ${opposing_party ?? ""}, ${jurisdiction ?? ""}, ${JSON.stringify(metadata ?? {})})
    RETURNING *
  `;

  return NextResponse.json(newCase, { status: 201 });
}
