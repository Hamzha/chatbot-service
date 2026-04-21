"use client";

import type { SelectedDocForUi } from "./types";

type ChatRightPanelProps = {
    selectedDocs: SelectedDocForUi[];
    messagesCount: number;
    status: string;
    sourceLabels: string[];
    error: string | null;
};

export function ChatRightPanel({
    selectedDocs,
    messagesCount,
    status,
    sourceLabels,
    error,
}: ChatRightPanelProps) {
    return (
        <aside className="hidden flex-col gap-4 lg:flex">
            <div className="glass-strong rounded-2xl p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-700">
                    Selected documents
                </p>
                <p className="mt-1 text-xs text-slate-600">Always used for retrieval in this chat</p>
                {selectedDocs.length > 0 ? (
                    <ul className="mt-3 space-y-2">
                        {selectedDocs.map((d) => (
                            <li
                                key={d.ragSourceKey}
                                className="glass flex items-center gap-2 rounded-xl px-3 py-2"
                            >
                                <div
                                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-700/10"
                                    aria-hidden="true"
                                >
                                    <svg
                                        className="h-4 w-4 text-brand-700"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={1.8}
                                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                        />
                                    </svg>
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-xs font-semibold text-slate-900">{d.displayName}</p>
                                    {!d.inLibrary ? (
                                        <p className="text-[10px] text-amber-800">
                                            Removed from library — chunks may still exist in search until deleted.
                                        </p>
                                    ) : null}
                                </div>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="mt-3 text-xs text-slate-600">No documents linked.</p>
                )}
            </div>

            <div className="glass-strong rounded-2xl p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-700">Conversation</p>
                <div className="mt-3 grid grid-cols-2 gap-3">
                    <Stat label="Messages" value={String(messagesCount)} />
                    <Stat
                        label="Status"
                        value={status === "idle" ? "Ready" : status}
                        tone={status === "error" ? "error" : "default"}
                    />
                </div>
            </div>

            <div className="glass-strong min-h-0 flex-1 overflow-y-auto rounded-2xl p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-700">
                    Cited in last answer
                </p>
                <p className="mt-1 text-xs text-slate-600">
                    Which excerpts the last reply used (may be a subset of selected docs)
                </p>
                {sourceLabels.length > 0 ? (
                    <ul className="mt-3 space-y-2">
                        {sourceLabels.map((src, i) => (
                            <li key={i} className="glass flex items-center gap-2 rounded-xl px-3 py-2">
                                <div
                                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-700/10"
                                    aria-hidden="true"
                                >
                                    <svg
                                        className="h-4 w-4 text-brand-700"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={1.8}
                                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                        />
                                    </svg>
                                </div>
                                <span className="truncate text-xs font-semibold text-slate-800">{src}</span>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="mt-3 text-xs text-slate-600">
                        No sources yet. Send a question to see which documents the answer drew from.
                    </p>
                )}
            </div>

            {error ? (
                <div className="glass rounded-2xl border-rose-300/60 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-rose-800">Error</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-rose-900" role="alert">
                        {error}
                    </p>
                </div>
            ) : null}
        </aside>
    );
}

function Stat({
    label,
    value,
    tone = "default",
}: {
    label: string;
    value: string;
    tone?: "default" | "error";
}) {
    return (
        <div className="glass-muted rounded-xl p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-700">{label}</p>
            <p
                className={`mt-0.5 truncate text-sm font-semibold ${
                    tone === "error" ? "text-rose-800" : "text-slate-900"
                }`}
                title={value}
            >
                {value}
            </p>
        </div>
    );
}
