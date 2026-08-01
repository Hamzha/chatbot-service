"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
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

type DefaultsPayload = {
    defaults: {
        period: FeatureLimitPeriod;
        limits: FeatureLimitValues;
        updatedAt: string;
    };
};

const LIMIT_ROWS: Record<FeatureLimitKey, { title: string; hint: string }> = {
    scraperRuns: {
        title: "Scraper runs",
        hint: "One-shot scrape + crawl jobs share this quota",
    },
    documentUploads: {
        title: "Document uploads",
        hint: "PDF ingest into the knowledge base",
    },
    botsCreated: {
        title: "Chatbots",
        hint: "Sessions / bots a user can create",
    },
    dashboardChats: {
        title: "Dashboard chats",
        hint: "User messages inside the dashboard",
    },
    widgetChats: {
        title: "Widget chats",
        hint: "Visitor messages on the embed widget",
    },
};

function emptyLimits(): FeatureLimitValues {
    return {
        scraperRuns: 20,
        documentUploads: 10,
        botsCreated: 3,
        dashboardChats: 100,
        widgetChats: 200,
    };
}

export function LimitsAdminClient() {
    const [period, setPeriod] = useState<FeatureLimitPeriod>("lifetime");
    const [limits, setLimits] = useState<FeatureLimitValues>(emptyLimits());
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [canUpdate, setCanUpdate] = useState(false);
    const [updatedAt, setUpdatedAt] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [meRes, limRes] = await Promise.all([
                fetch("/api/auth/me", { credentials: "include" }),
                fetch("/api/admin/limits", { credentials: "include" }),
            ]);
            if (meRes.ok) {
                const me = (await meRes.json()) as { permissions?: string[] };
                setCanUpdate(Boolean(me.permissions?.includes("limits:update")));
            }
            if (!limRes.ok) {
                const j = (await limRes.json().catch(() => ({}))) as { error?: string };
                throw new Error(j.error || limRes.statusText);
            }
            const data = (await limRes.json()) as DefaultsPayload;
            setPeriod(data.defaults.period);
            setLimits({ ...data.defaults.limits });
            setUpdatedAt(data.defaults.updatedAt);
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
        if (trimmed === "" || trimmed.toLowerCase() === "null" || trimmed.toLowerCase() === "unlimited") {
            setLimits((prev) => ({ ...prev, [key]: null }));
            return;
        }
        const n = Number(trimmed);
        if (!Number.isFinite(n) || n < 0) return;
        setLimits((prev) => ({ ...prev, [key]: Math.floor(n) }));
    };

    const save = async () => {
        setSaving(true);
        setError(null);
        const loadingId = toast.loading("Saving feature limits…");
        try {
            const res = await fetch("/api/admin/limits", {
                method: "PUT",
                credentials: "include",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ period, limits }),
            });
            if (!res.ok) {
                const j = (await res.json().catch(() => ({}))) as { error?: string };
                throw new Error(j.error || res.statusText);
            }
            const data = (await res.json()) as DefaultsPayload;
            setPeriod(data.defaults.period);
            setLimits({ ...data.defaults.limits });
            setUpdatedAt(data.defaults.updatedAt);
            toast.success("Feature limits saved", { id: loadingId });
        } catch (e) {
            const msg = extractErrorMessage(e, "Could not save limits");
            setError(msg);
            toast.error(msg, { id: loadingId });
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <PageContainer size="5xl">
                <p className="text-sm text-slate-700" role="status">
                    Loading feature limits…
                </p>
            </PageContainer>
        );
    }

    return (
        <PageContainer size="5xl">
            <PageHeader
                variant="plain"
                eyebrow="Admin"
                title="Feature limits"
                subtitle="Trial quotas applied to every user unless you override them on Users & roles."
            />

            {error ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900" role="alert">
                    {error}
                </div>
            ) : null}

            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
                <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/80 px-5 py-4">
                        <div>
                            <h2 className="text-base font-semibold text-slate-900">Global defaults</h2>
                            <p className="mt-0.5 text-xs text-slate-600">
                                Leave a limit blank for unlimited.
                                {updatedAt ? ` · Updated ${new Date(updatedAt).toLocaleString()}` : ""}
                            </p>
                        </div>
                        {canUpdate ? (
                            <button
                                type="button"
                                onClick={() => void save()}
                                disabled={saving}
                                className="h-10 shrink-0 rounded-xl bg-brand-700 px-4 text-sm font-semibold text-white shadow-sm shadow-brand-700/20 hover:bg-brand-800 disabled:opacity-50"
                            >
                                {saving ? "Saving…" : "Save limits"}
                            </button>
                        ) : null}
                    </div>

                    <div className="border-b border-slate-100 px-5 py-4">
                        <label htmlFor="limit-period" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Reset period
                        </label>
                        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center">
                            <select
                                id="limit-period"
                                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900 sm:max-w-xs"
                                value={period}
                                disabled={!canUpdate || saving}
                                onChange={(e) => setPeriod(e.target.value as FeatureLimitPeriod)}
                            >
                                <option value="lifetime">Lifetime (never resets)</option>
                                <option value="calendar_month">Calendar month (resets 1st UTC)</option>
                            </select>
                            <p className="text-xs leading-5 text-slate-600 sm:max-w-sm">
                                Counts usage for every trial user. Per-user overrides still use this same period.
                            </p>
                        </div>
                    </div>

                    <div className="hidden grid-cols-[minmax(0,1fr)_140px] gap-4 border-b border-slate-100 bg-slate-50/50 px-5 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 sm:grid">
                        <span>Feature</span>
                        <span className="text-right">Limit</span>
                    </div>

                    <ul className="divide-y divide-slate-100">
                        {FEATURE_LIMIT_KEYS.map((key) => {
                            const row = LIMIT_ROWS[key];
                            const value = limits[key];
                            return (
                                <li
                                    key={key}
                                    className="grid grid-cols-1 items-center gap-3 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_140px]"
                                >
                                    <div className="min-w-0">
                                        <p className="text-sm font-semibold text-slate-900">{row.title}</p>
                                        <p className="mt-0.5 text-xs leading-5 text-slate-600">{row.hint}</p>
                                    </div>
                                    <div className="sm:justify-self-end">
                                        <label className="sr-only" htmlFor={`limit-${key}`}>
                                            {row.title} limit
                                        </label>
                                        <input
                                            id={`limit-${key}`}
                                            type="text"
                                            inputMode="numeric"
                                            className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold tabular-nums text-slate-900 placeholder:font-normal placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 sm:w-[140px] sm:text-right"
                                            value={value === null ? "" : String(value)}
                                            placeholder="∞"
                                            disabled={!canUpdate || saving}
                                            onChange={(e) => setLimit(key, e.target.value)}
                                        />
                                    </div>
                                </li>
                            );
                        })}
                    </ul>

                    {!canUpdate ? (
                        <div className="border-t border-amber-100 bg-amber-50 px-5 py-3 text-sm text-amber-900">
                            You can view limits but need <code className="font-mono text-xs">limits:update</code> to edit
                            them.
                        </div>
                    ) : null}
                </section>

                <aside className="space-y-4">
                    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">How it works</p>
                        <ul className="mt-3 space-y-3 text-sm leading-6 text-slate-700">
                            <li>
                                <span className="font-semibold text-slate-900">Blank = unlimited.</span> Clear a field to
                                remove the cap for that feature.
                            </li>
                            <li>
                                <span className="font-semibold text-slate-900">Scraper is shared.</span> One-shot scrape and
                                crawl jobs both count as scraper runs.
                            </li>
                            <li>
                                <span className="font-semibold text-slate-900">Widget chats</span> count against the bot
                                owner’s quota, not the visitor’s account.
                            </li>
                        </ul>
                    </div>

                    <div className="rounded-2xl border border-brand-200/70 bg-brand-50/70 p-5">
                        <p className="text-sm font-semibold text-brand-950">Per-user overrides</p>
                        <p className="mt-2 text-sm leading-6 text-brand-900/80">
                            Need a higher or lower cap for one account? Set it on that user under Users & roles.
                        </p>
                        <Link
                            href="/dashboard/admin/users"
                            className="mt-4 inline-flex h-10 items-center justify-center rounded-xl bg-brand-700 px-4 text-sm font-semibold text-white hover:bg-brand-800"
                        >
                            Open Users & roles
                        </Link>
                    </div>
                </aside>
            </div>
        </PageContainer>
    );
}
