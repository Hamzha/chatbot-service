"use client";

import { useEffect, useRef } from "react";
import type { ChatMsg } from "./types";

const SUGGESTED_PROMPTS = [
    "Summarise the main points from my documents",
    "What topics are covered in the knowledge base?",
    "List any action items mentioned",
    "Explain the key concepts in simple terms",
];

type ChatMessagesProps = {
    messages: ChatMsg[];
    loadingHistory: boolean;
    isQuerying: boolean;
    onPickPrompt: (prompt: string) => void;
};

export function ChatMessages({ messages, loadingHistory, isQuerying, onPickPrompt }: ChatMessagesProps) {
    const endRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, isQuerying]);

    if (loadingHistory) {
        return (
            <div className="flex h-full items-center justify-center">
                <div
                    className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-brand-600"
                    aria-hidden="true"
                />
            </div>
        );
    }

    if (messages.length === 0) {
        return <EmptyState onPick={onPickPrompt} />;
    }

    return (
        <ul className="space-y-4 sm:space-y-5">
            {messages.map((m) => (
                <MessageBubble key={m.id} message={m} />
            ))}
            {isQuerying ? <TypingBubble /> : null}
            <div ref={endRef} />
        </ul>
    );
}

function MessageBubble({ message }: { message: ChatMsg }) {
    const isUser = message.role === "user";
    return (
        <li className={`flex gap-2 sm:gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
            {!isUser ? (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-700 text-xs font-semibold text-white shadow-lg shadow-brand-700/20">
                    AI
                </div>
            ) : null}
            <div
                className={
                    isUser
                        ? "max-w-[85%] wrap-break-word rounded-2xl rounded-br-md bg-brand-700 px-3 py-2.5 text-sm text-white shadow-lg shadow-brand-700/20 sm:max-w-[80%] sm:px-4 sm:py-3"
                        : "glass max-w-[85%] wrap-break-word whitespace-pre-wrap rounded-2xl rounded-bl-md px-3 py-2.5 text-sm text-slate-900 sm:max-w-[80%] sm:px-4 sm:py-3"
                }
            >
                {message.content}
            </div>
            {isUser ? (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
                    You
                </div>
            ) : null}
        </li>
    );
}

function TypingBubble() {
    return (
        <li className="flex justify-start gap-2 sm:gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-700 text-xs font-semibold text-white shadow-lg shadow-brand-700/20">
                AI
            </div>
            <div className="glass rounded-2xl rounded-bl-md px-4 py-3" aria-live="polite" aria-label="Assistant is typing">
                <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 animate-bounce rounded-full bg-brand-600 [animation-delay:-0.3s]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-brand-600 [animation-delay:-0.15s]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-brand-600" />
                </div>
            </div>
        </li>
    );
}

function EmptyState({ onPick }: { onPick: (prompt: string) => void }) {
    return (
        <div className="flex h-full flex-col items-center justify-center px-2 text-center">
            <div className="glass-muted mb-4 flex h-14 w-14 items-center justify-center rounded-2xl sm:h-16 sm:w-16">
                <svg className="h-7 w-7 text-brand-700 sm:h-8 sm:w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.8}
                        d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-4l-4 4v-4z"
                    />
                </svg>
            </div>
            <h3 className="text-lg font-semibold text-slate-900">Start a conversation</h3>
            <p className="mt-1 max-w-sm text-sm text-slate-700">
                Ask anything about the documents linked to this chat. Try one of these to get started:
            </p>
            <div className="mt-5 grid w-full max-w-xl gap-2 sm:grid-cols-2">
                {SUGGESTED_PROMPTS.map((prompt) => (
                    <button
                        key={prompt}
                        type="button"
                        onClick={() => onPick(prompt)}
                        className="glass min-h-[44px] rounded-xl px-4 py-3 text-left text-sm text-slate-800 transition-colors hover:bg-white/85 hover:text-slate-900"
                    >
                        {prompt}
                    </button>
                ))}
            </div>
        </div>
    );
}
