"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { PageContainer } from "@/components/shell/PageContainer";
import { PageHeader } from "@/components/shell/PageHeader";
import { parseJsonResponse } from "@/lib/chatbot/parseJsonResponse";
import { toast } from "@/lib/ui/toast";

type ChatbotRow = {
    id: string;
    widgetPublicId?: string;
    name: string;
    primaryColor: string;
    selectedRagKeys: string[];
};

export function GetScriptClient() {
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
        const widgetId = selectedChatbot?.widgetPublicId || selectedChatbotId;
        return `<script src="${origin}/chatbot-widget.js" data-bot-id="${widgetId}"></script>`;
    }, [selectedChatbot, selectedChatbotId]);

    async function handleCopy() {
        if (!scriptSnippet) return;
        try {
            await navigator.clipboard.writeText(scriptSnippet);
            setCopied(true);
            toast.success("Script copied to clipboard");
            window.setTimeout(() => setCopied(false), 1600);
        } catch {
            setCopied(false);
            toast.error("Could not copy – copy manually instead.");
        }
    }

    return (
        <PageContainer size="5xl">
            <PageHeader
                eyebrow="Install · Step 4"
                title="Get script"
                subtitle="Pick a chatbot, then copy the script and paste it before the closing body tag on your website. The script only mounts the launcher and iframe; all chat logic stays on our domain."
            />

            <section className="glass-strong rounded-2xl p-5 sm:p-6">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between sm:gap-3">
                    <div>
                        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-800">Choose a chatbot</h2>
                        <p className="mt-1 text-xs text-slate-600">The snippet uses the selected chatbot/session id.</p>
                    </div>
                    <Link
                        href="/dashboard/customize"
                        className="text-sm font-semibold text-brand-800 underline-offset-2 hover:underline"
                    >
                        Customize color →
                    </Link>
                </div>

                {chatbots.length === 0 ? (
                    <p className="mt-4 text-sm text-slate-700">No chatbots yet. Create one first to get an embed script.</p>
                ) : (
                    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {chatbots.map((chatbot) => {
                            const isSelected = chatbot.id === selectedChatbotId;
                            return (
                                <button
                                    key={chatbot.id}
                                    type="button"
                                    onClick={() => setSelectedChatbotId(chatbot.id)}
                                    aria-pressed={isSelected}
                                    className={`rounded-2xl border px-4 py-3 text-left transition ${
                                        isSelected
                                            ? "border-brand-500 bg-brand-50/70 shadow-sm"
                                            : "border-slate-200/70 bg-white/40 hover:bg-white/70"
                                    }`}
                                >
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-semibold text-slate-900">{chatbot.name}</p>
                                            <p className="mt-0.5 text-xs text-slate-600">
                                                {chatbot.selectedRagKeys.length} documents
                                            </p>
                                        </div>
                                        <span
                                            className="h-5 w-5 shrink-0 rounded-full border border-white shadow"
                                            style={{ backgroundColor: chatbot.primaryColor }}
                                            aria-hidden="true"
                                        />
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                )}
            </section>

            <section className="glass-strong space-y-4 rounded-2xl p-5 sm:p-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                    <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-800">Embed snippet</h2>
                    <button
                        type="button"
                        onClick={handleCopy}
                        disabled={!selectedChatbotId}
                        className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-brand-700 px-4 text-sm font-semibold text-white shadow-lg shadow-brand-700/20 transition hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                    >
                        {copied ? "Copied" : "Copy script"}
                    </button>
                </div>

                <pre
                    className="overflow-x-auto rounded-xl border border-white/40 bg-slate-900 p-4 text-xs leading-relaxed text-slate-100 sm:text-sm"
                    aria-label="Embed snippet"
                >
                    <code className="wrap-break-word">
                        {selectedChatbotId ? scriptSnippet : "Loading your chatbots…"}
                    </code>
                </pre>

                <div className="rounded-xl border border-slate-200/60 bg-white/50 p-4 text-sm text-slate-700">
                    <p className="font-semibold text-slate-900">Selected chatbot</p>
                    <p className="mt-1 wrap-break-word">{selectedChatbot?.name ?? "None"}</p>
                </div>

                <ol className="space-y-2 text-sm leading-6 text-slate-700">
                    <li>1. Open your website HTML layout/template.</li>
                    <li>2. Paste this script right before the closing body tag.</li>
                    <li>3. Save and refresh your website.</li>
                </ol>
            </section>
        </PageContainer>
    );
}
