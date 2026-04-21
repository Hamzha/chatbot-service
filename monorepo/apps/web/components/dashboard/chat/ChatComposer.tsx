"use client";

import type { FormEvent } from "react";

type ChatComposerProps = {
    question: string;
    onQuestionChange: (value: string) => void;
    onSubmit: (event: FormEvent) => void;
    disabled: boolean;
    isQuerying: boolean;
};

export function ChatComposer({
    question,
    onQuestionChange,
    onSubmit,
    disabled,
    isQuerying,
}: ChatComposerProps) {
    return (
        <div className="border-t border-white/30 bg-white/40 px-3 py-3 sm:px-6 sm:py-4">
            <form onSubmit={onSubmit} className="flex items-end gap-2 sm:gap-3">
                <label htmlFor="chat-question" className="sr-only">
                    Your question
                </label>
                <div className="glass-input flex min-w-0 flex-1 items-center rounded-2xl px-3 py-2 focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/20 sm:px-4 sm:py-2.5">
                    <input
                        id="chat-question"
                        className="w-full min-w-0 bg-transparent text-base text-slate-900 placeholder-slate-500 outline-none sm:text-sm"
                        value={question}
                        onChange={(e) => onQuestionChange(e.target.value)}
                        placeholder="Ask about the documents…"
                        disabled={disabled}
                    />
                </div>
                <button
                    className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-brand-700 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-700/20 hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50 sm:px-5"
                    type="submit"
                    disabled={!question.trim() || isQuerying}
                    aria-label="Send question"
                >
                    {isQuerying ? (
                        <span
                            className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
                            aria-hidden="true"
                        />
                    ) : (
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                    )}
                    <span className="hidden sm:inline">{isQuerying ? "Asking" : "Send"}</span>
                </button>
            </form>
            <p className="mt-2 px-1 text-[11px] text-slate-600">
                Press Enter to send · Retrieval is limited to this chat&apos;s documents only
            </p>
        </div>
    );
}
