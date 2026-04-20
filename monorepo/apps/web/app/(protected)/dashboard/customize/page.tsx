"use client";

import { useEffect, useMemo, useState } from "react";

import Link from "next/link";

import { parseJsonResponse } from "@/lib/chatbot/parseJsonResponse";
import { toast } from "@/lib/ui/toast";
import { extractErrorMessage } from "@/lib/ui/notifyMutation";

type ChatbotRow = {
    id: string;
    name: string;
    primaryColor: string;
    selectedRagKeys: string[];
};

const DEFAULT_COLOR = "#0f766e";

export default function CustomizePage() {
    const [chatbots, setChatbots] = useState<ChatbotRow[]>([]);
    const [selectedChatbotId, setSelectedChatbotId] = useState<string | null>(null);
    const [primaryColor, setPrimaryColor] = useState(DEFAULT_COLOR);
    const [savedColor, setSavedColor] = useState(DEFAULT_COLOR);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

    useEffect(() => {
        let cancelled = false;
        fetch("/api/chatbot/sessions", { credentials: "include" })
            .then((res) => parseJsonResponse<{ sessions?: ChatbotRow[] }>(res).then((data) => ({ res, data })))
            .then(({ res, data }) => {
                if (!res.ok) {
                    throw new Error((data as { error?: string }).error || "Failed to load chatbots");
                }
                if (cancelled) return;
                const rows = data.sessions ?? [];
                setChatbots(rows);
                const first = rows[0] ?? null;
                setSelectedChatbotId(first?.id ?? null);
                setPrimaryColor(first?.primaryColor ?? DEFAULT_COLOR);
                setSavedColor(first?.primaryColor ?? DEFAULT_COLOR);
            })
            .catch(() => {
                if (!cancelled) setChatbots([]);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        const selected = chatbots.find((chatbot) => chatbot.id === selectedChatbotId) ?? null;
        if (selected) {
            setPrimaryColor(selected.primaryColor || DEFAULT_COLOR);
            setSavedColor(selected.primaryColor || DEFAULT_COLOR);
        }
    }, [chatbots, selectedChatbotId]);

    async function selectChatbot(chatbotId: string) {
        setSelectedChatbotId(chatbotId);
        setMessage(null);
        const selected = chatbots.find((chatbot) => chatbot.id === chatbotId);
        if (selected) {
            setPrimaryColor(selected.primaryColor || DEFAULT_COLOR);
            setSavedColor(selected.primaryColor || DEFAULT_COLOR);
        }
    }

    async function handleSave() {
        if (!selectedChatbotId) return;
        setSaving(true);
        setMessage(null);
        const loadingId = toast.loading("Saving widget color…");
        try {
            const res = await fetch(`/api/chatbot/sessions/${encodeURIComponent(selectedChatbotId)}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ primaryColor }),
            });
            const data = await parseJsonResponse<{ session?: ChatbotRow; error?: string }>(res);
            if (!res.ok) {
                throw new Error(data.error || "Failed to save");
            }
            setSavedColor(primaryColor);
            setChatbots((prev) =>
                prev.map((chatbot) => (chatbot.id === selectedChatbotId ? { ...chatbot, primaryColor } : chatbot)),
            );
            setMessage({ type: "success", text: "Color saved!" });
            toast.success("Widget color saved", { id: loadingId });
            window.setTimeout(() => setMessage(null), 3000);
        } catch (err) {
            const msg = extractErrorMessage(err, "Failed to save");
            setMessage({ type: "error", text: msg });
            toast.error(msg, { id: loadingId });
        } finally {
            setSaving(false);
        }
    }

    const hasChanges = primaryColor !== savedColor;
    const darkerColor = adjustColor(primaryColor, -20);
    const lighterColor = adjustColor(primaryColor, 20);
    const selectedChatbot = useMemo(
        () => chatbots.find((chatbot) => chatbot.id === selectedChatbotId) ?? null,
        [chatbots, selectedChatbotId],
    );

    return (
        <div className="mx-auto max-w-5xl space-y-6">
            <header className="glass-strong rounded-2xl p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-700">Customize · Step 3</p>
                <h1 className="mt-1 text-2xl font-semibold text-slate-900">Widget Appearance</h1>
                <p className="mt-2 max-w-2xl text-sm text-slate-600">
                    Choose a chatbot, then edit its primary color. That color will be used for the launcher, header, send button,
                    and user bubbles.
                </p>
            </header>

            <section className="glass-strong rounded-2xl p-6">
                <div className="flex items-end justify-between gap-3">
                    <div>
                        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Choose a chatbot</h2>
                        <p className="mt-1 text-xs text-slate-500">Each chatbot/session keeps its own color.</p>
                    </div>
                    <Link href="/dashboard/chatbot" className="text-sm font-medium text-brand-700 underline-offset-2 hover:underline">
                        Manage chatbots
                    </Link>
                </div>

                {loading ? (
                    <p className="mt-4 text-sm text-slate-500">Loading chatbots…</p>
                ) : chatbots.length === 0 ? (
                    <p className="mt-4 text-sm text-slate-600">
                        No chatbots yet. Create one first, then come back here to customize its color.
                    </p>
                ) : (
                    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {chatbots.map((chatbot) => (
                            <button
                                key={chatbot.id}
                                type="button"
                                onClick={() => void selectChatbot(chatbot.id)}
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
                                    <span className="h-5 w-5 shrink-0 rounded-full border border-white shadow" style={{ backgroundColor: chatbot.primaryColor || DEFAULT_COLOR }} />
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </section>

            <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
                <section className="space-y-6">
                    <div className="glass-strong rounded-2xl p-6">
                        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Pick Your Color</h2>
                        <p className="mt-1 text-xs text-slate-500">Use the color picker or enter a hex value directly.</p>

                        {!selectedChatbot ? (
                            <p className="mt-4 text-sm text-slate-600">Select a chatbot first.</p>
                        ) : (
                            <div className="mt-5 flex flex-col items-center gap-6 sm:flex-row sm:items-start">
                                <div className="relative">
                                    <input
                                        type="color"
                                        value={primaryColor}
                                        onChange={(e) => setPrimaryColor(e.target.value)}
                                        className="h-44 w-44 cursor-pointer rounded-2xl border-0 bg-transparent p-0 [&::-webkit-color-swatch-wrapper]:p-1 [&::-webkit-color-swatch]:rounded-xl [&::-webkit-color-swatch]:border-0"
                                    />
                                </div>

                                <div className="flex flex-1 flex-col gap-4">
                                    <div className="glass flex items-center gap-4 rounded-xl p-4">
                                        <div className="h-14 w-14 shrink-0 rounded-xl shadow-lg transition-colors duration-200" style={{ backgroundColor: primaryColor }} />
                                        <div className="min-w-0 flex-1">
                                            <p className="text-xs font-medium text-slate-500">Selected color</p>
                                            <input
                                                type="text"
                                                value={primaryColor}
                                                onChange={(e) => {
                                                    const v = e.target.value;
                                                    if (/^#[0-9a-fA-F]{0,6}$/.test(v)) setPrimaryColor(v);
                                                }}
                                                maxLength={7}
                                                spellCheck={false}
                                                className="mt-0.5 w-full rounded-lg border border-slate-200/70 bg-white/60 px-3 py-1.5 font-mono text-base font-semibold uppercase text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                                                placeholder="#0f766e"
                                            />
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3 pt-1">
                                        <button
                                            type="button"
                                            onClick={handleSave}
                                            disabled={saving || loading || !hasChanges}
                                            className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                                            style={{ backgroundColor: hasChanges ? primaryColor : undefined }}
                                        >
                                            {saving ? "Saving..." : "Save Color"}
                                        </button>

                                        {hasChanges && (
                                            <button
                                                type="button"
                                                onClick={() => setPrimaryColor(savedColor)}
                                                className="rounded-xl border border-slate-200/70 bg-white/50 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-white/80"
                                            >
                                                Reset
                                            </button>
                                        )}

                                        {message && (
                                            <span
                                                className={`text-sm font-medium ${message.type === "success" ? "text-emerald-600" : "text-rose-600"}`}
                                                role="status"
                                            >
                                                {message.text}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </section>

                <section className="space-y-6">
                    <div className="glass-strong rounded-2xl p-6">
                        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Live Preview</h2>
                        <p className="mt-1 text-xs text-slate-500">See how your widget will look on your site.</p>

                        <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-xl">
                            <div
                                className="flex items-center justify-between px-4 py-3.5 text-white transition-colors duration-200"
                                style={{ background: `linear-gradient(130deg, ${primaryColor} 0%, ${darkerColor} 100%)` }}
                            >
                                <div className="flex items-center gap-3">
                                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-xs font-bold backdrop-blur-sm">
                                        AI
                                    </div>
                                    <div>
                                        <div className="text-[13px] font-bold leading-tight">{selectedChatbot?.name ?? "Support Assistant"}</div>
                                        <div className="flex items-center gap-1.5 text-[10px] opacity-90">
                                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 shadow-[0_0_4px_rgba(52,211,153,0.6)]" />
                                            Online
                                        </div>
                                    </div>
                                </div>
                                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/15 text-sm">&times;</div>
                            </div>

                            <div
                                className="space-y-3 p-4"
                                style={{ background: "radial-gradient(600px 300px at -100px -50px, #f0fdfa 5%, #f8fafc 45%, #fff 100%)" }}
                            >
                                <div className="max-w-[86%] rounded-2xl rounded-tl-md border border-slate-200/60 bg-white px-3.5 py-2.5 text-xs leading-relaxed text-slate-700 shadow-sm">
                                    Hey there! How can I help you today?
                                </div>
                                <div
                                    className="ml-auto max-w-[86%] rounded-2xl rounded-tr-md px-3.5 py-2.5 text-xs leading-relaxed text-white shadow-sm transition-colors duration-200"
                                    style={{ background: `linear-gradient(130deg, ${primaryColor} 0%, ${lighterColor} 100%)` }}
                                >
                                    What are your business hours?
                                </div>
                                <div className="max-w-[86%] rounded-2xl rounded-tl-md border border-slate-200/60 bg-white px-3.5 py-2.5 text-xs leading-relaxed text-slate-700 shadow-sm">
                                    We&apos;re open Mon-Fri, 9 AM to 5 PM!
                                </div>
                            </div>

                            <div className="flex items-center gap-2 border-t border-slate-100 px-3 py-2.5">
                                <div className="flex-1 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2 text-[11px] text-slate-400">Type message...</div>
                                <button
                                    type="button"
                                    className="flex h-8 w-8 items-center justify-center rounded-xl text-white shadow transition-colors duration-200"
                                    style={{ backgroundColor: primaryColor }}
                                >
                                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 12h14m-7-7l7 7-7 7" />
                                    </svg>
                                </button>
                            </div>
                        </div>

                        <div className="mt-5 flex items-center justify-between">
                            <span className="text-xs text-slate-500">Launcher button</span>
                            <div
                                className="flex h-14 w-14 items-center justify-center rounded-full text-xl text-white shadow-xl transition-colors duration-200"
                                style={{
                                    background: `linear-gradient(135deg, ${primaryColor} 0%, ${lighterColor} 100%)`,
                                    boxShadow: `0 8px 24px ${primaryColor}50`,
                                }}
                            >
                                💬
                            </div>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
}

function adjustColor(hex: string, amount: number): string {
    if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return hex;
    const num = parseInt(hex.replace("#", ""), 16);
    const r = Math.min(255, Math.max(0, ((num >> 16) & 0xff) + amount));
    const g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + amount));
    const b = Math.min(255, Math.max(0, (num & 0xff) + amount));
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}
