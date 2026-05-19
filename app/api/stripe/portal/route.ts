import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import sql from "@/lib/db";

export async function POST(req: Request) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const row = await sql`SELECT stripe_customer_id FROM purchases WHERE user_id = ${userId} AND stripe_customer_id IS NOT NULL LIMIT 1`;
  if (!row[0]?.stripe_customer_id) return NextResponse.json({ error: "No billing record found" }, { status: 404 });

  const origin = req.headers.get("origin") ?? "https://veracase.app";
  const session = await stripe.billingPortal.sessions.create({
    customer:   row[0].stripe_customer_id as string,
    return_url: `${origin}/dashboard`,
  });

  return NextResponse.json({ url: session.url });
}
