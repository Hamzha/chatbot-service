import type { SafeUser } from "@repo/auth/types";
import { ManageBillingButton } from "@/components/billing/ManageBillingButton";

function statusLabel(status: SafeUser["subscriptionStatus"]): string {
    switch (status) {
        case "active":
            return "Active";
        case "pending":
            return "Payment pending";
        case "past_due":
            return "Past due";
        case "canceled":
            return "Canceled";
        default:
            return "Free trial";
    }
}

export function AccountDetailsCard({ user }: { user: SafeUser }) {
    const created = new Date(user.createdAt);
    const createdLabel = Number.isNaN(created.getTime())
        ? user.createdAt
        : created.toLocaleDateString();

    const showPortal = user.subscriptionStatus !== "none";

    return (
        <section className="glass-strong space-y-4 rounded-2xl p-5 sm:p-6">
            <h2 className="text-sm font-semibold text-slate-900">Account details</h2>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div className="min-w-0">
                    <dt className="text-slate-600">Email</dt>
                    <dd className="mt-0.5 min-w-0 wrap-break-word font-medium text-slate-900">
                        {user.email}
                    </dd>
                </div>
                <div>
                    <dt className="text-slate-600">Member since</dt>
                    <dd className="mt-0.5 font-medium text-slate-900">{createdLabel}</dd>
                </div>
                <div>
                    <dt className="text-slate-600">Plan</dt>
                    <dd className="mt-0.5 font-medium capitalize text-slate-900">{user.plan}</dd>
                </div>
                <div>
                    <dt className="text-slate-600">Billing status</dt>
                    <dd className="mt-0.5 font-medium text-slate-900">
                        {statusLabel(user.subscriptionStatus)}
                    </dd>
                </div>
            </dl>
            {showPortal ? (
                <ManageBillingButton />
            ) : (
                <p className="text-xs text-slate-600">
                    On the free trial.{" "}
                    <a href="/#pricing" className="font-semibold text-brand-700 hover:underline">
                        Upgrade
                    </a>{" "}
                    when you need higher limits.
                </p>
            )}
        </section>
    );
}
