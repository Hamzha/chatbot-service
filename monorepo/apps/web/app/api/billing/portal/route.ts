import { NextResponse } from "next/server";
import { requireAuthenticatedUserId } from "@/lib/auth/requireApiPermission";
import { findUserById } from "@/lib/db/userRepo";
import { getAppBaseUrl, getStripe } from "@/lib/billing/stripe";

export async function POST() {
    const auth = await requireAuthenticatedUserId();
    if (auth instanceof NextResponse) return auth;

    const user = await findUserById(auth.userId);
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!user.stripeCustomerId) {
        return NextResponse.json(
            { error: "No billing customer yet. Start a subscription first." },
            { status: 400 },
        );
    }

    try {
        const stripe = getStripe();
        const baseUrl = getAppBaseUrl();
        const portal = await stripe.billingPortal.sessions.create({
            customer: user.stripeCustomerId,
            return_url: `${baseUrl}/dashboard`,
        });
        return NextResponse.json({ url: portal.url });
    } catch (error) {
        console.error("[billing/portal]", error);
        const message = error instanceof Error ? error.message : "Portal session failed.";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
