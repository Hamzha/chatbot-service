import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthenticatedUserId } from "@/lib/auth/requireApiPermission";
import { findUserById, updateUserBilling } from "@/lib/db/userRepo";
import { findSubscriptionPlanById } from "@/lib/db/subscriptionPlanRepo";
import { getAppBaseUrl, getStripe } from "@/lib/billing/stripe";

const bodySchema = z.object({
    planId: z.string().min(1),
});

export async function POST(request: Request) {
    const auth = await requireAuthenticatedUserId();
    if (auth instanceof NextResponse) return auth;

    let body: z.infer<typeof bodySchema>;
    try {
        body = bodySchema.parse(await request.json());
    } catch {
        return NextResponse.json({ error: "Invalid planId." }, { status: 400 });
    }

    const plan = await findSubscriptionPlanById(body.planId);
    if (!plan || !plan.active) {
        return NextResponse.json({ error: "Plan not found." }, { status: 404 });
    }
    if (plan.syncStatus !== "synced" || !plan.stripePriceId) {
        return NextResponse.json(
            { error: "Plan is not synced to Stripe yet. Ask an admin to sync it." },
            { status: 400 },
        );
    }

    const user = await findUserById(auth.userId);
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (user.subscriptionStatus === "active" && user.plan === plan.slug) {
        return NextResponse.json({ error: "You are already on this plan." }, { status: 409 });
    }

    try {
        const stripe = getStripe();
        const baseUrl = getAppBaseUrl();

        let customerId = user.stripeCustomerId ?? null;
        if (!customerId) {
            const customer = await stripe.customers.create({
                email: user.email,
                name: user.name,
                metadata: { userId: user.id },
            });
            customerId = customer.id;
            await updateUserBilling(user.id, { stripeCustomerId: customerId });
        }

        const session = await stripe.checkout.sessions.create({
            mode: "subscription",
            customer: customerId,
            client_reference_id: user.id,
            line_items: [{ price: plan.stripePriceId, quantity: 1 }],
            success_url: `${baseUrl}/dashboard?billing=success`,
            cancel_url: `${baseUrl}/dashboard?billing=canceled`,
            metadata: {
                userId: user.id,
                planId: plan.id,
                planSlug: plan.slug,
            },
            subscription_data: {
                metadata: {
                    userId: user.id,
                    planId: plan.id,
                    planSlug: plan.slug,
                },
            },
            allow_promotion_codes: true,
        });

        if (!session.url) {
            return NextResponse.json({ error: "Failed to create checkout session." }, { status: 500 });
        }

        return NextResponse.json({ url: session.url, sessionId: session.id });
    } catch (error) {
        console.error("[billing/checkout]", error);
        const message = error instanceof Error ? error.message : "Checkout failed.";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
