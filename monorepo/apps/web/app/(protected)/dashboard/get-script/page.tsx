"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { parseJsonResponse } from "@/lib/chatbot/parseJsonResponse";

type ChatbotRow = {
    id: string;
    name: string;
    primaryColor: string;
    selectedRagKeys: string[];
};

export default function GetScriptPage() {
    const [copied, setCopied] = useState(false);
    const [chatbots, setChatbots] = useState<ChatbotRow[]>([]);
    const [selectedChatbotId, setSelectedChatbotId] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        fetch("/api/chatbot/sessions", { credentials: "include" })
            .then((res) => parseJsonResponse<{ sessions?: ChatbotRow[] }>(res).then((data) => ({ res, data })))
            .then(({ res, data }) => {
                if (!res.ok) {
                    throw new Error((data as { error?: string }).error || "Failed to load chatbots");
                }
                if (!cancelled) {
                    const rows = data.sessions ?? [];
                    setChatbots(rows);
                    setSelectedChatbotId(rows[0]?.id ?? null);
                }
            })
            .catch(() => {
                if (!cancelled) setChatbots([]);
            });

        return () => {
            cancelled = true;
        };
    }, []);

    const selectedChatbot = useMemo(
        () => chatbots.find((chatbot) => chatbot.id === selectedChatbotId) ?? null,
        [chatbots, selectedChatbotId],
    );

    const scriptSnippet = useMemo(() => {
        if (!selectedChatbotId) return "";
        const origin = typeof window === "undefined" ? "" : window.location.origin;
        return `<script src="${origin}/chatbot-widget.js" data-bot-id="${selectedChatbotId}"></script>`;
    }, [selectedChatbotId]);

    async function handleCopy() {
        if (!scriptSnippet) return;
        try {
            await navigator.clipboard.writeText(scriptSnippet);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1600);
        } catch {
            setCopied(false);
        }
    }

    return (
        <div className="mx-auto max-w-5xl space-y-6">
            <header className="glass-strong rounded-2xl p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-700">Install · Step 4</p>
                <h1 className="mt-1 text-2xl font-semibold text-slate-900">Get Script</h1>
                <p className="mt-2 max-w-2xl text-sm text-slate-600">
                    Pick a chatbot, then copy the script and paste it before the closing body tag on your website.
                </p>
            </header>

            <section className="glass-strong rounded-2xl p-6">
                <div className="flex items-end justify-between gap-3">
                    <div>
                        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Choose a chatbot</h2>
                        <p className="mt-1 text-xs text-slate-500">The snippet uses the selected chatbot/session id.</p>
                    </div>
                    <Link href="/dashboard/customize" className="text-sm font-medium text-brand-700 underline-offset-2 hover:underline">
                        Customize color
                    </Link>
                </div>

                {chatbots.length === 0 ? (
                    <p className="mt-4 text-sm text-slate-600">No chatbots yet. Create one first to get an embed script.</p>
                ) : (
                    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {chatbots.map((chatbot) => (
                            <button
                                key={chatbot.id}
                                type="button"
                                onClick={() => setSelectedChatbotId(chatbot.id)}
                                className={`rounded-2xl border px-4 py-3 text-left transition ${chatbot.id === selectedChatbotId
                                        ? "border-brand-500 bg-brand-50/70 shadow-sm"
                                        : "border-slate-200/70 bg-white/40 hover:bg-white/70"
                                    }`}
                            >
                                <div className="flex items-center justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-semibold text-slate-900">{chatbot.name}</p>
                                        <p className="mt-0.5 text-xs text-slate-500">{chatbot.selectedRagKeys.length} documents</p>
                                    </div>
                                    <span
                                        className="h-5 w-5 shrink-0 rounded-full border border-white shadow"
                                        style={{ backgroundColor: chatbot.primaryColor }}
                                    />
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </section>

            <section className="glass-strong rounded-2xl p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Embed snippet</h2>
                    <button
                        type="button"
                        onClick={handleCopy}
                        disabled={!selectedChatbotId}
                        className="rounded-xl bg-brand-700 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-brand-700/20 transition hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {copied ? "Copied" : "Copy script"}
                    </button>
                </div>

                <pre className="overflow-x-auto rounded-xl border border-white/40 bg-slate-900 p-4 text-sm text-slate-100">
                    <code>{selectedChatbotId ? scriptSnippet : "Loading your chatbots..."}</code>
                </pre>

                <div className="rounded-xl border border-slate-200/60 bg-white/50 p-4 text-sm text-slate-600">
                    <p className="font-medium text-slate-800">Selected chatbot</p>
                    <p className="mt-1">{selectedChatbot?.name ?? "None"}</p>
                </div>

                <ol className="space-y-2 text-sm text-slate-600">
                    <li>1. Open your website HTML layout/template.</li>
                    <li>2. Paste this script right before the closing body tag.</li>
                    <li>3. Save and refresh your website.</li>
                </ol>
            </section>
        </div>
    );
}
