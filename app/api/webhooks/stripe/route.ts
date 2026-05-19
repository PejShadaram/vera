import { NextResponse } from "next/server";
import Stripe from "stripe";
import sql from "@/lib/db";
import { sendEmail, buildUnlockConfirmationEmail, buildBundleConfirmationEmail } from "@/lib/email";

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
    if (!userId || session.mode !== "payment") return NextResponse.json({ received: true });
    if (session.payment_status !== "paid")      return NextResponse.json({ received: true });

    const customerEmail = session.customer_details?.email;
    const customerId    = typeof session.customer === "string" ? session.customer : null;

    // Ensure user row exists before FK insert
    await sql`
      INSERT INTO users (id, email) VALUES (${userId}, ${customerEmail ?? `${userId}@vera-user.local`})
      ON CONFLICT (id) DO NOTHING`;

    const isBundlePurchase = session.metadata?.type === "bundle";

    if (isBundlePurchase) {
      // Bundle: insert N credits with case_id=NULL — applied lazily when user unlocks a case
      const qty = Number(session.metadata?.qty ?? 2);
      let inserted = 0;
      for (let i = 0; i < qty; i++) {
        const rows = await sql`
          INSERT INTO purchases (id, user_id, case_id, stripe_session_id, stripe_customer_id, tier, amount_cents)
          VALUES (
            gen_random_uuid(), ${userId}, NULL,
            ${i === 0 ? session.id : session.id + `_${i}`},
            ${customerId}, 'case_unlock', ${Math.round((session.amount_total ?? 7900) / qty)}
          )
          ON CONFLICT (stripe_session_id) DO NOTHING
          RETURNING id`;
        if (rows.length > 0) inserted++;
      }
      // Send confirmation email only on first successful insert (not duplicate webhooks)
      if (inserted > 0 && customerEmail) {
        void sendEmail(
          customerEmail,
          `Your ${qty}-case bundle is ready — Vera`,
          buildBundleConfirmationEmail(qty)
        );
      }
    } else {
      // Single case unlock
      const caseId = session.metadata?.caseId;
      if (!caseId) return NextResponse.json({ received: true });

      const [caseRow] = await sql`SELECT id, name FROM cases WHERE id = ${caseId}::uuid AND user_id = ${userId}`;
      if (!caseRow) return NextResponse.json({ received: true });

      const inserted = await sql`
        INSERT INTO purchases (id, user_id, case_id, stripe_session_id, stripe_customer_id, tier, amount_cents)
        VALUES (
          gen_random_uuid(), ${userId}, ${caseId}::uuid, ${session.id},
          ${customerId}, 'case_unlock', ${session.amount_total ?? 4900}
        )
        ON CONFLICT (stripe_session_id) DO NOTHING
        RETURNING id`;

      if (inserted.length > 0) {
        const [row] = await sql`
          SELECT u.email, c.name AS case_name
          FROM users u JOIN cases c ON c.id = ${caseId}::uuid
          WHERE u.id = ${userId}`;
        if (row?.email) {
          void sendEmail(
            row.email as string,
            `You're unlocked — ${row.case_name}`,
            buildUnlockConfirmationEmail(caseId, row.case_name as string)
          );
        }
      }
    }
  }

  return NextResponse.json({ received: true });
}
