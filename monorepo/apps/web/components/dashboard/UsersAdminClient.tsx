"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { PageContainer } from "@/components/shell/PageContainer";
import { PageHeader } from "@/components/shell/PageHeader";
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
        return (
            <PageContainer size="5xl">
                <p className="text-sm text-slate-700" role="status" aria-live="polite">
                    Loading users…
                </p>
            </PageContainer>
        );
    }

    return (
        <PageContainer size="5xl">
            <PageHeader
                variant="plain"
                eyebrow="Admin"
                title="Users & roles"
                subtitle="Assign one or more roles to each account. Effective permissions are the union of all assigned roles that are still enabled."
            />

            {error ? (
                <div
                    className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900"
                    role="alert"
                >
                    {error}
                </div>
            ) : null}
            {success ? (
                <div
                    className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
                    role="status"
                    aria-live="polite"
                >
                    {success}
                </div>
            ) : null}

            <div className="grid gap-5 sm:gap-6 md:grid-cols-[260px_minmax(0,1fr)]">
                <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">Users</p>
                    <ul className="max-h-[42vh] space-y-1 overflow-y-auto pr-1 sm:max-h-[60vh]">
                        {users.map((u) => (
                            <li key={u.id}>
                                <button
                                    type="button"
                                    onClick={() => setSelectedId(u.id)}
                                    aria-current={selectedId === u.id ? "true" : undefined}
                                    className={`w-full rounded-xl border px-3 py-2.5 text-left text-sm transition-colors ${selectedId === u.id
                                        ? "border-brand-300 bg-white text-brand-900 shadow-sm"
                                        : "border-transparent text-slate-800 hover:bg-white/60"
                                        }`}
                                >
                                    <span className="flex min-w-0 items-center gap-2 font-semibold">
                                        <span className="truncate">{u.name}</span>
                                        {currentUserId === u.id ? (
                                            <span className="shrink-0 rounded bg-brand-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-brand-800">
                                                You
                                            </span>
                                        ) : null}
                                    </span>
                                    <span className="block truncate text-xs text-slate-700">{u.email}</span>
                                    <span className="mt-0.5 block text-[10px] text-slate-600">
                                        {u.roles.length} role{u.roles.length === 1 ? "" : "s"}
                                        {!u.emailVerified ? " · unverified email" : ""}
                                    </span>
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>

                <div className="min-w-0 space-y-4 rounded-2xl border border-white/40 bg-white/50 p-5 shadow-sm sm:p-6">
                    {!selected ? (
                        <p className="text-sm text-slate-700">No users found.</p>
                    ) : (
                        <>
                            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
                                <div className="min-w-0">
                                    <h2 className="wrap-break-word text-lg font-semibold text-slate-900">{selected.name}</h2>
                                    <p className="wrap-break-word text-sm text-slate-700">{selected.email}</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => void saveRoles()}
                                    disabled={saving}
                                    className="h-10 rounded-lg bg-brand-700 px-4 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-50 sm:w-auto"
                                >
                                    {saving ? "Saving…" : "Save roles"}
                                </button>
                            </div>

                            <p className="text-sm text-slate-700">
                                Check every role this user should have. Uncheck all to remove every role (they will have no permissions until you assign again).
                            </p>

                            <div className="max-h-[50vh] space-y-2 overflow-y-auto rounded-xl border border-slate-100 bg-white/80 p-3 sm:p-4">
                                {roleOptions.map((r) => (
                                    <label
                                        key={r.id}
                                        className={`flex min-h-[44px] cursor-pointer items-start gap-3 rounded-lg px-2 py-2 text-sm hover:bg-slate-50 ${r.enabled === false ? "opacity-60" : ""}`}
                                    >
                                        <input
                                            type="checkbox"
                                            className="mt-1 h-4 w-4 rounded border-slate-300 text-brand-700"
                                            checked={draftRoleIds.has(r.id)}
                                            onChange={() => toggleRole(r.id)}
                                            disabled={saving}
                                        />
                                        <span className="min-w-0 flex-1">
                                            <span className="wrap-break-word font-semibold text-slate-900">{r.name}</span>
                                            <span className="text-slate-600"> · </span>
                                            <span className="wrap-break-word font-mono text-xs text-slate-700">{r.slug}</span>
                                            {r.isSystem ? (
                                                <span className="ml-2 text-[10px] font-semibold uppercase text-slate-600">system</span>
                                            ) : null}
                                            {r.enabled === false ? (
                                                <span className="ml-2 text-[10px] font-semibold uppercase text-amber-800">disabled role</span>
                                            ) : null}
                                        </span>
                                    </label>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </PageContainer>
    );
}
