"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { PageContainer } from "@/components/shell/PageContainer";
import { PageHeader } from "@/components/shell/PageHeader";
import { assertOkJson, parseJsonResponse } from "@/lib/chatbot/parseJsonResponse";
import type { EscalationRecord, EscalationStatus } from "@/lib/db/escalationRepo";

type StatusFilter = EscalationStatus | "all";

const STATUS_LABEL: Record<EscalationStatus, string> = {
    open: "Open",
    in_progress: "In progress",
    resolved: "Resolved",
};

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
    { value: "open", label: "Open" },
    { value: "in_progress", label: "In progress" },
    { value: "resolved", label: "Resolved" },
    { value: "all", label: "All" },
];

const REASON_LABEL: Record<EscalationRecord["reason"], string> = {
    user_request: "User request",
    low_confidence: "Low confidence",
    manual: "Manual",
};

function statusBadgeClass(status: EscalationStatus): string {
    if (status === "open") return "bg-rose-50 text-rose-700 border border-rose-200";
    if (status === "in_progress") return "bg-amber-50 text-amber-700 border border-amber-200";
    return "bg-emerald-50 text-emerald-700 border border-emerald-200";
}

export function InboxClient() {
    const [items, setItems] = useState<EscalationRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [status, setStatus] = useState<StatusFilter>("open");

    const load = useCallback(async (s: StatusFilter) => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams();
            if (s !== "all") params.set("status", s);
            const res = await fetch(`/api/chatbot/escalations?${params.toString()}`);
            const data = await parseJsonResponse<{ items?: EscalationRecord[] }>(res);
            assertOkJson(res, data);
            setItems(data.items ?? []);
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
            setItems([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void load(status);
    }, [status, load]);

    return (
        <PageContainer>
            <PageHeader
                eyebrow="Support"
                title="Inbox"
                subtitle="Visitors who asked to speak with a human. Reply by email; update status as you go."
            />

            <div className="flex flex-wrap items-center gap-2">
                {STATUS_FILTERS.map((f) => (
                    <button
                        key={f.value}
                        type="button"
                        onClick={() => setStatus(f.value)}
                        className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${status === f.value
                            ? "bg-brand-700 text-white"
                            : "bg-white/60 text-slate-700 hover:bg-white"
                            }`}
                    >
                        {f.label}
                    </button>
                ))}
            </div>

            {error && (
                <div className="glass rounded-2xl border-rose-300/60 p-4 text-sm text-rose-800" role="alert">
                    {error}
                </div>
            )}

            {loading ? (
                <div className="flex min-h-[40vh] items-center justify-center">
                    <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-300 border-t-brand-600" aria-hidden="true" />
                </div>
            ) : items.length === 0 ? (
                <div className="glass rounded-2xl p-8 text-center text-sm text-slate-700">
                    No escalations in this view.
                </div>
            ) : (
                <div className="glass-strong overflow-x-auto rounded-2xl">
                    <table className="min-w-full text-sm">
                        <thead className="bg-white/40 text-left text-xs uppercase tracking-wider text-slate-600">
                            <tr>
                                <th className="px-4 py-3">Created</th>
                                <th className="px-4 py-3">Name</th>
                                <th className="px-4 py-3">Email</th>
                                <th className="px-4 py-3">Reason</th>
                                <th className="px-4 py-3">Status</th>
                                <th className="px-4 py-3"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200/60">
                            {items.map((row) => (
                                <tr key={row.id} className="hover:bg-white/40">
                                    <td className="px-4 py-3 text-slate-700">
                                        {new Date(row.createdAt).toLocaleString()}
                                    </td>
                                    <td className="px-4 py-3 font-medium text-slate-900">{row.contact.name}</td>
                                    <td className="px-4 py-3 text-slate-700">
                                        <a className="hover:underline" href={`mailto:${row.contact.email}`}>
                                            {row.contact.email}
                                        </a>
                                    </td>
                                    <td className="px-4 py-3 text-slate-700">{REASON_LABEL[row.reason]}</td>
                                    <td className="px-4 py-3">
                                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusBadgeClass(row.status)}`}>
                                            {STATUS_LABEL[row.status]}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <Link
                                            href={`/dashboard/inbox/${row.id}`}
                                            className="text-sm font-semibold text-brand-800 hover:underline"
                                        >
                                            Open →
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </PageContainer>
    );
}
