import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import sql from "@/lib/db";

// Bundle: 2 AI case unlocks for $79 (save $19)
const BUNDLE_AMOUNT = 7900;
const BUNDLE_QTY    = 2;

export async function POST(req: Request) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const clerk    = await clerkClient();
  const clerkUser = await clerk.users.getUser(userId);
  const email    = clerkUser.emailAddresses?.[0]?.emailAddress || undefined;

  const existing = await sql`SELECT stripe_customer_id FROM purchases WHERE user_id = ${userId} AND stripe_customer_id IS NOT NULL LIMIT 1`;
  let customerId = existing[0]?.stripe_customer_id as string | undefined;
  if (!customerId) {
    const customer = await stripe.customers.create({ email, metadata: { userId } });
    customerId = customer.id;
  } else if (email) {
    await stripe.customers.update(customerId, { email }).catch(() => {});
  }

  const origin = req.headers.get("origin") ?? "https://veracase.app";

  const session = await stripe.checkout.sessions.create({
    customer:   customerId,
    mode:       "payment",
    line_items: [{
      quantity:   1,
      price_data: {
        currency:     "usd",
        unit_amount:  BUNDLE_AMOUNT,
        product_data: {
          name:        "Vera — 2-Case AI Bundle",
          description: `Unlock AI on any 2 cases — document processing, analysis, drafts, and chat. Use on any cases, now or later.`,
        },
      },
    }],
    success_url: `${origin}/dashboard?bundle_success=1`,
    cancel_url:  `${origin}/pricing`,
    metadata:    { userId, type: "bundle", qty: String(BUNDLE_QTY) },
  });

  return NextResponse.json({ url: session.url });
}
