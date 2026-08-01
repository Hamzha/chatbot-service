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
import type { WidgetMessageRecord } from "@/lib/db/widgetMessageRepo";

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

type StreamEvent =
    | { type: "hello"; ticketId: string; since: string; takeoverActive: boolean; status: EscalationStatus }
    | { type: "message"; message: WidgetMessageRecord }
    | { type: "takeover"; active: boolean }
    | { type: "status"; status: EscalationStatus };

export function TicketClient({ ticketId }: { ticketId: string }) {
    const [record, setRecord] = useState<EscalationRecord | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [notesDraft, setNotesDraft] = useState("");
    const [liveMessages, setLiveMessages] = useState<WidgetMessageRecord[]>([]);
    const [streamConnected, setStreamConnected] = useState(false);
    const [agentDraft, setAgentDraft] = useState("");
    const [sending, setSending] = useState(false);
    const [takeoverPending, setTakeoverPending] = useState(false);
    const notesTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const transcriptEndRef = useRef<HTMLDivElement | null>(null);
    const seenMessageIdsRef = useRef<Set<string>>(new Set());

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [ticketRes, messagesRes] = await Promise.all([
                fetch(`/api/chatbot/escalations/${encodeURIComponent(ticketId)}`),
                fetch(`/api/chatbot/escalations/${encodeURIComponent(ticketId)}/messages?limit=200`),
            ]);
            const ticketData = await parseJsonResponse<{ escalation?: EscalationRecord }>(ticketRes);
            assertOkJson(ticketRes, ticketData);
            const rec = ticketData.escalation ?? null;
            setRecord(rec);
            setNotesDraft(rec?.notes ?? "");

            if (messagesRes.ok) {
                const msgData = await parseJsonResponse<{ messages?: WidgetMessageRecord[] }>(messagesRes);
                const msgs = msgData.messages ?? [];
                seenMessageIdsRef.current = new Set(msgs.map((m) => m.id));
                setLiveMessages(msgs);
            } else {
                seenMessageIdsRef.current = new Set();
                setLiveMessages([]);
            }
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

    useEffect(() => {
        if (!record) return;
        const sinceParam = liveMessages.length > 0
            ? liveMessages[liveMessages.length - 1]!.createdAt
            : record.createdAt;
        const es = new EventSource(
            `/api/chatbot/escalations/${encodeURIComponent(ticketId)}/stream?since=${encodeURIComponent(sinceParam)}`,
        );
        es.onopen = () => setStreamConnected(true);
        es.onerror = () => setStreamConnected(false);
        es.onmessage = (ev) => {
            try {
                const data = JSON.parse(ev.data) as StreamEvent;
                if (data.type === "message") {
                    if (seenMessageIdsRef.current.has(data.message.id)) return;
                    seenMessageIdsRef.current.add(data.message.id);
                    setLiveMessages((cur) => [...cur, data.message]);
                } else if (data.type === "takeover") {
                    setRecord((cur) =>
                        cur
                            ? {
                                ...cur,
                                liveTakeover: { ...cur.liveTakeover, active: data.active },
                            }
                            : cur,
                    );
                } else if (data.type === "status") {
                    setRecord((cur) => (cur ? { ...cur, status: data.status } : cur));
                }
            } catch {
                /* ignore */
            }
        };
        return () => {
            es.close();
            setStreamConnected(false);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [record?.id, ticketId]);

    useEffect(() => {
        transcriptEndRef.current?.scrollIntoView({ block: "end" });
    }, [liveMessages.length]);

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

    async function toggleTakeover(next: "start" | "end") {
        if (takeoverPending) return;
        setTakeoverPending(true);
        try {
            const res = await fetch(`/api/chatbot/escalations/${encodeURIComponent(ticketId)}/takeover`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: next }),
            });
            const data = await parseJsonResponse<{ escalation?: EscalationRecord; error?: string }>(res);
            if (!res.ok) {
                toast.error(formatApiErrorMessage(data, res.status));
                return;
            }
            if (data.escalation) setRecord(data.escalation);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : String(err));
        } finally {
            setTakeoverPending(false);
        }
    }

    async function sendAgentMessage(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const content = agentDraft.trim();
        if (!content || sending) return;
        setSending(true);
        try {
            const res = await fetch(`/api/chatbot/escalations/${encodeURIComponent(ticketId)}/messages`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ content }),
            });
            const data = await parseJsonResponse<{ message?: WidgetMessageRecord; error?: string }>(res);
            if (!res.ok) {
                toast.error(formatApiErrorMessage(data, res.status));
                return;
            }
            if (data.message && !seenMessageIdsRef.current.has(data.message.id)) {
                seenMessageIdsRef.current.add(data.message.id);
                setLiveMessages((cur) => [...cur, data.message!]);
            }
            setAgentDraft("");
        } catch (err) {
            toast.error(err instanceof Error ? err.message : String(err));
        } finally {
            setSending(false);
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

    const takeoverActive = record?.liveTakeover.active ?? false;
    const canTakeOver = record && record.status !== "resolved";

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
                            {record.contact.name || record.contact.email ? (
                                <>
                                    <p className="text-base font-semibold text-slate-900">
                                        {record.contact.name || "Visitor"}
                                    </p>
                                    {record.contact.email ? (
                                        <p className="mt-1 text-sm">
                                            <a className="text-brand-800 hover:underline" href={`mailto:${record.contact.email}`}>
                                                {record.contact.email}
                                            </a>
                                        </p>
                                    ) : (
                                        <p className="mt-1 text-xs italic text-slate-500">
                                            Email not yet provided
                                        </p>
                                    )}
                                </>
                            ) : (
                                <p className="text-base font-semibold text-slate-900">
                                    Anonymous visitor
                                    <span className="ml-2 text-xs font-normal italic text-slate-500">
                                        (auto-escalated — awaiting email)
                                    </span>
                                </p>
                            )}
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
                            <div className="mb-3 flex items-center justify-between gap-3">
                                <div>
                                    <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-600">
                                        Live conversation
                                    </h2>
                                    <p className="mt-1 text-[11px] text-slate-500">
                                        {streamConnected ? (
                                            <span className="inline-flex items-center gap-1">
                                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Live
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1">
                                                <span className="h-1.5 w-1.5 rounded-full bg-slate-300" /> Connecting…
                                            </span>
                                        )}
                                    </p>
                                </div>
                                {canTakeOver ? (
                                    takeoverActive ? (
                                        <button
                                            type="button"
                                            onClick={() => void toggleTakeover("end")}
                                            disabled={takeoverPending}
                                            className="rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-60"
                                        >
                                            {takeoverPending ? "Ending…" : "End takeover"}
                                        </button>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() => void toggleTakeover("start")}
                                            disabled={takeoverPending}
                                            className="rounded-xl bg-brand-700 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-800 disabled:opacity-60"
                                        >
                                            {takeoverPending ? "Starting…" : "Take over"}
                                        </button>
                                    )
                                ) : null}
                            </div>

                            <LiveTranscript messages={liveMessages} fallbackSnapshot={record.transcriptSnapshot} />
                            <div ref={transcriptEndRef} />

                            {takeoverActive ? (
                                <form className="mt-3 flex items-end gap-2" onSubmit={sendAgentMessage}>
                                    <input
                                        type="text"
                                        value={agentDraft}
                                        onChange={(e) => setAgentDraft(e.target.value)}
                                        placeholder="Reply to the customer…"
                                        maxLength={8000}
                                        className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                                        disabled={sending}
                                    />
                                    <button
                                        type="submit"
                                        disabled={sending || !agentDraft.trim()}
                                        className="rounded-xl bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60"
                                    >
                                        {sending ? "Sending…" : "Send"}
                                    </button>
                                </form>
                            ) : null}
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

function LiveTranscript({
    messages,
    fallbackSnapshot,
}: {
    messages: WidgetMessageRecord[];
    fallbackSnapshot: EscalationRecord["transcriptSnapshot"];
}) {
    if (messages.length === 0) {
        if (fallbackSnapshot.length === 0) {
            return <p className="text-sm italic text-slate-600">No conversation yet.</p>;
        }
        return (
            <div className="space-y-2">
                <p className="text-[11px] italic text-slate-500">Snapshot at submission:</p>
                {fallbackSnapshot.map((entry, idx) => (
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
        );
    }
    return (
        <div className="space-y-2">
            {messages.map((m) => {
                if (m.role === "system") {
                    return (
                        <div key={m.id} className="mx-auto rounded-full bg-slate-100 px-3 py-1 text-center text-[11px] text-slate-600">
                            {m.content}
                        </div>
                    );
                }
                const isUser = m.role === "user";
                const isAgent = m.role === "agent";
                return (
                    <div
                        key={m.id}
                        className={`max-w-[88%] rounded-2xl px-3 py-2 text-sm leading-6 ${isUser
                            ? "ml-auto bg-brand-700 text-white"
                            : isAgent
                                ? "border border-emerald-200 bg-emerald-50 text-slate-800"
                                : "border border-slate-200 bg-white text-slate-800"
                            }`}
                    >
                        {isAgent ? (
                            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                                Agent
                            </span>
                        ) : null}
                        {m.content}
                    </div>
                );
            })}
        </div>
    );
}
