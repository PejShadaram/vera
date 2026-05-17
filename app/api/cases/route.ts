import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import sql from "@/lib/db";
import { sendEmail, buildWelcomeEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

async function ensureUser(userId: string) {
  const clerk = await clerkClient();
  const clerkUser = await clerk.users.getUser(userId);
  const email = clerkUser.emailAddresses?.[0]?.emailAddress ?? `${userId}@vera-user.local`;

  // Remove any orphaned record with the same email but a different Clerk ID.
  // This happens when the same person signed in during dev/keyless mode and
  // was assigned a temporary Clerk ID, then later signed in on production Clerk
  // and received a different permanent ID.
  await sql`DELETE FROM users WHERE email = ${email} AND id != ${userId}`;

  await sql`
    INSERT INTO users (id, email) VALUES (${userId}, ${email})
    ON CONFLICT (id) DO UPDATE SET email = ${email}`;
}

const STARTER_TASKS: Record<string, string[]> = {
  divorce: [
    "Gather bank and financial statements (past 3 years)",
    "List all marital assets and their estimated value",
    "List all shared debts and liabilities",
    "Document every communication with the opposing party",
  ],
  custody: [
    "Log every custody exchange — date, time, and any issues",
    "Document any violations of current custody arrangements",
    "Save every communication about the children",
    "Note any incidents that may affect the children's wellbeing",
  ],
  landlord_tenant: [
    "Photograph the full property and document its condition",
    "Review lease terms and highlight any violations",
    "Save every communication with your landlord or tenant",
    "Research your rights under your state's landlord-tenant laws",
  ],
  employment: [
    "Preserve all emails, messages, and workplace communications",
    "Gather performance reviews, warnings, and written records",
    "Write a detailed incident timeline while memory is fresh",
    "Identify any witnesses to key events",
  ],
  small_claims: [
    "Gather all contracts, receipts, and payment records",
    "Document all attempts to resolve this before going to court",
    "Research the small claims limit and filing fees in your state",
    "Calculate the exact amount owed including any interest",
  ],
  other: [
    "Write a detailed description of what happened",
    "Gather all relevant documents and communications",
    "Build a chronological timeline of key events",
    "Research your legal rights and options in your state",
  ],
};

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const cases = await sql`SELECT * FROM cases WHERE user_id = ${userId} ORDER BY created_at DESC`;
  return NextResponse.json(cases);
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await ensureUser(userId);

  const { name, case_type, opposing_party, jurisdiction, metadata } = await request.json();
  if (!name || !case_type) return NextResponse.json({ error: "name and case_type are required" }, { status: 400 });

  const [newCase] = await sql`
    INSERT INTO cases (user_id, name, case_type, opposing_party, jurisdiction, metadata)
    VALUES (${userId}, ${name}, ${case_type}, ${opposing_party ?? ""}, ${jurisdiction ?? ""}, ${JSON.stringify(metadata ?? {})})
    RETURNING *`;

  // Seed starter tasks for this case type
  const tasks = STARTER_TASKS[case_type] ?? STARTER_TASKS.other;
  await Promise.all(
    tasks.map(title =>
      sql`INSERT INTO tasks (case_id, title, priority, col) VALUES (${newCase.id}, ${title}, ${"medium"}, ${"todo"})`
    )
  );

  // Welcome email — only on the user's first case
  const [{ count: caseCount }] = await sql`
    SELECT COUNT(*) AS count FROM cases WHERE user_id = ${userId}`;
  if (Number(caseCount) === 1) {
    const [user] = await sql`SELECT email FROM users WHERE id = ${userId}`;
    if (user?.email) {
      void sendEmail(
        user.email as string,
        "Your case is set up — here's what to do first",
        buildWelcomeEmail(newCase.id as string)
      );
    }
  }

  return NextResponse.json(newCase, { status: 201 });
}
