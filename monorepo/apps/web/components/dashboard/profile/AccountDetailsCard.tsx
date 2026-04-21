import type { SafeUser } from "@repo/auth/types";

export function AccountDetailsCard({ user }: { user: SafeUser }) {
    const created = new Date(user.createdAt);
    const createdLabel = Number.isNaN(created.getTime())
        ? user.createdAt
        : created.toLocaleDateString();

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
            </dl>
        </section>
    );
}
