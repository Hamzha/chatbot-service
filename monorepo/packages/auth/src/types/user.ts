export type SubscriptionStatus = "none" | "pending" | "active" | "past_due" | "canceled";

export type UserRecord = {
    id: string;
    email: string;
    name: string;
    /** Present for password / linked accounts; absent for Google-only users. */
    passwordHash?: string;
    /** Google subject (`sub`) when the account is linked to Google OAuth. */
    googleId?: string | null;
    image?: string | null;
    emailVerified: string | null;
    createdAt: string;
    /** Mongo role ObjectIds as strings; empty until RBAC seed assigns the default `user` role */
    roleIds?: string[];
    /**
     * Plan slug. `free` = trial quotas.
     * Paid slugs match SubscriptionPlan.slug; limits apply only when subscriptionStatus is `active`.
     */
    plan?: string;
    subscriptionStatus?: SubscriptionStatus;
    stripeCustomerId?: string | null;
    stripeSubscriptionId?: string | null;
};

export type SafeUser = {
    id: string;
    email: string;
    name: string;
    createdAt: string;
    plan: string;
    subscriptionStatus: SubscriptionStatus;
};
