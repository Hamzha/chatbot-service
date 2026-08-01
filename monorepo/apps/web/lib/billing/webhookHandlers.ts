import type Stripe from "stripe";
import {
    findUserById,
    findUserByStripeCustomerId,
    findUserByStripeSubscriptionId,
    updateUserBilling,
} from "@/lib/db/userRepo";
import {
    FREE_PLAN_SLUG,
    hasActivePaidAccess,
    planSlugFromPriceId,
    type SubscriptionStatus,
} from "@/lib/billing/plans";
import {
    getStripe,
    mapStripeSubscriptionStatus,
    stripeCustomerIdOf,
    stripePriceIdFromInvoice,
    stripePriceIdFromSubscription,
    stripeSubscriptionIdFromInvoice,
    stripeSubscriptionIdOf,
} from "@/lib/billing/stripe";

/**
 * Webhook policy:
 * - checkout.session.completed → link customer/subscription only (status pending). Never assign paid plan.
 * - invoice.paid → source of truth for paid access (new sub + renewals). Assign plan slug + active.
 * - invoice.payment_failed → past_due
 * - customer.subscription.updated → sync status only (no paid unlock)
 * - customer.subscription.deleted → downgrade to free
 */

async function resolveUserId(input: {
    userId?: string | null;
    customerId?: string | null;
    subscriptionId?: string | null;
}): Promise<string | null> {
    if (input.userId) {
        const byId = await findUserById(input.userId);
        if (byId) return byId.id;
    }
    if (input.customerId) {
        const byCustomer = await findUserByStripeCustomerId(input.customerId);
        if (byCustomer) return byCustomer.id;
    }
    if (input.subscriptionId) {
        const bySub = await findUserByStripeSubscriptionId(input.subscriptionId);
        if (bySub) return bySub.id;
    }
    return null;
}

async function userIdFromSubscriptionMetadata(subscriptionId: string): Promise<string | null> {
    const stripe = getStripe();
    const sub = await stripe.subscriptions.retrieve(subscriptionId);
    return sub.metadata?.userId?.trim() || null;
}

export async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session): Promise<void> {
    if (session.mode !== "subscription") return;

    const userIdMeta = session.metadata?.userId?.trim() || null;
    const customerId = stripeCustomerIdOf(session.customer);
    const subscriptionId = stripeSubscriptionIdOf(session.subscription);

    const userId =
        (await resolveUserId({
            userId: userIdMeta,
            customerId,
            subscriptionId,
        })) ?? (subscriptionId ? await userIdFromSubscriptionMetadata(subscriptionId) : null);

    if (!userId) {
        console.error("[billing] checkout.session.completed: could not resolve user", {
            sessionId: session.id,
            customerId,
            subscriptionId,
        });
        return;
    }

    await updateUserBilling(userId, {
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscriptionId,
        subscriptionStatus: "pending",
    });
}

export async function handleInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
    const customerId = stripeCustomerIdOf(invoice.customer);
    let subscriptionId = stripeSubscriptionIdFromInvoice(invoice);
    let priceId = stripePriceIdFromInvoice(invoice);
    let metaUserId: string | null = null;

    if (subscriptionId) {
        const stripe = getStripe();
        const sub = await stripe.subscriptions.retrieve(subscriptionId);
        metaUserId = sub.metadata?.userId?.trim() || null;
        if (!priceId) priceId = stripePriceIdFromSubscription(sub);
        subscriptionId = sub.id;
    }

    const userId = await resolveUserId({
        userId: metaUserId,
        customerId,
        subscriptionId,
    });

    if (!userId) {
        console.error("[billing] invoice.paid: could not resolve user", {
            invoiceId: invoice.id,
            customerId,
            subscriptionId,
        });
        return;
    }

    const planSlug = await planSlugFromPriceId(priceId);
    if (!planSlug) {
        console.error("[billing] invoice.paid: unknown price id (not synced in admin plans)", {
            invoiceId: invoice.id,
            priceId,
            userId,
        });
        return;
    }

    await updateUserBilling(userId, {
        plan: planSlug,
        subscriptionStatus: "active",
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscriptionId,
    });
}

export async function handleInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    const customerId = stripeCustomerIdOf(invoice.customer);
    const subscriptionId = stripeSubscriptionIdFromInvoice(invoice);

    let metaUserId: string | null = null;
    if (subscriptionId) {
        metaUserId = await userIdFromSubscriptionMetadata(subscriptionId);
    }

    const userId = await resolveUserId({
        userId: metaUserId,
        customerId,
        subscriptionId,
    });

    if (!userId) {
        console.error("[billing] invoice.payment_failed: could not resolve user", {
            invoiceId: invoice.id,
            customerId,
            subscriptionId,
        });
        return;
    }

    await updateUserBilling(userId, {
        subscriptionStatus: "past_due",
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscriptionId,
    });
}

export async function handleSubscriptionUpdated(sub: Stripe.Subscription): Promise<void> {
    const customerId = stripeCustomerIdOf(sub.customer);
    const subscriptionId = sub.id;
    const metaUserId = sub.metadata?.userId?.trim() || null;

    const userId = await resolveUserId({
        userId: metaUserId,
        customerId,
        subscriptionId,
    });

    if (!userId) {
        console.error("[billing] customer.subscription.updated: could not resolve user", {
            subscriptionId,
            customerId,
        });
        return;
    }

    const mapped = mapStripeSubscriptionStatus(sub.status);
    const patch: {
        stripeCustomerId: string | null;
        stripeSubscriptionId: string | null;
        subscriptionStatus: SubscriptionStatus;
        plan?: string;
    } = {
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscriptionId,
        subscriptionStatus: mapped === "active" ? "pending" : mapped,
    };

    if (mapped === "canceled") {
        patch.plan = FREE_PLAN_SLUG;
        patch.subscriptionStatus = "canceled";
    } else if (mapped === "past_due") {
        patch.subscriptionStatus = "past_due";
    } else if (mapped === "active") {
        const existing = await findUserById(userId);
        if (existing && hasActivePaidAccess(existing.plan, existing.subscriptionStatus)) {
            patch.subscriptionStatus = "active";
            const priceSlug = await planSlugFromPriceId(stripePriceIdFromSubscription(sub));
            if (priceSlug) patch.plan = priceSlug;
        } else {
            patch.subscriptionStatus = "pending";
        }
    }

    await updateUserBilling(userId, patch);
}

export async function handleSubscriptionDeleted(sub: Stripe.Subscription): Promise<void> {
    const customerId = stripeCustomerIdOf(sub.customer);
    const metaUserId = sub.metadata?.userId?.trim() || null;

    const userId = await resolveUserId({
        userId: metaUserId,
        customerId,
        subscriptionId: sub.id,
    });

    if (!userId) {
        console.error("[billing] customer.subscription.deleted: could not resolve user", {
            subscriptionId: sub.id,
            customerId,
        });
        return;
    }

    await updateUserBilling(userId, {
        plan: FREE_PLAN_SLUG,
        subscriptionStatus: "canceled",
        stripeCustomerId: customerId,
        stripeSubscriptionId: null,
    });
}

export async function dispatchStripeEvent(event: Stripe.Event): Promise<void> {
    switch (event.type) {
        case "checkout.session.completed":
            await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
            break;
        case "invoice.paid":
            await handleInvoicePaid(event.data.object as Stripe.Invoice);
            break;
        case "invoice.payment_failed":
            await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
            break;
        case "customer.subscription.updated":
            await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
            break;
        case "customer.subscription.deleted":
            await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
            break;
        default:
            break;
    }
}
