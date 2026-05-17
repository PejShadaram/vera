import { NextResponse } from "next/server";
import Stripe from "stripe";
import sql from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  const body = await req.text();
  const sig  = req.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "No signature" }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId  = session.metadata?.userId;
    const caseId  = session.metadata?.caseId;
    if (!userId || !caseId || session.mode !== "payment") return NextResponse.json({ received: true });

    await sql`
      INSERT INTO purchases (id, user_id, case_id, stripe_session_id, stripe_customer_id, tier, amount_cents)
      VALUES (
        gen_random_uuid(), ${userId}, ${caseId}::uuid, ${session.id},
        ${session.customer as string}, 'case_unlock', ${session.amount_total ?? 4900}
      )
      ON CONFLICT (stripe_session_id) DO NOTHING`;
  }

  return NextResponse.json({ received: true });
}
