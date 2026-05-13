"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { PageContainer } from "@/components/shell/PageContainer";
import { PageHeader } from "@/components/shell/PageHeader";
import {
    assertOkJson,
    formatApiErrorMessage,
    parseJsonResponse,
} from "@/lib/chatbot/parseJsonResponse";
import { toast } from "@/lib/ui/toast";
import type {
    EscalationRecord,
    EscalationStatus,
} from "@/lib/db/escalationRepo";

const STATUS_LABEL: Record<EscalationStatus, string> = {
    open: "Open",
    in_progress: "In progress",
    resolved: "Resolved",
};

const REASON_LABEL: Record<EscalationRecord["reason"], string> = {
    user_request: "User request",
    low_confidence: "Low confidence",
    manual: "Manual",
};

export function TicketClient({ ticketId }: { ticketId: string }) {
    const [record, setRecord] = useState<EscalationRecord | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [notesDraft, setNotesDraft] = useState("");
    const notesTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/chatbot/escalations/${encodeURIComponent(ticketId)}`);
            const data = await parseJsonResponse<{ escalation?: EscalationRecord }>(res);
            assertOkJson(res, data);
            const rec = data.escalation ?? null;
            setRecord(rec);
            setNotesDraft(rec?.notes ?? "");
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
            setRecord(null);
        } finally {
            setLoading(false);
        }
    }, [ticketId]);

    useEffect(() => {
        void load();
    }, [load]);

    async function patchTicket(body: { status?: EscalationStatus; notes?: string }) {
        try {
            const res = await fetch(`/api/chatbot/escalations/${encodeURIComponent(ticketId)}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            const data = await parseJsonResponse<{ escalation?: EscalationRecord; error?: string }>(res);
            if (!res.ok) {
                const msg = formatApiErrorMessage(data, res.status);
                toast.error(msg);
                return;
            }
            if (data.escalation) {
                setRecord(data.escalation);
            }
        } catch (err) {
            toast.error(err instanceof Error ? err.message : String(err));
        }
    }

    function onStatusChange(next: EscalationStatus) {
        if (!record || next === record.status) return;
        void patchTicket({ status: next });
    }

    function onNotesChange(value: string) {
        setNotesDraft(value);
        if (notesTimer.current) clearTimeout(notesTimer.current);
        notesTimer.current = setTimeout(() => {
            void patchTicket({ notes: value });
        }, 600);
    }

    return (
        <PageContainer>
            <PageHeader
                eyebrow="Support"
                title="Escalation ticket"
                actions={
                    <Link
                        href="/dashboard/inbox"
                        className="rounded-xl border border-slate-300 bg-white/60 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-white"
                    >
                        ← Back to inbox
                    </Link>
                }
            />

            {error && (
                <div className="glass rounded-2xl border-rose-300/60 p-4 text-sm text-rose-800" role="alert">
                    {error}
                </div>
            )}

            {loading ? (
                <div className="flex min-h-[40vh] items-center justify-center">
                    <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-300 border-t-brand-600" aria-hidden="true" />
                </div>
            ) : !record ? (
                <div className="glass rounded-2xl p-8 text-center text-sm text-slate-700">
                    Ticket not found.
                </div>
            ) : (
                <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
                    <div className="space-y-6">
                        <section className="glass-strong rounded-2xl p-5">
                            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-600">Contact</h2>
                            <p className="text-base font-semibold text-slate-900">{record.contact.name}</p>
                            <p className="mt-1 text-sm">
                                <a className="text-brand-800 hover:underline" href={`mailto:${record.contact.email}`}>
                                    {record.contact.email}
                                </a>
                            </p>
                            {record.message ? (
                                <>
                                    <h3 className="mt-5 mb-2 text-sm font-semibold uppercase tracking-wider text-slate-600">
                                        Their message
                                    </h3>
                                    <p className="whitespace-pre-wrap rounded-xl bg-white/40 p-3 text-sm text-slate-800">
                                        {record.message}
                                    </p>
                                </>
                            ) : null}
                        </section>

                        <section className="glass-strong rounded-2xl p-5">
                            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-600">Transcript</h2>
                            {record.transcriptSnapshot.length === 0 ? (
                                <p className="text-sm italic text-slate-600">No transcript captured.</p>
                            ) : (
                                <div className="space-y-2">
                                    {record.transcriptSnapshot.map((entry, idx) => (
                                        <div
                                            key={idx}
                                            className={`max-w-[88%] rounded-2xl px-3 py-2 text-sm leading-6 ${entry.role === "user"
                                                ? "ml-auto bg-brand-700 text-white"
                                                : "border border-slate-200 bg-white text-slate-800"
                                                }`}
                                        >
                                            {entry.content}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </section>
                    </div>

                    <aside className="space-y-4">
                        <section className="glass-strong rounded-2xl p-5">
                            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-600">Status</h2>
                            <select
                                value={record.status}
                                onChange={(e) => onStatusChange(e.target.value as EscalationStatus)}
                                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                            >
                                {(Object.keys(STATUS_LABEL) as EscalationStatus[]).map((s) => (
                                    <option key={s} value={s}>
                                        {STATUS_LABEL[s]}
                                    </option>
                                ))}
                            </select>
                            <p className="mt-3 text-xs text-slate-600">
                                Reason: <span className="font-semibold">{REASON_LABEL[record.reason]}</span>
                            </p>
                            <p className="text-xs text-slate-600">
                                Created: {new Date(record.createdAt).toLocaleString()}
                            </p>
                            {record.resolvedAt ? (
                                <p className="text-xs text-slate-600">
                                    Resolved: {new Date(record.resolvedAt).toLocaleString()}
                                </p>
                            ) : null}
                        </section>

                        <section className="glass-strong rounded-2xl p-5">
                            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-600">Internal notes</h2>
                            <textarea
                                value={notesDraft}
                                onChange={(e) => onNotesChange(e.target.value)}
                                rows={6}
                                placeholder="Private notes, only visible to your team."
                                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                            />
                            <p className="mt-2 text-[11px] text-slate-500">Saved automatically.</p>
                        </section>
                    </aside>
                </div>
            )}
        </PageContainer>
    );
}
