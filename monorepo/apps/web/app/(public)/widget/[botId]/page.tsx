"use client";

import { use, useEffect, useMemo, useRef, useState } from "react";
import { parseJsonResponse } from "@/lib/chatbot/parseJsonResponse";
import {
    AUTO_ESCALATION_SYSTEM_PROMPT,
    AUTO_ESCALATION_THANKS_PROMPT,
} from "@/lib/chatbot/escalationConstants";

type WidgetConfig = {
    primaryColor?: string;
};

type WidgetMessage = {
    id: string;
    role: "bot" | "user" | "system" | "agent";
    text: string;
    /** When true, render an inline "Talk to human" button under this message. */
    offerEscalation?: boolean;
};

type EscalationReason = "user_request" | "low_confidence" | "manual";

type EscalationView =
    | { kind: "hidden" }
    | { kind: "form"; reason: EscalationReason; prefilledMessage: string }
    | { kind: "submitted"; email: string };

type StreamServerMessage = {
    id: string;
    role: "user" | "bot" | "agent" | "system";
    content: string;
    createdAt: string;
};

type StreamEvent =
    | { type: "hello"; widgetSessionId: string; since: string }
    | { type: "message"; message: StreamServerMessage }
    | { type: "takeover"; active: boolean };

const DEFAULT_PRIMARY = "#0f766e";
const HEX_COLOR_REGEX = /^#[0-9a-fA-F]{6}$/;
const HUMAN_PHRASE_REGEX = /\b(talk|speak|chat)\s+(to\s+)?(a\s+)?(human|agent|person|real\s+person|someone)\b/i;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TRANSCRIPT_LIMIT = 20;
const LOW_CONFIDENCE_THRESHOLD = 2;

function isHexColor(value: string | undefined): value is string {
    return typeof value === "string" && HEX_COLOR_REGEX.test(value);
}

function makeId() {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function resolveWidgetSessionId(botId: string): string {
    if (typeof window === "undefined") return "";
    const key = `cb-widget-session:${botId}`;
    try {
        const existing = window.localStorage.getItem(key);
        if (existing) return existing;
        const next = `ws_${makeId()}`;
        window.localStorage.setItem(key, next);
        return next;
    } catch {
        return `ws_${makeId()}`;
    }
}

export default function WidgetPage({ params }: { params: Promise<{ botId: string }> }) {
    const { botId: routeBotId } = use(params);
    const botId = routeBotId?.trim() ?? "";
    const [primaryColor, setPrimaryColor] = useState(DEFAULT_PRIMARY);
    const [messages, setMessages] = useState<WidgetMessage[]>([
        { id: "welcome", role: "bot", text: "Hey there! How can I help you today?" },
    ]);
    const [messageText, setMessageText] = useState("");
    const [isSending, setIsSending] = useState(false);
    const [statusText, setStatusText] = useState("Online");
    const [errorText, setErrorText] = useState<string | null>(null);
    const [escalation, setEscalation] = useState<EscalationView>({ kind: "hidden" });
    const [widgetSessionId, setWidgetSessionId] = useState<string>("");
    const [liveActive, setLiveActive] = useState(false);
    const [autoEscalationPending, setAutoEscalationPending] = useState(false);
    const bottomRef = useRef<HTMLDivElement | null>(null);
    const lowConfidenceStreakRef = useRef(0);
    const escalationOfferedRef = useRef(false);
    const seenServerIdsRef = useRef<Set<string>>(new Set());

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ block: "end" });
    }, [messages, isSending, escalation]);

    useEffect(() => {
        if (!botId) {
            setErrorText("Missing bot id.");
            setStatusText("Unavailable");
            return;
        }
        setWidgetSessionId(resolveWidgetSessionId(botId));

        let cancelled = false;

        fetch(`/api/chatbot/widget/config/${encodeURIComponent(botId)}`)
            .then((res) => parseJsonResponse<WidgetConfig>(res).then((data) => ({ res, data })))
            .then(({ res, data }) => {
                if (cancelled) return;
                if (!res.ok) {
                    throw new Error((data as { error?: string }).error || "Unable to load chatbot config");
                }
                if (isHexColor(data.primaryColor)) {
                    setPrimaryColor(data.primaryColor);
                }
                setErrorText(null);
                setStatusText("Online");
            })
            .catch((error: unknown) => {
                if (cancelled) return;
                setErrorText(error instanceof Error ? error.message : "Unable to load chatbot config");
                setStatusText("Offline");
            });

        return () => {
            cancelled = true;
        };
    }, [botId]);

    useEffect(() => {
        if (!botId || !widgetSessionId) return;
        let cancelled = false;
        fetch(
            `/api/chatbot/widget/escalation/status?botId=${encodeURIComponent(
                botId,
            )}&widgetSessionId=${encodeURIComponent(widgetSessionId)}`,
        )
            .then((res) => (res.ok ? res.json() : null))
            .then((data) => {
                if (cancelled || !data) return;
                if (data.hasOpenEscalation && !data.hasEmail && data.reason === "low_confidence") {
                    setAutoEscalationPending(true);
                }
            })
            .catch(() => {
                /* ignore */
            });
        return () => {
            cancelled = true;
        };
    }, [botId, widgetSessionId]);

    useEffect(() => {
        if (!botId || !widgetSessionId) return;
        const since = new Date().toISOString();
        const es = new EventSource(
            `/api/chatbot/widget/stream?botId=${encodeURIComponent(botId)}&widgetSessionId=${encodeURIComponent(
                widgetSessionId,
            )}&since=${encodeURIComponent(since)}`,
        );
        es.onmessage = (ev) => {
            try {
                const data = JSON.parse(ev.data) as StreamEvent;
                if (data.type === "message") {
                    const m = data.message;
                    if (seenServerIdsRef.current.has(m.id)) return;
                    seenServerIdsRef.current.add(m.id);
                    if (m.role === "agent") {
                        setMessages((cur) => [
                            ...cur,
                            { id: `srv-${m.id}`, role: "agent", text: m.content },
                        ]);
                    } else if (m.role === "system") {
                        setMessages((cur) => [
                            ...cur,
                            { id: `srv-${m.id}`, role: "system", text: m.content },
                        ]);
                        if (m.content === AUTO_ESCALATION_SYSTEM_PROMPT) {
                            setAutoEscalationPending(true);
                        } else if (m.content === AUTO_ESCALATION_THANKS_PROMPT) {
                            setAutoEscalationPending(false);
                        }
                    }
                } else if (data.type === "takeover") {
                    setLiveActive(data.active);
                }
            } catch {
                /* ignore */
            }
        };
        return () => {
            es.close();
        };
    }, [botId, widgetSessionId]);

    const heroStyle = useMemo(
        () => ({ background: `linear-gradient(135deg, ${primaryColor} 0%, #0f172a 100%)` }),
        [primaryColor],
    );

    function lastUserMessage(): string {
        for (let i = messages.length - 1; i >= 0; i -= 1) {
            const m = messages[i]!;
            if (m.role === "user") return m.text;
        }
        return "";
    }

    function openEscalationForm(reason: EscalationReason, prefilledMessage: string) {
        setEscalation({ kind: "form", reason, prefilledMessage });
    }

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const trimmed = messageText.trim();
        if (!trimmed || isSending) return;

        if (HUMAN_PHRASE_REGEX.test(trimmed)) {
            setMessageText("");
            setMessages((current) => [
                ...current,
                { id: makeId(), role: "user", text: trimmed },
            ]);
            openEscalationForm("user_request", trimmed);
            return;
        }

        const userMessage: WidgetMessage = { id: makeId(), role: "user", text: trimmed };
        setMessages((current) => [...current, userMessage]);
        setMessageText("");
        setIsSending(true);

        try {
            const response = await fetch("/api/chatbot/widget/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ botId, message: trimmed, widgetSessionId }),
            });
            const data = await parseJsonResponse<{
                reply?: string;
                error?: string;
                num_contexts?: number;
                live?: boolean;
            }>(response);

            if (!response.ok) {
                throw new Error(data.error || "Something went wrong.");
            }

            if (data.live) {
                lowConfidenceStreakRef.current = 0;
                setMessages((current) => [
                    ...current,
                    {
                        id: makeId(),
                        role: "system",
                        text: data.reply || "An agent will reply here shortly.",
                    },
                ]);
            } else {
                const numContexts = typeof data.num_contexts === "number" ? data.num_contexts : 0;
                if (numContexts <= 0) {
                    lowConfidenceStreakRef.current += 1;
                } else {
                    lowConfidenceStreakRef.current = 0;
                }

                const offerNow =
                    lowConfidenceStreakRef.current >= LOW_CONFIDENCE_THRESHOLD && !escalationOfferedRef.current;
                if (offerNow) {
                    escalationOfferedRef.current = true;
                }

                setMessages((current) => [
                    ...current,
                    {
                        id: makeId(),
                        role: "bot",
                        text: data.reply || "Thanks for your message.",
                        offerEscalation: offerNow,
                    },
                ]);
            }
        } catch (error: unknown) {
            setMessages((current) => [
                ...current,
                {
                    id: makeId(),
                    role: "bot",
                    text: error instanceof Error ? error.message : "Sorry, could not reach the server. Please try again.",
                },
            ]);
        } finally {
            setIsSending(false);
        }
    }

    return (
        <div className="flex h-screen flex-col overflow-hidden bg-[#f8fafc] text-slate-900">
            <header className="flex items-center justify-between px-4 py-4 text-white" style={heroStyle}>
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-sm font-semibold backdrop-blur">
                        AI
                    </div>
                    <div>
                        <p className="text-sm font-semibold">Support Assistant</p>
                        <p className="text-xs text-white/80">
                            {liveActive ? (
                                <span className="inline-flex items-center gap-1.5">
                                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
                                    Agent connected
                                </span>
                            ) : (
                                statusText
                            )}
                        </p>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={() => openEscalationForm("manual", lastUserMessage())}
                    disabled={escalation.kind !== "hidden"}
                    className="rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/25 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    Talk to human
                </button>
            </header>

            <div className="relative flex-1 overflow-y-auto bg-[radial-gradient(circle_at_top,rgba(15,118,110,0.08),transparent_32%),linear-gradient(180deg,#f8fafc_0%,#ffffff_100%)] px-4 py-4">
                <div className="space-y-3">
                    {errorText ? (
                        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                            {errorText}
                        </div>
                    ) : null}

                    {messages.map((message) => {
                        if (message.role === "system") {
                            return (
                                <div
                                    key={message.id}
                                    className="mx-auto max-w-[80%] rounded-full bg-slate-100 px-3 py-1 text-center text-[11px] text-slate-600"
                                >
                                    {message.text}
                                </div>
                            );
                        }
                        const isUser = message.role === "user";
                        const isAgent = message.role === "agent";
                        return (
                            <div key={message.id} className="space-y-2">
                                <div
                                    className={`max-w-[86%] rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm ${isUser
                                        ? "ml-auto text-white"
                                        : isAgent
                                            ? "border border-emerald-200 bg-emerald-50 text-slate-800"
                                            : "border border-slate-200 bg-white text-slate-800"
                                        }`}
                                    style={isUser ? { backgroundColor: primaryColor } : undefined}
                                >
                                    {isAgent ? (
                                        <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                                            Agent
                                        </span>
                                    ) : null}
                                    {message.text}
                                </div>
                                {message.offerEscalation ? (
                                    <button
                                        type="button"
                                        onClick={() => openEscalationForm("low_confidence", lastUserMessage())}
                                        className="rounded-full border px-3 py-1.5 text-xs font-semibold transition hover:bg-slate-50"
                                        style={{ borderColor: primaryColor, color: primaryColor }}
                                    >
                                        Talk to a human →
                                    </button>
                                ) : null}
                            </div>
                        );
                    })}

                    {isSending ? (
                        <div className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500 shadow-sm">
                            <span className="h-2 w-2 animate-pulse rounded-full" style={{ backgroundColor: primaryColor }} />
                            Thinking...
                        </div>
                    ) : null}
                    <div ref={bottomRef} />
                </div>

                {autoEscalationPending && escalation.kind === "hidden" ? (
                    <AutoEscalationEmailPrompt
                        botId={botId}
                        widgetSessionId={widgetSessionId}
                        primaryColor={primaryColor}
                        onSubmitted={() => setAutoEscalationPending(false)}
                    />
                ) : null}
                {escalation.kind === "form" ? (
                    <EscalationFormOverlay
                        botId={botId}
                        widgetSessionId={widgetSessionId}
                        reason={escalation.reason}
                        prefilledMessage={escalation.prefilledMessage}
                        primaryColor={primaryColor}
                        transcript={messages}
                        onClose={() => setEscalation({ kind: "hidden" })}
                        onSubmitted={(email) => setEscalation({ kind: "submitted", email })}
                    />
                ) : null}
                {escalation.kind === "submitted" ? (
                    <SubmittedOverlay
                        email={escalation.email}
                        primaryColor={primaryColor}
                        onClose={() => setEscalation({ kind: "hidden" })}
                    />
                ) : null}
            </div>

            <form className="border-t border-slate-200 bg-white p-3" onSubmit={handleSubmit}>
                <div className="flex items-end gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-2 shadow-sm">
                    <label className="sr-only" htmlFor="widget-message">Type your message</label>
                    <input
                        id="widget-message"
                        type="text"
                        value={messageText}
                        onChange={(event) => setMessageText(event.target.value)}
                        placeholder="Type a message..."
                        className="min-h-11 flex-1 rounded-xl border border-transparent bg-transparent px-3 py-2 text-sm outline-none placeholder:text-slate-400"
                        disabled={isSending || Boolean(errorText)}
                    />
                    <button
                        type="submit"
                        disabled={isSending || !messageText.trim() || Boolean(errorText)}
                        className="min-h-11 rounded-xl px-4 py-2 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60"
                        style={{ backgroundColor: primaryColor }}
                    >
                        {isSending ? "Sending" : "Send"}
                    </button>
                </div>
                <p className="mt-2 text-center text-[11px] text-slate-500">
                    Messages are processed on our servers, not in the customer site script.
                </p>
            </form>
        </div>
    );
}

function EscalationFormOverlay(props: {
    botId: string;
    widgetSessionId: string;
    reason: EscalationReason;
    prefilledMessage: string;
    primaryColor: string;
    transcript: WidgetMessage[];
    onClose: () => void;
    onSubmitted: (email: string) => void;
}) {
    const { botId, widgetSessionId, reason, prefilledMessage, primaryColor, transcript, onClose, onSubmitted } = props;
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [message, setMessage] = useState(prefilledMessage);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (submitting) return;
        if (!name.trim()) {
            setError("Please enter your name.");
            return;
        }
        if (!EMAIL_REGEX.test(email.trim())) {
            setError("Please enter a valid email address.");
            return;
        }
        if (!widgetSessionId) {
            setError("Session not initialized. Refresh and try again.");
            return;
        }
        setSubmitting(true);
        setError(null);

        const transcriptPayload = transcript
            .filter((m) => m.role === "user" || m.role === "bot")
            .slice(-TRANSCRIPT_LIMIT)
            .map((m) => ({ role: m.role as "user" | "bot", content: m.text, createdAt: new Date().toISOString() }));

        try {
            const res = await fetch("/api/chatbot/widget/escalation", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    botId,
                    widgetSessionId,
                    contact: { name: name.trim(), email: email.trim() },
                    message: message.trim(),
                    reason,
                    transcript: transcriptPayload,
                }),
            });
            const data = await parseJsonResponse<{ ticketId?: string; error?: string }>(res);
            if (!res.ok) {
                throw new Error(data.error || "Could not submit your request.");
            }
            onSubmitted(email.trim());
        } catch (err) {
            setError(err instanceof Error ? err.message : "Could not submit your request.");
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div className="absolute inset-0 z-10 flex flex-col bg-white">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                <h3 className="text-sm font-semibold text-slate-900">Talk to a human</h3>
                <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close"
                    className="rounded-full p-1 text-slate-500 hover:bg-slate-100"
                >
                    ×
                </button>
            </div>
            <form className="flex flex-1 flex-col gap-3 overflow-y-auto p-4" onSubmit={onSubmit}>
                <p className="text-xs text-slate-600">
                    Leave your details and we&apos;ll get back to you by email.
                </p>
                <div>
                    <label htmlFor="esc-name" className="mb-1 block text-xs font-semibold text-slate-700">Name</label>
                    <input
                        id="esc-name"
                        type="text"
                        required
                        maxLength={100}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                        disabled={submitting}
                    />
                </div>
                <div>
                    <label htmlFor="esc-email" className="mb-1 block text-xs font-semibold text-slate-700">Email</label>
                    <input
                        id="esc-email"
                        type="email"
                        required
                        maxLength={254}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                        disabled={submitting}
                    />
                </div>
                <div>
                    <label htmlFor="esc-message" className="mb-1 block text-xs font-semibold text-slate-700">
                        Message <span className="font-normal text-slate-500">(optional)</span>
                    </label>
                    <textarea
                        id="esc-message"
                        rows={4}
                        maxLength={500}
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                        disabled={submitting}
                    />
                </div>
                {error ? (
                    <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                        {error}
                    </div>
                ) : null}
                <button
                    type="submit"
                    disabled={submitting}
                    className="mt-2 rounded-xl px-4 py-2 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60"
                    style={{ backgroundColor: primaryColor }}
                >
                    {submitting ? "Sending..." : "Send request"}
                </button>
            </form>
        </div>
    );
}

function AutoEscalationEmailPrompt(props: {
    botId: string;
    widgetSessionId: string;
    primaryColor: string;
    onSubmitted: () => void;
}) {
    const { botId, widgetSessionId, primaryColor, onSubmitted } = props;
    const [email, setEmail] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (submitting) return;
        const trimmed = email.trim();
        if (!EMAIL_REGEX.test(trimmed)) {
            setError("Please enter a valid email address.");
            return;
        }
        setSubmitting(true);
        setError(null);
        try {
            const res = await fetch("/api/chatbot/widget/escalation/contact", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ botId, widgetSessionId, email: trimmed }),
            });
            const data = await parseJsonResponse<{ ok?: boolean; error?: string }>(res);
            if (!res.ok || !data.ok) {
                throw new Error(data.error || "Could not save your email.");
            }
            onSubmitted();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Could not save your email.");
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <form
            onSubmit={onSubmit}
            className="mx-auto mt-2 flex max-w-[90%] flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm"
        >
            <label htmlFor="auto-esc-email" className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                Your email
            </label>
            <div className="flex gap-2">
                <input
                    id="auto-esc-email"
                    type="email"
                    required
                    maxLength={254}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="min-h-9 flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none"
                    disabled={submitting}
                />
                <button
                    type="submit"
                    disabled={submitting || !email.trim()}
                    className="min-h-9 rounded-xl px-3 py-2 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60"
                    style={{ backgroundColor: primaryColor }}
                >
                    {submitting ? "..." : "Connect"}
                </button>
            </div>
            {error ? (
                <p className="text-xs text-rose-600">{error}</p>
            ) : null}
        </form>
    );
}

function SubmittedOverlay(props: { email: string; primaryColor: string; onClose: () => void }) {
    const { email, primaryColor, onClose } = props;
    return (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-white p-6 text-center">
            <div
                className="flex h-12 w-12 items-center justify-center rounded-full text-white"
                style={{ backgroundColor: primaryColor }}
            >
                ✓
            </div>
            <h3 className="text-base font-semibold text-slate-900">Thanks — we&apos;ll be in touch.</h3>
            <p className="max-w-xs text-sm text-slate-600">
                Someone will reach out at <strong>{email}</strong> shortly.
            </p>
            <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
                Back to chat
            </button>
        </div>
    );
}
