import {
    findSubscriptionPlanById,
    markPlanSyncResult,
    type SubscriptionPlanRecord,
} from "@/lib/db/subscriptionPlanRepo";
import { getStripe } from "@/lib/billing/stripe";

/**
 * Push a local SubscriptionPlan to Stripe:
 * - create/update Product
 * - create Price when missing or amount/currency/interval changed (archive old price)
 */
export async function syncSubscriptionPlanToStripe(
    planId: string,
): Promise<SubscriptionPlanRecord> {
    const plan = await findSubscriptionPlanById(planId);
    if (!plan) {
        throw new Error("Plan not found.");
    }

    try {
        const stripe = getStripe();
        let productId = plan.stripeProductId;

        if (!productId) {
            const product = await stripe.products.create({
                name: plan.name,
                description: plan.description || undefined,
                metadata: {
                    planId: plan.id,
                    slug: plan.slug,
                },
            });
            productId = product.id;
        } else {
            await stripe.products.update(productId, {
                name: plan.name,
                description: plan.description || undefined,
                active: plan.active,
                metadata: {
                    planId: plan.id,
                    slug: plan.slug,
                },
            });
        }

        let priceId = plan.stripePriceId;
        let needsNewPrice = !priceId;

        if (priceId) {
            const existing = await stripe.prices.retrieve(priceId);
            const sameAmount = existing.unit_amount === plan.amountCents;
            const sameCurrency = existing.currency === plan.currency;
            const sameInterval = existing.recurring?.interval === plan.interval;
            if (!sameAmount || !sameCurrency || !sameInterval || !existing.active) {
                needsNewPrice = true;
                if (existing.active) {
                    await stripe.prices.update(priceId, { active: false });
                }
            }
        }

        if (needsNewPrice) {
            const price = await stripe.prices.create({
                product: productId,
                unit_amount: plan.amountCents,
                currency: plan.currency,
                recurring: { interval: plan.interval },
                metadata: {
                    planId: plan.id,
                    slug: plan.slug,
                },
            });
            priceId = price.id;
        }

        const synced = await markPlanSyncResult(plan.id, {
            ok: true,
            stripeProductId: productId,
            stripePriceId: priceId!,
        });
        if (!synced) throw new Error("Failed to save sync result.");
        return synced;
    } catch (err) {
        const message = err instanceof Error ? err.message : "Stripe sync failed.";
        await markPlanSyncResult(planId, { ok: false, error: message });
        throw new Error(message);
    }
}
