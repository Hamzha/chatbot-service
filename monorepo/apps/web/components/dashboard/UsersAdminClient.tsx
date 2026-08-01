"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { PageContainer } from "@/components/shell/PageContainer";
import { PageHeader } from "@/components/shell/PageHeader";
import { toast } from "@/lib/ui/toast";
import { extractErrorMessage } from "@/lib/ui/notifyMutation";
import {
    FEATURE_LIMIT_KEYS,
    FEATURE_LIMIT_LABELS,
    type FeatureLimitKey,
    type FeatureLimitValues,
} from "@/lib/limits/featureLimitTypes";

type RoleOption = { id: string; slug: string; name: string; enabled: boolean; isSystem: boolean };
type SubscriptionStatus = "none" | "pending" | "active" | "past_due" | "canceled";
type UserRow = {
    id: string;
    email: string;
    name: string;
    createdAt: string;
    emailVerified: boolean;
    roleIds: string[];
    roles: { id: string; slug: string; name: string; enabled: boolean }[];
    plan: string;
    subscriptionStatus: SubscriptionStatus;
    stripeCustomerId: string | null;
    stripeSubscriptionId: string | null;
};

type UserLimitsState = {
    override: { limits: Partial<FeatureLimitValues> } | null;
    effective: { limits: FeatureLimitValues; period: string };
    usage: { key: FeatureLimitKey; used: number; limit: number | null }[];
};

type StatusFilter = "all" | SubscriptionStatus;

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
    { value: "all", label: "All" },
    { value: "active", label: "Active" },
    { value: "pending", label: "Pending" },
    { value: "past_due", label: "Past due" },
    { value: "canceled", label: "Canceled" },
    { value: "none", label: "Free / none" },
];

function statusLabel(status: SubscriptionStatus): string {
    switch (status) {
        case "active":
            return "Active";
        case "pending":
            return "Pending";
        case "past_due":
            return "Past due";
        case "canceled":
            return "Canceled";
        default:
            return "Free";
    }
}

function statusBadgeClass(status: SubscriptionStatus): string {
    switch (status) {
        case "active":
            return "bg-emerald-100 text-emerald-800";
        case "pending":
            return "bg-amber-100 text-amber-800";
        case "past_due":
            return "bg-rose-100 text-rose-800";
        case "canceled":
            return "bg-slate-200 text-slate-700";
        default:
            return "bg-slate-100 text-slate-600";
    }
}

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
    const [canEditLimits, setCanEditLimits] = useState(false);
    const [userLimits, setUserLimits] = useState<UserLimitsState | null>(null);
    const [draftLimits, setDraftLimits] = useState<Partial<Record<FeatureLimitKey, string>>>({});
    const [savingLimits, setSavingLimits] = useState(false);
    const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
    const [query, setQuery] = useState("");

    const filteredUsers = useMemo(() => {
        const q = query.trim().toLowerCase();
        return users.filter((u) => {
            if (statusFilter !== "all" && u.subscriptionStatus !== statusFilter) return false;
            if (!q) return true;
            return (
                u.email.toLowerCase().includes(q) ||
                u.name.toLowerCase().includes(q) ||
                u.plan.toLowerCase().includes(q)
            );
        });
    }, [users, statusFilter, query]);

    const selected = useMemo(
        () => users.find((u) => u.id === selectedId) ?? null,
        [users, selectedId],
    );

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
                const me = (await meRes.json()) as { user?: { id: string }; permissions?: string[] };
                if (me.user?.id) setCurrentUserId(me.user.id);
                setCanEditLimits(Boolean(me.permissions?.includes("limits:update")));
            }
            if (!usersRes.ok) throw new Error(await readError(usersRes));
            if (!rolesRes.ok) throw new Error(await readError(rolesRes));
            const uj = (await usersRes.json()) as { users: UserRow[] };
            const rj = (await rolesRes.json()) as { roles: RoleOption[] };
            const normalized = uj.users.map((u) => ({
                ...u,
                plan: u.plan ?? "free",
                subscriptionStatus: u.subscriptionStatus ?? "none",
                stripeCustomerId: u.stripeCustomerId ?? null,
                stripeSubscriptionId: u.stripeSubscriptionId ?? null,
            }));
            setUsers(normalized);
            setRoleOptions(rj.roles.sort((a, b) => a.slug.localeCompare(b.slug)));
            setSelectedId((prev) => {
                if (prev && normalized.some((u) => u.id === prev)) return prev;
                return normalized[0]?.id ?? null;
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
        setUserLimits(null);
        setDraftLimits({});
        void (async () => {
            try {
                const res = await fetch(`/api/admin/limits/users/${selected.id}`, {
                    credentials: "include",
                });
                if (!res.ok) return;
                const data = (await res.json()) as UserLimitsState;
                setUserLimits(data);
                const next: Partial<Record<FeatureLimitKey, string>> = {};
                for (const key of FEATURE_LIMIT_KEYS) {
                    const overrideVal = data.override?.limits?.[key];
                    if (overrideVal === undefined) {
                        next[key] = "";
                    } else if (overrideVal === null) {
                        next[key] = "unlimited";
                    } else {
                        next[key] = String(overrideVal);
                    }
                }
                setDraftLimits(next);
            } catch {
                /* optional section */
            }
        })();
    }, [selected]);

    useEffect(() => {
        if (!selectedId) return;
        if (!filteredUsers.some((u) => u.id === selectedId)) {
            setSelectedId(filteredUsers[0]?.id ?? null);
        }
    }, [filteredUsers, selectedId]);

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
            setUsers((prev) =>
                prev.map((u) =>
                    u.id === json.user.id
                        ? {
                              ...json.user,
                              plan: json.user.plan ?? u.plan,
                              subscriptionStatus:
                                  json.user.subscriptionStatus ?? u.subscriptionStatus,
                              stripeCustomerId: json.user.stripeCustomerId ?? u.stripeCustomerId,
                              stripeSubscriptionId:
                                  json.user.stripeSubscriptionId ?? u.stripeSubscriptionId,
                          }
                        : u,
                ),
            );
            setSuccess(
                "Roles updated. User may need to refresh or log in again to see new permissions.",
            );
            toast.success(`Roles updated for ${json.user.name}`, { id: loadingId });
        } catch (e) {
            const msg = extractErrorMessage(e, "Could not save roles");
            setError(msg);
            toast.error(msg, { id: loadingId });
        } finally {
            setSaving(false);
        }
    };

    const saveUserLimits = async () => {
        if (!selected) return;
        setSavingLimits(true);
        setError(null);
        const loadingId = toast.loading("Saving user limits…");
        try {
            const limits: Partial<FeatureLimitValues> = {};
            let anySet = false;
            for (const key of FEATURE_LIMIT_KEYS) {
                const raw = (draftLimits[key] ?? "").trim().toLowerCase();
                if (!raw) continue;
                anySet = true;
                if (raw === "unlimited" || raw === "null") {
                    limits[key] = null;
                } else {
                    const n = Number(raw);
                    if (!Number.isFinite(n) || n < 0) {
                        throw new Error(`Invalid limit for ${key}`);
                    }
                    limits[key] = Math.floor(n);
                }
            }
            const res = await fetch(`/api/admin/limits/users/${selected.id}`, {
                method: "PUT",
                credentials: "include",
                headers: { "content-type": "application/json" },
                body: JSON.stringify(anySet ? { limits } : { clear: true }),
            });
            if (!res.ok) throw new Error(await readError(res));
            const data = (await res.json()) as UserLimitsState;
            setUserLimits(data);
            toast.success("User limits updated", { id: loadingId });
        } catch (e) {
            const msg = extractErrorMessage(e, "Could not save user limits");
            setError(msg);
            toast.error(msg, { id: loadingId });
        } finally {
            setSavingLimits(false);
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
                subtitle="Assign roles, see subscription plan/status, and optional per-user feature limit overrides."
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

            <div className="grid gap-5 sm:gap-6 md:grid-cols-[280px_minmax(0,1fr)]">
                <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">Users</p>
                    <input
                        type="search"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search name, email, plan…"
                        className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
                    />
                    <div className="flex flex-wrap gap-1.5">
                        {STATUS_FILTERS.map((f) => (
                            <button
                                key={f.value}
                                type="button"
                                onClick={() => setStatusFilter(f.value)}
                                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
                                    statusFilter === f.value
                                        ? "bg-brand-700 text-white"
                                        : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
                                }`}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>
                    <ul className="max-h-[42vh] space-y-1 overflow-y-auto pr-1 sm:max-h-[60vh]">
                        {filteredUsers.length === 0 ? (
                            <li className="rounded-xl bg-white/60 px-3 py-3 text-xs text-slate-600">
                                No users match this filter.
                            </li>
                        ) : (
                            filteredUsers.map((u) => (
                                <li key={u.id}>
                                    <button
                                        type="button"
                                        onClick={() => setSelectedId(u.id)}
                                        aria-current={selectedId === u.id ? "true" : undefined}
                                        className={`w-full rounded-xl border px-3 py-2.5 text-left text-sm transition-colors ${
                                            selectedId === u.id
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
                                        <span className="block truncate text-xs text-slate-700">
                                            {u.email}
                                        </span>
                                        <span className="mt-1 flex flex-wrap items-center gap-1.5">
                                            <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold capitalize text-slate-700">
                                                {u.plan}
                                            </span>
                                            <span
                                                className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${statusBadgeClass(u.subscriptionStatus)}`}
                                            >
                                                {statusLabel(u.subscriptionStatus)}
                                            </span>
                                        </span>
                                    </button>
                                </li>
                            ))
                        )}
                    </ul>
                </div>

                <div className="min-w-0 space-y-4 rounded-2xl border border-white/40 bg-white/50 p-5 shadow-sm sm:p-6">
                    {!selected ? (
                        <p className="text-sm text-slate-700">No users found.</p>
                    ) : (
                        <>
                            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
                                <div className="min-w-0">
                                    <h2 className="wrap-break-word text-lg font-semibold text-slate-900">
                                        {selected.name}
                                    </h2>
                                    <p className="wrap-break-word text-sm text-slate-700">
                                        {selected.email}
                                    </p>
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

                            <div className="rounded-xl border border-slate-100 bg-white/80 p-3 sm:p-4">
                                <h3 className="text-sm font-semibold text-slate-900">Subscription</h3>
                                <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                                    <div>
                                        <dt className="text-slate-600">Plan</dt>
                                        <dd className="mt-0.5 font-medium capitalize text-slate-900">
                                            {selected.plan}
                                        </dd>
                                    </div>
                                    <div>
                                        <dt className="text-slate-600">Status</dt>
                                        <dd className="mt-0.5">
                                            <span
                                                className={`inline-flex rounded-md px-2 py-0.5 text-xs font-semibold ${statusBadgeClass(selected.subscriptionStatus)}`}
                                            >
                                                {statusLabel(selected.subscriptionStatus)}
                                            </span>
                                        </dd>
                                    </div>
                                    <div className="min-w-0 sm:col-span-2">
                                        <dt className="text-slate-600">Stripe customer</dt>
                                        <dd className="mt-0.5 truncate font-mono text-xs text-slate-700">
                                            {selected.stripeCustomerId || "—"}
                                        </dd>
                                    </div>
                                    <div className="min-w-0 sm:col-span-2">
                                        <dt className="text-slate-600">Stripe subscription</dt>
                                        <dd className="mt-0.5 truncate font-mono text-xs text-slate-700">
                                            {selected.stripeSubscriptionId || "—"}
                                        </dd>
                                    </div>
                                </dl>
                            </div>

                            <p className="text-sm text-slate-700">
                                Check every role this user should have. Uncheck all to remove every role
                                (they will have no permissions until you assign again).
                            </p>

                            <div className="max-h-[40vh] space-y-2 overflow-y-auto rounded-xl border border-slate-100 bg-white/80 p-3 sm:p-4">
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
                                            <span className="wrap-break-word font-semibold text-slate-900">
                                                {r.name}
                                            </span>
                                            <span className="text-slate-600"> · </span>
                                            <span className="wrap-break-word font-mono text-xs text-slate-700">
                                                {r.slug}
                                            </span>
                                            {r.isSystem ? (
                                                <span className="ml-2 text-[10px] font-semibold uppercase text-slate-600">
                                                    system
                                                </span>
                                            ) : null}
                                            {r.enabled === false ? (
                                                <span className="ml-2 text-[10px] font-semibold uppercase text-amber-800">
                                                    disabled role
                                                </span>
                                            ) : null}
                                        </span>
                                    </label>
                                ))}
                            </div>

                            <div className="space-y-3 border-t border-slate-200 pt-4">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div>
                                        <h3 className="text-sm font-semibold text-slate-900">
                                            Feature limit overrides
                                        </h3>
                                        <p className="text-xs text-slate-600">
                                            Leave blank to use global defaults. Type{" "}
                                            <span className="font-mono">unlimited</span> for no cap.
                                            Period follows global settings
                                            {userLimits ? ` (${userLimits.effective.period})` : ""}.
                                        </p>
                                    </div>
                                    {canEditLimits ? (
                                        <button
                                            type="button"
                                            onClick={() => void saveUserLimits()}
                                            disabled={savingLimits}
                                            className="h-10 rounded-lg border border-brand-300 bg-white px-4 text-sm font-semibold text-brand-900 hover:bg-brand-50 disabled:opacity-50"
                                        >
                                            {savingLimits ? "Saving…" : "Save limits"}
                                        </button>
                                    ) : null}
                                </div>
                                {userLimits ? (
                                    <div className="space-y-2 rounded-xl border border-slate-100 bg-white/80 p-3">
                                        {FEATURE_LIMIT_KEYS.map((key) => {
                                            const usage = userLimits.usage.find((u) => u.key === key);
                                            return (
                                                <label key={key} className="block text-sm">
                                                    <span className="font-medium text-slate-800">
                                                        {FEATURE_LIMIT_LABELS[key]}
                                                    </span>
                                                    <span className="ml-2 text-xs text-slate-600">
                                                        used {usage?.used ?? 0}
                                                        {usage?.limit === null ||
                                                        usage?.limit === undefined
                                                            ? " / ∞"
                                                            : ` / ${usage.limit}`}
                                                    </span>
                                                    <input
                                                        type="text"
                                                        className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
                                                        placeholder={`Global: ${userLimits.effective.limits[key] ?? "unlimited"}`}
                                                        value={draftLimits[key] ?? ""}
                                                        disabled={!canEditLimits || savingLimits}
                                                        onChange={(e) =>
                                                            setDraftLimits((prev) => ({
                                                                ...prev,
                                                                [key]: e.target.value,
                                                            }))
                                                        }
                                                    />
                                                </label>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <p className="text-xs text-slate-600">
                                        Loading usage… (needs limits:read)
                                    </p>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </PageContainer>
    );
}
