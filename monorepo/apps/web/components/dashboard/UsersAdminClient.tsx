"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "@/lib/ui/toast";
import { extractErrorMessage } from "@/lib/ui/notifyMutation";

type RoleOption = { id: string; slug: string; name: string; enabled: boolean; isSystem: boolean };
type UserRow = {
    id: string;
    email: string;
    name: string;
    createdAt: string;
    emailVerified: boolean;
    roleIds: string[];
    roles: { id: string; slug: string; name: string; enabled: boolean }[];
};

async function readError(res: Response): Promise<string> {
    try {
        const j = (await res.json()) as { error?: string };
        return j.error ?? res.statusText;
    } catch {
        return await res.text();
    }
}

export function UsersAdminClient() {
    const [users, setUsers] = useState<UserRow[]>([]);
    const [roleOptions, setRoleOptions] = useState<RoleOption[]>([]);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [draftRoleIds, setDraftRoleIds] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const selected = useMemo(() => users.find((u) => u.id === selectedId) ?? null, [users, selectedId]);

    const load = useCallback(async () => {
        setError(null);
        setLoading(true);
        try {
            const [meRes, usersRes, rolesRes] = await Promise.all([
                fetch("/api/auth/me", { credentials: "include" }),
                fetch("/api/admin/users", { credentials: "include" }),
                fetch("/api/admin/roles", { credentials: "include" }),
            ]);
            if (meRes.ok) {
                const me = (await meRes.json()) as { user?: { id: string } };
                if (me.user?.id) setCurrentUserId(me.user.id);
            }
            if (!usersRes.ok) throw new Error(await readError(usersRes));
            if (!rolesRes.ok) throw new Error(await readError(rolesRes));
            const uj = (await usersRes.json()) as { users: UserRow[] };
            const rj = (await rolesRes.json()) as { roles: RoleOption[] };
            setUsers(uj.users);
            setRoleOptions(rj.roles.sort((a, b) => a.slug.localeCompare(b.slug)));
            setSelectedId((prev) => {
                if (prev && uj.users.some((u) => u.id === prev)) return prev;
                return uj.users[0]?.id ?? null;
            });
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    useEffect(() => {
        if (!selected) return;
        setDraftRoleIds(new Set(selected.roleIds));
        setSuccess(null);
    }, [selected]);

    const toggleRole = (roleId: string) => {
        setDraftRoleIds((prev) => {
            const next = new Set(prev);
            if (next.has(roleId)) next.delete(roleId);
            else next.add(roleId);
            return next;
        });
    };

    const saveRoles = async () => {
        if (!selected) return;
        setSaving(true);
        setError(null);
        setSuccess(null);
        const loadingId = toast.loading("Saving roles…");
        try {
            const res = await fetch(`/api/admin/users/${selected.id}`, {
                method: "PATCH",
                credentials: "include",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ roleIds: [...draftRoleIds] }),
            });
            if (!res.ok) throw new Error(await readError(res));
            const json = (await res.json()) as { user: UserRow };
            setUsers((prev) => prev.map((u) => (u.id === json.user.id ? json.user : u)));
            setSuccess("Roles updated. User may need to refresh or log in again to see new permissions.");
            toast.success(`Roles updated for ${json.user.name}`, { id: loadingId });
        } catch (e) {
            const msg = extractErrorMessage(e, "Could not save roles");
            setError(msg);
            toast.error(msg, { id: loadingId });
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <p className="text-slate-600">Loading users…</p>;
    }

    return (
        <div className="space-y-6 max-w-5xl">
            <div>
                <h1 className="text-2xl font-semibold text-slate-900">Users & roles</h1>
                <p className="text-sm text-slate-600 mt-1">
                    Assign one or more roles to each account. Effective permissions are the union of all assigned roles that are still{" "}
                    <span className="font-medium">enabled</span> (manage that on Roles & permissions).
                </p>
            </div>

            {error ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
            ) : null}
            {success ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{success}</div>
            ) : null}

            <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
                <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Users</p>
                    <ul className="space-y-1 max-h-[60vh] overflow-y-auto pr-1">
                        {users.map((u) => (
                            <li key={u.id}>
                                <button
                                    type="button"
                                    onClick={() => setSelectedId(u.id)}
                                    className={`w-full text-left rounded-xl px-3 py-2 text-sm border transition-colors ${selectedId === u.id
                                        ? "bg-white border-brand-300 text-brand-900 shadow-sm"
                                        : "border-transparent text-slate-700 hover:bg-white/60"
                                        }`}
                                >
                                    <span className="font-medium flex items-center gap-2">
                                        {u.name}
                                        {currentUserId === u.id ? (
                                            <span className="rounded bg-brand-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-brand-800">
                                                You
                                            </span>
                                        ) : null}
                                    </span>
                                    <span className="block text-xs text-slate-500 truncate">{u.email}</span>
                                    <span className="block text-[10px] text-slate-400 mt-0.5">
                                        {u.roles.length} role{u.roles.length === 1 ? "" : "s"}
                                        {!u.emailVerified ? " · unverified email" : ""}
                                    </span>
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>

                <div className="rounded-2xl border border-white/40 bg-white/50 p-6 shadow-sm space-y-4">
                    {!selected ? (
                        <p className="text-slate-600">No users found.</p>
                    ) : (
                        <>
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                    <h2 className="text-lg font-semibold text-slate-900">{selected.name}</h2>
                                    <p className="text-sm text-slate-600">{selected.email}</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => void saveRoles()}
                                    disabled={saving}
                                    className="rounded-lg bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
                                >
                                    {saving ? "Saving…" : "Save roles"}
                                </button>
                            </div>

                            <p className="text-sm text-slate-600">
                                Check every role this user should have. Uncheck all to remove every role (they will have no permissions until you assign again).
                            </p>

                            <div className="space-y-2 rounded-xl border border-slate-100 bg-white/80 p-4 max-h-[50vh] overflow-y-auto">
                                {roleOptions.map((r) => (
                                    <label
                                        key={r.id}
                                        className={`flex items-start gap-3 rounded-lg px-2 py-2 text-sm ${r.enabled === false ? "opacity-60" : ""}`}
                                    >
                                        <input
                                            type="checkbox"
                                            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600"
                                            checked={draftRoleIds.has(r.id)}
                                            onChange={() => toggleRole(r.id)}
                                            disabled={saving}
                                        />
                                        <span>
                                            <span className="font-medium text-slate-900">{r.name}</span>
                                            <span className="text-slate-500"> · </span>
                                            <span className="font-mono text-xs text-slate-600">{r.slug}</span>
                                            {r.isSystem ? (
                                                <span className="ml-2 text-[10px] font-semibold uppercase text-slate-400">system</span>
                                            ) : null}
                                            {r.enabled === false ? (
                                                <span className="ml-2 text-[10px] font-semibold uppercase text-amber-700">disabled role</span>
                                            ) : null}
                                        </span>
                                    </label>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
