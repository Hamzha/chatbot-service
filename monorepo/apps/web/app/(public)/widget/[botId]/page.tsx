"use client";

import { use, useEffect, useMemo, useRef, useState } from "react";
import { parseJsonResponse } from "@/lib/chatbot/parseJsonResponse";

type WidgetConfig = {
    primaryColor?: string;
};

type WidgetMessage = {
    id: string;
    role: "bot" | "user";
    text: string;
};

const DEFAULT_PRIMARY = "#0f766e";
const HEX_COLOR_REGEX = /^#[0-9a-fA-F]{6}$/;

function isHexColor(value: string | undefined): value is string {
    return typeof value === "string" && HEX_COLOR_REGEX.test(value);
}

function makeId() {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default function WidgetPage({ params }: { params: Promise<{ botId: string }> }) {
    const { botId: routeBotId } = use(params);
    const botId = routeBotId?.trim() ?? "";
    const [primaryColor, setPrimaryColor] = useState(DEFAULT_PRIMARY);
    const [messages, setMessages] = useState<WidgetMessage[]>([
        {
            id: "welcome",
            role: "bot",
            text: "Hey there! How can I help you today?",
        },
    ]);
    const [messageText, setMessageText] = useState("");
    const [isSending, setIsSending] = useState(false);
    const [statusText, setStatusText] = useState("Online");
    const [errorText, setErrorText] = useState<string | null>(null);
    const bottomRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ block: "end" });
    }, [messages, isSending]);

    useEffect(() => {
        if (!botId) {
            setErrorText("Missing bot id.");
            setStatusText("Unavailable");
            return;
        }

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

    const heroStyle = useMemo(
        () => ({
            background: `linear-gradient(135deg, ${primaryColor} 0%, #0f172a 100%)`,
        }),
        [primaryColor],
    );

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const trimmed = messageText.trim();
        if (!trimmed || isSending) return;

        const userMessage: WidgetMessage = {
            id: makeId(),
            role: "user",
            text: trimmed,
        };

        setMessages((current) => [...current, userMessage]);
        setMessageText("");
        setIsSending(true);

        try {
            const response = await fetch("/api/chatbot/widget/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ botId, message: trimmed }),
            });
            const data = await parseJsonResponse<{ reply?: string; error?: string }>(response);

            if (!response.ok) {
                throw new Error(data.error || "Something went wrong.");
            }

            setMessages((current) => [
                ...current,
                {
                    id: makeId(),
                    role: "bot",
                    text: data.reply || "Thanks for your message.",
                },
            ]);
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
                        <p className="text-xs text-white/80">{statusText}</p>
                    </div>
                </div>
                <div className="text-right text-[11px] text-white/70">
                    <p>Hosted on our domain</p>
                    <p>bot {botId.slice(0, 8) || "unknown"}</p>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto bg-[radial-gradient(circle_at_top,rgba(15,118,110,0.08),transparent_32%),linear-gradient(180deg,#f8fafc_0%,#ffffff_100%)] px-4 py-4">
                <div className="space-y-3">
                    {errorText ? (
                        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                            {errorText}
                        </div>
                    ) : null}

                    {messages.map((message) => (
                        <div
                            key={message.id}
                            className={`max-w-[86%] rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm ${message.role === "user"
                                ? "ml-auto text-white"
                                : "border border-slate-200 bg-white text-slate-800"
                                }`}
                            style={message.role === "user" ? { backgroundColor: primaryColor } : undefined}
                        >
                            {message.text}
                        </div>
                    ))}

                    {isSending ? (
                        <div className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500 shadow-sm">
                            <span className="h-2 w-2 animate-pulse rounded-full" style={{ backgroundColor: primaryColor }} />
                            Thinking...
                        </div>
                    ) : null}
                    <div ref={bottomRef} />
                </div>
            </div>

            <form className="border-t border-slate-200 bg-white p-3" onSubmit={handleSubmit}>
                <div className="flex items-end gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-2 shadow-sm">
                    <label className="sr-only" htmlFor="widget-message">
                        Type your message
                    </label>
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