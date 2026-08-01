import type { FeatureLimitPeriod, FeatureLimitValues } from "@/lib/limits/featureLimitTypes";
import { DEFAULT_FEATURE_LIMITS } from "@/lib/limits/featureLimitTypes";
import {
    findSubscriptionPlanBySlug,
    findSubscriptionPlanByStripePriceId,
} from "@/lib/db/subscriptionPlanRepo";

export const SUBSCRIPTION_STATUSES = [
    "none",
    "pending",
    "active",
    "past_due",
    "canceled",
] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

/** `free` = trial quotas; any other string is a SubscriptionPlan.slug. */
export type PlanSlug = string;

export const FREE_PLAN_SLUG = "free";

export function isFreePlan(plan: string | null | undefined): boolean {
    return !plan || plan === FREE_PLAN_SLUG;
}

/** Paid feature access only when invoice.paid has activated the subscription. */
export function hasActivePaidAccess(
    plan: string | null | undefined,
    status: SubscriptionStatus | null | undefined,
): boolean {
    return status === "active" && !isFreePlan(plan);
}

export function getFreeFallbackLimits(): FeatureLimitValues {
    return { ...DEFAULT_FEATURE_LIMITS };
}

export async function resolvePlanLimitsBySlug(
    slug: string,
): Promise<{ limits: FeatureLimitValues; period: FeatureLimitPeriod } | null> {
    if (isFreePlan(slug)) return null;
    const plan = await findSubscriptionPlanBySlug(slug);
    if (!plan) return null;
    return { limits: { ...plan.limits }, period: plan.limitPeriod };
}

export async function planSlugFromPriceId(
    priceId: string | null | undefined,
): Promise<string | null> {
    if (!priceId) return null;
    const plan = await findSubscriptionPlanByStripePriceId(priceId);
    return plan?.slug ?? null;
}

export function formatPlanPrice(amountCents: number, currency: string, interval: string): string {
    const amount = amountCents / 100;
    const formatted = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: currency.toUpperCase(),
        minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    }).format(amount);
    return `${formatted}/${interval === "year" ? "year" : "mo"}`;
}
