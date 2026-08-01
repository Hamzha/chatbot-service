import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/userRepo", () => ({
    findUserById: vi.fn(),
    findUserByStripeCustomerId: vi.fn(),
    findUserByStripeSubscriptionId: vi.fn(),
    updateUserBilling: vi.fn(),
}));

vi.mock("@/lib/db/subscriptionPlanRepo", () => ({
    findSubscriptionPlanByStripePriceId: vi.fn(),
    findSubscriptionPlanBySlug: vi.fn(),
}));

vi.mock("@/lib/billing/stripe", async () => {
    const actual = await vi.importActual<typeof import("@/lib/billing/stripe")>("@/lib/billing/stripe");
    return {
        ...actual,
        getStripe: vi.fn(),
    };
});

import {
    handleCheckoutSessionCompleted,
    handleInvoicePaid,
    handleInvoicePaymentFailed,
    handleSubscriptionDeleted,
} from "@/lib/billing/webhookHandlers";
import {
    findUserById,
    findUserByStripeCustomerId,
    updateUserBilling,
} from "@/lib/db/userRepo";
import { findSubscriptionPlanByStripePriceId } from "@/lib/db/subscriptionPlanRepo";
import { getStripe } from "@/lib/billing/stripe";
import type Stripe from "stripe";

describe("billing webhook handlers", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(findUserById).mockResolvedValue({
            id: "user_1",
            email: "a@b.com",
            name: "A",
            emailVerified: null,
            createdAt: new Date().toISOString(),
            plan: "free",
            subscriptionStatus: "none",
        });
        vi.mocked(updateUserBilling).mockResolvedValue(null);
        vi.mocked(findSubscriptionPlanByStripePriceId).mockResolvedValue({
            id: "plan_1",
            name: "Pro",
            slug: "pro",
            description: "",
            amountCents: 2900,
            currency: "usd",
            interval: "month",
            features: [],
            limits: {
                scraperRuns: 500,
                documentUploads: 100,
                botsCreated: 25,
                dashboardChats: 5000,
                widgetChats: 10000,
            },
            limitPeriod: "calendar_month",
            active: true,
            sortOrder: 0,
            highlighted: true,
            stripeProductId: "prod_1",
            stripePriceId: "price_pro",
            syncStatus: "synced",
            lastSyncError: null,
            lastSyncedAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            updatedBy: null,
        });
    });

    it("checkout.session.completed only links ids as pending (no paid plan)", async () => {
        await handleCheckoutSessionCompleted({
            id: "cs_1",
            mode: "subscription",
            metadata: { userId: "user_1" },
            customer: "cus_1",
            subscription: "sub_1",
        } as unknown as Stripe.Checkout.Session);

        expect(updateUserBilling).toHaveBeenCalledWith("user_1", {
            stripeCustomerId: "cus_1",
            stripeSubscriptionId: "sub_1",
            subscriptionStatus: "pending",
        });
    });

    it("invoice.paid assigns plan slug + active for new sub and renewals", async () => {
        vi.mocked(getStripe).mockReturnValue({
            subscriptions: {
                retrieve: vi.fn().mockResolvedValue({
                    id: "sub_1",
                    metadata: { userId: "user_1" },
                    items: { data: [{ price: { id: "price_pro" } }] },
                }),
            },
        } as never);

        await handleInvoicePaid({
            id: "in_1",
            customer: "cus_1",
            parent: {
                type: "subscription_details",
                subscription_details: { subscription: "sub_1", metadata: null },
                quote_details: null,
            },
            lines: {
                data: [
                    {
                        pricing: { type: "price_details", price_details: { price: "price_pro" } },
                    },
                ],
            },
        } as unknown as Stripe.Invoice);

        expect(findSubscriptionPlanByStripePriceId).toHaveBeenCalledWith("price_pro");
        expect(updateUserBilling).toHaveBeenCalledWith("user_1", {
            plan: "pro",
            subscriptionStatus: "active",
            stripeCustomerId: "cus_1",
            stripeSubscriptionId: "sub_1",
        });
    });

    it("invoice.payment_failed marks past_due without changing plan", async () => {
        vi.mocked(findUserByStripeCustomerId).mockResolvedValue({
            id: "user_1",
            email: "a@b.com",
            name: "A",
            emailVerified: null,
            createdAt: new Date().toISOString(),
            plan: "pro",
            subscriptionStatus: "active",
        });
        vi.mocked(getStripe).mockReturnValue({
            subscriptions: {
                retrieve: vi.fn().mockResolvedValue({
                    id: "sub_1",
                    metadata: { userId: "user_1" },
                }),
            },
        } as never);

        await handleInvoicePaymentFailed({
            id: "in_fail",
            customer: "cus_1",
            parent: {
                type: "subscription_details",
                subscription_details: { subscription: "sub_1", metadata: null },
                quote_details: null,
            },
            lines: { data: [] },
        } as unknown as Stripe.Invoice);

        expect(updateUserBilling).toHaveBeenCalledWith("user_1", {
            subscriptionStatus: "past_due",
            stripeCustomerId: "cus_1",
            stripeSubscriptionId: "sub_1",
        });
    });

    it("subscription.deleted downgrades to free", async () => {
        vi.mocked(findUserByStripeCustomerId).mockResolvedValue({
            id: "user_1",
            email: "a@b.com",
            name: "A",
            emailVerified: null,
            createdAt: new Date().toISOString(),
            plan: "pro",
            subscriptionStatus: "active",
        });

        await handleSubscriptionDeleted({
            id: "sub_1",
            customer: "cus_1",
            metadata: { userId: "user_1" },
        } as unknown as Stripe.Subscription);

        expect(updateUserBilling).toHaveBeenCalledWith("user_1", {
            plan: "free",
            subscriptionStatus: "canceled",
            stripeCustomerId: "cus_1",
            stripeSubscriptionId: null,
        });
    });
});
