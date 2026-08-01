import { NextResponse } from "next/server";
import { dispatchStripeEvent } from "@/lib/billing/webhookHandlers";
import { getStripe, getStripeWebhookSecret } from "@/lib/billing/stripe";

export const runtime = "nodejs";

export async function POST(request: Request) {
    const signature = request.headers.get("stripe-signature");
    if (!signature) {
        return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });
    }

    const rawBody = await request.text();

    try {
        const stripe = getStripe();
        const event = stripe.webhooks.constructEvent(rawBody, signature, getStripeWebhookSecret());
        await dispatchStripeEvent(event);
        return NextResponse.json({ received: true });
    } catch (error) {
        console.error("[billing/webhook]", error);
        const message = error instanceof Error ? error.message : "Webhook error";
        return NextResponse.json({ error: message }, { status: 400 });
    }
}
