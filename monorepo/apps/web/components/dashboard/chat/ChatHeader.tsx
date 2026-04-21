"use client";

import Link from "next/link";
import type { ChatSessionRow, SelectedDocForUi } from "./types";

type ChatHeaderProps = {
    session: ChatSessionRow;
    selectedDocs: SelectedDocForUi[];
    disableClear: boolean;
    isClearing: boolean;
    onClear: () => void;
};

export function ChatHeader({ session, selectedDocs, disableClear, isClearing, onClear }: ChatHeaderProps) {
    return (
        <header className="glass-strong flex flex-col gap-4 rounded-2xl p-4 sm:p-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
                <Link
                    href="/dashboard/chatbot"
                    className="inline-flex items-center rounded-lg text-xs font-semibold text-brand-800 underline-offset-2 hover:underline"
                >
                    ← All chats
                </Link>
                <h1 className="mt-2 break-words text-xl font-semibold leading-tight tracking-tight text-slate-900 sm:text-2xl">
                    {session.name}
                </h1>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-700">
                    Retrieval uses only the documents below. Prior messages in this chat are used as follow-up context.
                </p>

                {selectedDocs.length > 0 ? (
                    <ul
                        className="mt-3 flex flex-wrap gap-2"
                        aria-label="Selected documents for this chat"
                    >
                        {selectedDocs.map((d) => (
                            <li
                                key={d.ragSourceKey}
                                className={`inline-flex max-w-full items-center gap-1 rounded-xl border px-3 py-1.5 text-xs font-medium ${
                                    d.inLibrary
                                        ? "border-brand-200/80 bg-brand-50/80 text-brand-900"
                                        : "border-amber-200/80 bg-amber-50/90 text-amber-950"
                                }`}
                                title={d.inLibrary ? d.displayName : `${d.displayName} (rag: ${d.ragSourceKey})`}
                            >
                                <svg
                                    className="h-3.5 w-3.5 shrink-0 opacity-70"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                    aria-hidden="true"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={1.8}
                                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                    />
                                </svg>
                                <span className="truncate">{d.displayName}</span>
                                {!d.inLibrary && (
                                    <span className="shrink-0 rounded bg-amber-200/70 px-1 py-0.5 text-[10px] uppercase tracking-wide">
                                        removed
                                    </span>
                                )}
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="mt-2 text-sm text-amber-800">No documents are linked to this chat (unexpected).</p>
                )}
            </div>

            <button
                type="button"
                onClick={onClear}
                disabled={disableClear || isClearing}
                className="glass inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-800 transition hover:bg-white/85 disabled:opacity-50 lg:w-auto"
            >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3"
                    />
                </svg>
                {isClearing ? "Clearing…" : "Clear conversation"}
            </button>
        </header>
    );
}
