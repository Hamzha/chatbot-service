export function PermissionsCard({ permissions }: { permissions: string[] }) {
    if (permissions.length === 0) return null;

    return (
        <section className="glass-strong space-y-3 rounded-2xl p-5 sm:p-6">
            <h2 className="text-sm font-semibold text-slate-900">Effective permissions</h2>
            <p className="text-xs text-slate-600">
                Union of all permissions from your roles ({permissions.length} codes). Admins manage roles from the dashboard.
            </p>
            <ul className="max-h-48 space-y-1 overflow-y-auto rounded-xl border border-slate-200 bg-white/70 p-3 font-mono text-xs text-slate-800">
                {permissions.map((code) => (
                    <li key={code} className="wrap-break-word">
                        {code}
                    </li>
                ))}
            </ul>
        </section>
    );
}
