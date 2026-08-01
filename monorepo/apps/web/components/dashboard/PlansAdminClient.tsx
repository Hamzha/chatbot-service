"use client";

import { useCallback, useEffect, useState } from "react";
import { PageContainer } from "@/components/shell/PageContainer";
import { PageHeader } from "@/components/shell/PageHeader";
import { toast } from "@/lib/ui/toast";
import { extractErrorMessage } from "@/lib/ui/notifyMutation";
import {
    FEATURE_LIMIT_KEYS,
    type FeatureLimitKey,
    type FeatureLimitPeriod,
    type FeatureLimitValues,
} from "@/lib/limits/featureLimitTypes";
import type { SubscriptionPlanRecord } from "@/lib/db/subscriptionPlanRepo";

const LIMIT_LABELS: Record<FeatureLimitKey, string> = {
    scraperRuns: "Scraper runs",
    documentUploads: "Document uploads",
    botsCreated: "Chatbots",
    dashboardChats: "Dashboard chats",
    widgetChats: "Widget chats",
};

function emptyLimits(): FeatureLimitValues {
    return {
        scraperRuns: 500,
        documentUploads: 100,
        botsCreated: 25,
        dashboardChats: 5000,
        widgetChats: 10000,
    };
}

type FormState = {
    name: string;
    slug: string;
    description: string;
    amountDollars: string;
    currency: string;
    interval: "month" | "year";
    featuresText: string;
    limits: FeatureLimitValues;
    limitPeriod: FeatureLimitPeriod;
    active: boolean;
    highlighted: boolean;
    sortOrder: string;
};

function blankForm(): FormState {
    return {
        name: "",
        slug: "",
        description: "",
        amountDollars: "29",
        currency: "usd",
        interval: "month",
        featuresText: "",
        limits: emptyLimits(),
        limitPeriod: "calendar_month",
        active: true,
        highlighted: false,
        sortOrder: "0",
    };
}

function formFromPlan(plan: SubscriptionPlanRecord): FormState {
    return {
        name: plan.name,
        slug: plan.slug,
        description: plan.description,
        amountDollars: (plan.amountCents / 100).toString(),
        currency: plan.currency,
        interval: plan.interval,
        featuresText: plan.features.join("\n"),
        limits: { ...plan.limits },
        limitPeriod: plan.limitPeriod,
        active: plan.active,
        highlighted: plan.highlighted,
        sortOrder: String(plan.sortOrder),
    };
}

function syncBadge(plan: SubscriptionPlanRecord): { label: string; className: string } {
    if (plan.syncStatus === "synced") {
        return { label: "Synced", className: "bg-emerald-100 text-emerald-800" };
    }
    if (plan.syncStatus === "error") {
        return { label: "Sync error", className: "bg-rose-100 text-rose-800" };
    }
    return { label: "Draft — needs sync", className: "bg-amber-100 text-amber-800" };
}

export function PlansAdminClient() {
    const [plans, setPlans] = useState<SubscriptionPlanRecord[]>([]);
    const [form, setForm] = useState<FormState>(blankForm());
    const [editingId, setEditingId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [syncingId, setSyncingId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [canUpdate, setCanUpdate] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [meRes, plansRes] = await Promise.all([
                fetch("/api/auth/me", { credentials: "include" }),
                fetch("/api/admin/plans", { credentials: "include" }),
            ]);
            if (meRes.ok) {
                const me = (await meRes.json()) as { permissions?: string[] };
                setCanUpdate(Boolean(me.permissions?.includes("plans:update")));
            }
            if (!plansRes.ok) {
                const j = (await plansRes.json().catch(() => ({}))) as { error?: string };
                throw new Error(j.error || plansRes.statusText);
            }
            const data = (await plansRes.json()) as { plans: SubscriptionPlanRecord[] };
            setPlans(data.plans);
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    const setLimit = (key: FeatureLimitKey, raw: string) => {
        const trimmed = raw.trim();
        if (trimmed === "" || trimmed.toLowerCase() === "unlimited") {
            setForm((prev) => ({ ...prev, limits: { ...prev.limits, [key]: null } }));
            return;
        }
        const n = Number(trimmed);
        if (!Number.isFinite(n) || n < 0) return;
        setForm((prev) => ({
            ...prev,
            limits: { ...prev.limits, [key]: Math.floor(n) },
        }));
    };

    const resetForm = () => {
        setEditingId(null);
        setForm(blankForm());
    };

    const startEdit = (plan: SubscriptionPlanRecord) => {
        setEditingId(plan.id);
        setForm(formFromPlan(plan));
    };

    const buildPayload = () => {
        const dollars = Number(form.amountDollars);
        if (!Number.isFinite(dollars) || dollars < 0) {
            throw new Error("Enter a valid price.");
        }
        return {
            name: form.name.trim(),
            slug: form.slug.trim() || undefined,
            description: form.description.trim(),
            amountCents: Math.round(dollars * 100),
            currency: form.currency.trim().toLowerCase() || "usd",
            interval: form.interval,
            features: form.featuresText
                .split("\n")
                .map((l) => l.trim())
                .filter(Boolean),
            limits: form.limits,
            limitPeriod: form.limitPeriod,
            active: form.active,
            highlighted: form.highlighted,
            sortOrder: Number(form.sortOrder) || 0,
        };
    };

    const save = async () => {
        if (!canUpdate) return;
        setSaving(true);
        setError(null);
        const loadingId = toast.loading(editingId ? "Updating plan…" : "Creating plan…");
        try {
            const payload = buildPayload();
            const res = await fetch(editingId ? `/api/admin/plans/${editingId}` : "/api/admin/plans", {
                method: editingId ? "PATCH" : "POST",
                credentials: "include",
                headers: { "content-type": "application/json" },
                body: JSON.stringify(payload),
            });
            if (!res.ok) {
                const j = (await res.json().catch(() => ({}))) as { error?: string };
                throw new Error(j.error || res.statusText);
            }
            toast.success(editingId ? "Plan updated" : "Plan created — click Sync to Stripe", {
                id: loadingId,
            });
            resetForm();
            await load();
        } catch (e) {
            const msg = extractErrorMessage(e, "Could not save plan");
            setError(msg);
            toast.error(msg, { id: loadingId });
        } finally {
            setSaving(false);
        }
    };

    const sync = async (planId: string) => {
        if (!canUpdate) return;
        setSyncingId(planId);
        const loadingId = toast.loading("Syncing to Stripe…");
        try {
            const res = await fetch(`/api/admin/plans/${planId}/sync`, {
                method: "POST",
                credentials: "include",
            });
            if (!res.ok) {
                const j = (await res.json().catch(() => ({}))) as { error?: string };
                throw new Error(j.error || res.statusText);
            }
            toast.success("Synced to Stripe", { id: loadingId });
            await load();
        } catch (e) {
            const msg = extractErrorMessage(e, "Sync failed");
            toast.error(msg, { id: loadingId });
        } finally {
            setSyncingId(null);
        }
    };

    const remove = async (planId: string) => {
        if (!canUpdate) return;
        if (!window.confirm("Delete this plan? Users already on it keep their slug until canceled.")) {
            return;
        }
        const loadingId = toast.loading("Deleting plan…");
        try {
            const res = await fetch(`/api/admin/plans/${planId}`, {
                method: "DELETE",
                credentials: "include",
            });
            if (!res.ok) {
                const j = (await res.json().catch(() => ({}))) as { error?: string };
                throw new Error(j.error || res.statusText);
            }
            toast.success("Plan deleted", { id: loadingId });
            if (editingId === planId) resetForm();
            await load();
        } catch (e) {
            toast.error(extractErrorMessage(e, "Delete failed"), { id: loadingId });
        }
    };

    return (
        <PageContainer>
            <PageHeader
                title="Subscription plans"
                subtitle="Create plans here, then Sync to Stripe. Only synced active plans appear on Pricing for users to buy."
            />

            {error ? (
                <p className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    {error}
                </p>
            ) : null}

            <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
                <section className="glass-strong space-y-4 rounded-2xl p-5 sm:p-6">
                    <div className="flex items-center justify-between gap-3">
                        <h2 className="text-sm font-semibold text-slate-900">
                            {editingId ? "Edit plan" : "New plan"}
                        </h2>
                        {editingId ? (
                            <button
                                type="button"
                                onClick={resetForm}
                                className="text-xs font-semibold text-slate-600 hover:text-slate-900"
                            >
                                Cancel edit
                            </button>
                        ) : null}
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                        <label className="block text-sm sm:col-span-2">
                            <span className="text-slate-600">Name</span>
                            <input
                                value={form.name}
                                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                                disabled={!canUpdate}
                                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2"
                                placeholder="Pro"
                            />
                        </label>
                        <label className="block text-sm">
                            <span className="text-slate-600">Slug</span>
                            <input
                                value={form.slug}
                                onChange={(e) => setForm((p) => ({ ...p, slug: e.target.value }))}
                                disabled={!canUpdate}
                                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2"
                                placeholder="pro (auto from name)"
                            />
                        </label>
                        <label className="block text-sm">
                            <span className="text-slate-600">Price (USD)</span>
                            <input
                                value={form.amountDollars}
                                onChange={(e) =>
                                    setForm((p) => ({ ...p, amountDollars: e.target.value }))
                                }
                                disabled={!canUpdate}
                                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2"
                                inputMode="decimal"
                            />
                        </label>
                        <label className="block text-sm">
                            <span className="text-slate-600">Interval</span>
                            <select
                                value={form.interval}
                                onChange={(e) =>
                                    setForm((p) => ({
                                        ...p,
                                        interval: e.target.value as "month" | "year",
                                    }))
                                }
                                disabled={!canUpdate}
                                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2"
                            >
                                <option value="month">Monthly</option>
                                <option value="year">Yearly</option>
                            </select>
                        </label>
                        <label className="block text-sm">
                            <span className="text-slate-600">Sort order</span>
                            <input
                                value={form.sortOrder}
                                onChange={(e) => setForm((p) => ({ ...p, sortOrder: e.target.value }))}
                                disabled={!canUpdate}
                                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2"
                            />
                        </label>
                        <label className="block text-sm sm:col-span-2">
                            <span className="text-slate-600">Description</span>
                            <input
                                value={form.description}
                                onChange={(e) =>
                                    setForm((p) => ({ ...p, description: e.target.value }))
                                }
                                disabled={!canUpdate}
                                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2"
                            />
                        </label>
                        <label className="block text-sm sm:col-span-2">
                            <span className="text-slate-600">Features (one per line)</span>
                            <textarea
                                value={form.featuresText}
                                onChange={(e) =>
                                    setForm((p) => ({ ...p, featuresText: e.target.value }))
                                }
                                disabled={!canUpdate}
                                rows={4}
                                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2"
                            />
                        </label>
                    </div>

                    <div className="flex flex-wrap gap-4 text-sm">
                        <label className="inline-flex items-center gap-2">
                            <input
                                type="checkbox"
                                checked={form.active}
                                onChange={(e) => setForm((p) => ({ ...p, active: e.target.checked }))}
                                disabled={!canUpdate}
                            />
                            Active (show after sync)
                        </label>
                        <label className="inline-flex items-center gap-2">
                            <input
                                type="checkbox"
                                checked={form.highlighted}
                                onChange={(e) =>
                                    setForm((p) => ({ ...p, highlighted: e.target.checked }))
                                }
                                disabled={!canUpdate}
                            />
                            Highlighted on Pricing
                        </label>
                    </div>

                    <div>
                        <p className="text-sm font-semibold text-slate-900">Feature limits</p>
                        <p className="mt-1 text-xs text-slate-600">
                            Applied after invoice.paid marks the subscription active. Use blank /
                            unlimited for no cap.
                        </p>
                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                            {FEATURE_LIMIT_KEYS.map((key) => (
                                <label key={key} className="block text-sm">
                                    <span className="text-slate-600">{LIMIT_LABELS[key]}</span>
                                    <input
                                        value={form.limits[key] === null ? "" : String(form.limits[key])}
                                        onChange={(e) => setLimit(key, e.target.value)}
                                        disabled={!canUpdate}
                                        placeholder="unlimited"
                                        className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2"
                                    />
                                </label>
                            ))}
                        </div>
                        <label className="mt-3 block text-sm">
                            <span className="text-slate-600">Limit period</span>
                            <select
                                value={form.limitPeriod}
                                onChange={(e) =>
                                    setForm((p) => ({
                                        ...p,
                                        limitPeriod: e.target.value as FeatureLimitPeriod,
                                    }))
                                }
                                disabled={!canUpdate}
                                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2"
                            >
                                <option value="calendar_month">Calendar month</option>
                                <option value="lifetime">Lifetime</option>
                            </select>
                        </label>
                    </div>

                    {canUpdate ? (
                        <button
                            type="button"
                            onClick={() => void save()}
                            disabled={saving || !form.name.trim()}
                            className="inline-flex items-center justify-center rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-800 disabled:opacity-60"
                        >
                            {saving ? "Saving…" : editingId ? "Save changes" : "Create plan"}
                        </button>
                    ) : (
                        <p className="text-xs text-slate-600">You have read-only access.</p>
                    )}
                </section>

                <section className="space-y-3">
                    <h2 className="text-sm font-semibold text-slate-900">Plans</h2>
                    {loading ? (
                        <p className="text-sm text-slate-600">Loading…</p>
                    ) : plans.length === 0 ? (
                        <p className="glass rounded-2xl p-5 text-sm text-slate-600">
                            No plans yet. Create one on the left, then sync it to Stripe.
                        </p>
                    ) : (
                        plans.map((plan) => {
                            const badge = syncBadge(plan);
                            return (
                                <article key={plan.id} className="glass rounded-2xl p-4">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <p className="font-semibold text-slate-900">
                                                {plan.name}{" "}
                                                <span className="text-xs font-normal text-slate-500">
                                                    ({plan.slug})
                                                </span>
                                            </p>
                                            <p className="mt-1 text-sm text-slate-600">
                                                ${(plan.amountCents / 100).toFixed(2)} / {plan.interval}
                                                {!plan.active ? " · inactive" : ""}
                                            </p>
                                        </div>
                                        <span
                                            className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${badge.className}`}
                                        >
                                            {badge.label}
                                        </span>
                                    </div>
                                    {plan.lastSyncError ? (
                                        <p className="mt-2 text-xs text-rose-600">{plan.lastSyncError}</p>
                                    ) : null}
                                    {plan.stripePriceId ? (
                                        <p className="mt-2 truncate font-mono text-[11px] text-slate-500">
                                            {plan.stripePriceId}
                                        </p>
                                    ) : null}
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        <button
                                            type="button"
                                            onClick={() => startEdit(plan)}
                                            className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-200"
                                        >
                                            Edit
                                        </button>
                                        {canUpdate ? (
                                            <>
                                                <button
                                                    type="button"
                                                    onClick={() => void sync(plan.id)}
                                                    disabled={syncingId === plan.id}
                                                    className="rounded-lg bg-brand-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-800 disabled:opacity-60"
                                                >
                                                    {syncingId === plan.id
                                                        ? "Syncing…"
                                                        : "Sync to Stripe"}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => void remove(plan.id)}
                                                    className="rounded-lg bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                                                >
                                                    Delete
                                                </button>
                                            </>
                                        ) : null}
                                    </div>
                                </article>
                            );
                        })
                    )}
                </section>
            </div>
        </PageContainer>
    );
}
