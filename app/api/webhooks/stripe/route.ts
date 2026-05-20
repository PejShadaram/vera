import { NextResponse } from "next/server";
import Stripe from "stripe";
import sql from "@/lib/db";
import { sendEmail, buildUnlockConfirmationEmail, buildBundleConfirmationEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

// Minimum legitimate price thresholds (cents). Any session below these is rejected
// to prevent fabricated-revenue events (discounted/free sessions, malformed payloads).
const MIN_SINGLE_UNLOCK_CENTS = 4900;
const MIN_BUNDLE_CENTS = 7900;

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

    // Strict amount validation — never fall back to a hardcoded value. A null/undefined
    // amount_total indicates a malformed event and must not produce a purchase record.
    const amountCents = session.amount_total;
    if (typeof amountCents !== "number" || !Number.isInteger(amountCents) || amountCents <= 0) {
      console.error("[stripe/webhook] malformed amount_total:", amountCents, session.id);
      return NextResponse.json({ received: true });
    }

    // Ensure user row exists before FK insert
    await sql`
      INSERT INTO users (id, email) VALUES (${userId}, ${customerEmail ?? `${userId}@vera-user.local`})
      ON CONFLICT (id) DO NOTHING`;

    const isBundlePurchase = session.metadata?.type === "bundle";

    if (isBundlePurchase) {
      if (amountCents < MIN_BUNDLE_CENTS) {
        console.error("[stripe/webhook] bundle amount below minimum:", amountCents, session.id);
        return NextResponse.json({ received: true }); // 200 so Stripe doesn't retry an intentionally discounted price
      }
      // Bundle: insert N credits with case_id=NULL — applied lazily when user unlocks a case
      const qty = Number(session.metadata?.qty ?? 2);
      const perCredit = Math.round(amountCents / qty);
      let inserted = 0;
      for (let i = 0; i < qty; i++) {
        const rows = await sql`
          INSERT INTO purchases (id, user_id, case_id, stripe_session_id, stripe_customer_id, tier, amount_cents)
          VALUES (
            gen_random_uuid(), ${userId}, NULL,
            ${i === 0 ? session.id : session.id + `_${i}`},
            ${customerId}, 'case_unlock', ${perCredit}
          )
          ON CONFLICT (stripe_session_id) DO NOTHING
          RETURNING id`;
        if (rows.length > 0) inserted++;
      }
      // Send confirmation email only on first successful insert (not duplicate webhooks).
      // Use the Clerk account email (users table) rather than Stripe billing email so
      // the confirmation lands in the user's actual account inbox.
      if (inserted > 0) {
        const [userRow] = await sql`SELECT email FROM users WHERE id = ${userId} LIMIT 1`;
        const toEmail = (userRow?.email as string) || customerEmail;
        if (toEmail) {
          void sendEmail(
            toEmail,
            `Your ${qty}-case bundle is ready — Vera`,
            buildBundleConfirmationEmail(qty)
          );
        }
      }
    } else {
      // Single case unlock
      const caseId = session.metadata?.caseId;
      if (!caseId) return NextResponse.json({ received: true });

      if (amountCents < MIN_SINGLE_UNLOCK_CENTS) {
        console.error("[stripe/webhook] amount below minimum:", amountCents, session.id);
        return NextResponse.json({ received: true }); // 200 so Stripe doesn't retry an intentionally discounted price
      }

      const [caseRow] = await sql`SELECT id, name FROM cases WHERE id = ${caseId}::uuid AND user_id = ${userId}`;
      if (!caseRow) return NextResponse.json({ received: true });

      const inserted = await sql`
        INSERT INTO purchases (id, user_id, case_id, stripe_session_id, stripe_customer_id, tier, amount_cents)
        VALUES (
          gen_random_uuid(), ${userId}, ${caseId}::uuid, ${session.id},
          ${customerId}, 'case_unlock', ${amountCents}
        )
        ON CONFLICT (stripe_session_id) DO NOTHING
        RETURNING id`;

      if (inserted.length > 0) {
        const [userRow] = await sql`SELECT email FROM users WHERE id = ${userId} LIMIT 1`;
        const toEmail = (userRow?.email as string) || customerEmail;
        if (toEmail) {
          void sendEmail(
            toEmail,
            `You're unlocked — ${caseRow.name}`,
            buildUnlockConfirmationEmail(caseId, caseRow.name as string)
          );
        }
      }
    }
  }

  return NextResponse.json({ received: true });
}
