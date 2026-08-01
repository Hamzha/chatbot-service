import Stripe from "stripe";

let stripeSingleton: Stripe | null = null;

export function getStripe(): Stripe {
    const key = process.env.STRIPE_SECRET_KEY?.trim();
    if (!key) {
        throw new Error("Missing STRIPE_SECRET_KEY environment variable.");
    }
    if (!stripeSingleton) {
        stripeSingleton = new Stripe(key, {
            apiVersion: "2025-08-27.basil",
            typescript: true,
        });
    }
    return stripeSingleton;
}

export function getStripeWebhookSecret(): string {
    const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
    if (!secret) {
        throw new Error("Missing STRIPE_WEBHOOK_SECRET environment variable.");
    }
    return secret;
}

export function getAppBaseUrl(): string {
    const raw =
        process.env.NEXT_PUBLIC_APP_URL?.trim() ||
        process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
        "http://localhost:3000";
    return raw.replace(/\/$/, "");
}

export function stripeCustomerIdOf(
    value: string | Stripe.Customer | Stripe.DeletedCustomer | null | undefined,
): string | null {
    if (!value) return null;
    if (typeof value === "string") return value;
    if ("deleted" in value && value.deleted) return null;
    return value.id;
}

export function stripeSubscriptionIdOf(
    value: string | Stripe.Subscription | null | undefined,
): string | null {
    if (!value) return null;
    return typeof value === "string" ? value : value.id;
}

export function stripePriceIdFromSubscription(sub: Stripe.Subscription): string | null {
    const item = sub.items?.data?.[0];
    const price = item?.price;
    if (!price) return null;
    return typeof price === "string" ? price : price.id;
}

export function stripePriceIdFromInvoice(invoice: Stripe.Invoice): string | null {
    for (const line of invoice.lines?.data ?? []) {
        const priceId = line.pricing?.price_details?.price;
        if (priceId) return priceId;
    }
    return null;
}

export function stripeSubscriptionIdFromInvoice(invoice: Stripe.Invoice): string | null {
    const fromParent = invoice.parent?.subscription_details?.subscription;
    if (fromParent) return stripeSubscriptionIdOf(fromParent);

    for (const line of invoice.lines?.data ?? []) {
        if (line.subscription) return stripeSubscriptionIdOf(line.subscription);
        const fromLineParent =
            line.parent?.subscription_item_details?.subscription ??
            line.parent?.invoice_item_details?.subscription;
        if (fromLineParent) return fromLineParent;
    }
    return null;
}

export function mapStripeSubscriptionStatus(
    status: Stripe.Subscription.Status,
): "pending" | "active" | "past_due" | "canceled" {
    switch (status) {
        case "active":
        case "trialing":
            return "active";
        case "past_due":
            return "past_due";
        case "canceled":
        case "unpaid":
        case "incomplete_expired":
            return "canceled";
        case "incomplete":
        case "paused":
        default:
            return "pending";
    }
}
