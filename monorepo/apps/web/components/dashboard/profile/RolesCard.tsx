type RoleChip = { id: string; slug: string; name: string; enabled?: boolean };

export function RolesCard({ roles }: { roles: RoleChip[] }) {
    return (
        <section className="glass-strong space-y-3 rounded-2xl p-5 sm:p-6">
            <h2 className="text-sm font-semibold text-slate-900">Roles</h2>
            {roles.length === 0 ? (
                <p className="text-sm text-slate-700">
                    No roles assigned yet. They are applied automatically after your next login.
                </p>
            ) : (
                <ul className="flex flex-wrap gap-2">
                    {roles.map((r) => {
                        const off = r.enabled === false;
                        return (
                            <li
                                key={r.id}
                                className={`rounded-full border px-3 py-1 text-xs font-medium ${
                                    off
                                        ? "border-slate-300 bg-slate-100 text-slate-700"
                                        : "border-brand-200 bg-brand-50 text-brand-900"
                                }`}
                            >
                                <span className="font-semibold">{r.name}</span>
                                <span className={off ? "text-slate-600" : "text-brand-700"}> · {r.slug}</span>
                                {off ? <span className="text-slate-600"> (disabled)</span> : null}
                            </li>
                        );
                    })}
                </ul>
            )}
            {roles.some((r) => r.enabled === false) ? (
                <p className="text-xs text-slate-600">
                    Roles marked disabled are still listed on your account but do not grant access until an admin turns them back on.
                </p>
            ) : null}
        </section>
    );
}
