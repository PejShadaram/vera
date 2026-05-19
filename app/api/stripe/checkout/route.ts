import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import sql from "@/lib/db";
import { trackEvent } from "@/lib/trackEvent";

export async function POST(req: Request) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { caseId } = await req.json();
  if (!caseId) return NextResponse.json({ error: "Missing caseId" }, { status: 400 });

  // Verify the case belongs to this user
  const [c] = await sql`SELECT id, name FROM cases WHERE id = ${caseId} AND user_id = ${userId}`;
  if (!c) return NextResponse.json({ error: "Case not found" }, { status: 404 });

  // Auto-apply an unassigned bundle credit if one exists — no Stripe needed
  const [credit] = await sql`
    UPDATE purchases SET case_id = ${caseId}::uuid
    WHERE id = (
      SELECT id FROM purchases
      WHERE user_id = ${userId} AND tier = 'case_unlock' AND case_id IS NULL
      ORDER BY created_at ASC LIMIT 1
    ) AND case_id IS NULL
    RETURNING id`;
  if (credit) {
    void trackEvent(userId, "bundle_credit_applied", caseId);
    const origin = req.headers.get("origin") ?? "https://veracase.app";
    return NextResponse.json({ url: `${origin}/cases/${caseId}?unlocked=1` });
  }

  // Always fetch email from Clerk (sessionClaims may not include it)
  const clerk = await clerkClient();
  const clerkUser = await clerk.users.getUser(userId);
  const email = clerkUser.emailAddresses?.[0]?.emailAddress || undefined;

  // Reuse existing Stripe customer if available, updating email in case it changed
  const existing = await sql`SELECT stripe_customer_id FROM purchases WHERE user_id = ${userId} AND stripe_customer_id IS NOT NULL LIMIT 1`;
  let customerId = existing[0]?.stripe_customer_id as string | undefined;

  if (!customerId) {
    const customer = await stripe.customers.create({ email, metadata: { userId } });
    customerId = customer.id;
  } else if (email) {
    // Keep Stripe customer email in sync in case user changed their email
    await stripe.customers.update(customerId, { email }).catch(() => {});
  }

  const origin = req.headers.get("origin") ?? "https://veracase.app";

  const session = await stripe.checkout.sessions.create({
    customer:    customerId,
    mode:        "payment",
    line_items:  [{
      quantity:   1,
      price_data: {
        currency:     "usd",
        unit_amount:  4900,
        product_data: {
          name:        "Vera — AI Case Unlock",
          description: `Unlimited AI on "${c.name as string}" — document processing, case analysis, drafts, and chat. Yours forever.`,
        },
      },
    }],
    success_url: `${origin}/cases/${caseId}?unlocked=1`,
    cancel_url:  `${origin}/cases/${caseId}`,
    metadata:    { userId, caseId },
  });

  void trackEvent(userId, "checkout_started", caseId);
  return NextResponse.json({ url: session.url });
}
