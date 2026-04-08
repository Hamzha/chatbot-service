"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";

import { assertOkJson, formatApiErrorMessage, parseJsonResponse } from "@/lib/chatbot/parseJsonResponse";

type JobStatus = {
  status: string;
  output: {
    answer?: string;
    sources?: string[];
  } | null;
};

type ChatMsg = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
};

const SUCCESS_STATES = ["Completed", "Succeeded", "Success", "Finished"];

const SUGGESTED_PROMPTS = [
  "Summarise the main points from my documents",
  "What topics are covered in the knowledge base?",
  "List any action items mentioned",
  "Explain the key concepts in simple terms",
];

async function pollJob(eventId: string): Promise<JobStatus> {
  for (let i = 0; i < 60; i += 1) {
    const res = await fetch(`/api/chatbot/jobs/${eventId}`);
    const data = await parseJsonResponse<JobStatus>(res);
    assertOkJson(res, data);
    if (SUCCESS_STATES.includes(data.status)) {
      return data;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  return { status: "timeout", output: null };
}

export default function ChatbotPage() {
  const [question, setQuestion] = useState("");
  const [status, setStatus] = useState("idle");
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [lastSources, setLastSources] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const loadMessages = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/chatbot/messages");
      const data = await parseJsonResponse<{ messages?: ChatMsg[] }>(res);
      if (!res.ok) {
        setError(formatApiErrorMessage(data, res.status));
        return;
      }
      setMessages(data.messages ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    void loadMessages();
  }, [loadMessages]);

  // Auto-scroll to bottom whenever messages or status change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status]);

  async function ask(q: string) {
    if (!q.trim()) return;

    setQuestion("");
    setStatus("querying");
    setError(null);
    setLastSources([]);

    try {
      const res = await fetch("/api/chatbot/query", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: q, top_k: 4 }),
      });
      const body = await parseJsonResponse<{ event_ids?: string[] }>(res);
      assertOkJson(res, body);
      const eventId = body.event_ids?.[0];
      if (!eventId) {
        throw new Error("No query event ID returned from chatbot API.");
      }
      const job = await pollJob(eventId);
      setStatus(job.status);

      const answer = (job.output?.answer ?? "").trim();
      const sources = job.output?.sources ?? [];
      setLastSources(sources);

      if (answer && SUCCESS_STATES.includes(job.status)) {
        const saveRes = await fetch("/api/chatbot/messages", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            question: q,
            answer,
          }),
        });
        if (!saveRes.ok) {
          const errData = await parseJsonResponse<unknown>(saveRes).catch(() => null);
          const msg = errData
            ? formatApiErrorMessage(errData, saveRes.status)
            : "Could not save conversation.";
          setError(msg);
        }
        await loadMessages();
      }
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function onAsk(e: FormEvent) {
    e.preventDefault();
    await ask(question.trim());
  }

  async function onClearHistory() {
    if (!confirm("Clear this conversation? This cannot be undone.")) return;
    setStatus("clearing");
    try {
      const res = await fetch("/api/chatbot/messages", { method: "DELETE" });
      const data = await parseJsonResponse<unknown>(res);
      if (!res.ok) {
        setError(formatApiErrorMessage(data, res.status));
        return;
      }
      setMessages([]);
      setLastSources([]);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setStatus("idle");
    }
  }

  const isQuerying = status === "querying";
  const isClearing = status === "clearing";

  return (
    <div className="mx-auto flex h-[calc(100vh-4rem)] max-w-7xl flex-col gap-5">
      {/* Page header */}
      <header className="glass-strong flex flex-wrap items-start justify-between gap-4 rounded-2xl p-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-700">Ingestion · Step 3</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">Chatbot</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Ask questions about your uploaded documents. Prior messages are sent as context for follow-ups.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void onClearHistory()}
          disabled={messages.length === 0 || isClearing}
          className="glass shrink-0 inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-slate-700 hover:bg-white/80 disabled:opacity-50"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" />
          </svg>
          {isClearing ? "Clearing…" : "Clear conversation"}
        </button>
      </header>

      {/* Chat workspace */}
      <div className="grid min-h-0 flex-1 gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        {/* Chat panel */}
        <section className="glass-strong flex min-h-0 flex-col rounded-2xl">
          {/* Messages */}
          <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5">
            {loadingHistory ? (
              <div className="flex h-full items-center justify-center">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-brand-600" />
              </div>
            ) : messages.length === 0 ? (
              <EmptyState onPick={(p) => void ask(p)} />
            ) : (
              <ul className="space-y-5">
                {messages.map((m) => (
                  <MessageBubble key={m.id} message={m} />
                ))}
                {isQuerying && <TypingBubble />}
                <div ref={messagesEndRef} />
              </ul>
            )}
          </div>

          {/* Composer */}
          <div className="border-t border-white/30 px-4 py-4 sm:px-6">
            <form onSubmit={onAsk} className="flex items-end gap-3">
              <div className="glass-input flex-1 rounded-2xl px-4 py-2.5 focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/20">
                <input
                  className="w-full bg-transparent text-sm text-slate-900 placeholder-slate-400 outline-none"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Ask a question from your ingested PDFs..."
                  disabled={isQuerying}
                />
              </div>
              <button
                className="inline-flex items-center gap-2 rounded-2xl bg-brand-700 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-700/20 hover:bg-brand-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                type="submit"
                disabled={!question.trim() || isQuerying}
              >
                {isQuerying ? (
                  <>
                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                    Asking
                  </>
                ) : (
                  <>
                    Send
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </>
                )}
              </button>
            </form>
            <p className="mt-2 px-1 text-[11px] text-slate-500">
              Press Enter to send · Replies use your uploaded documents as context
            </p>
          </div>
        </section>

        {/* Info sidebar */}
        <aside className="hidden flex-col gap-4 lg:flex">
          {/* Stats */}
          <div className="glass-strong rounded-2xl p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-700">Conversation</p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <Stat label="Messages" value={String(messages.length)} />
              <Stat label="Status" value={status === "idle" ? "Ready" : status} tone={status === "error" ? "error" : "default"} />
            </div>
          </div>

          {/* Last reply sources */}
          <div className="glass-strong min-h-0 flex-1 rounded-2xl p-5 overflow-y-auto">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-700">Sources</p>
            <p className="mt-1 text-xs text-slate-500">From your last reply</p>
            {lastSources.length > 0 ? (
              <ul className="mt-3 space-y-2">
                {lastSources.map((src, i) => (
                  <li key={i} className="glass flex items-center gap-2 rounded-xl px-3 py-2">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-700/10">
                      <svg className="h-4 w-4 text-brand-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <span className="truncate text-xs font-medium text-slate-700">{src}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-xs text-slate-500">No sources yet. Send a question to see which documents the answer drew from.</p>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="glass rounded-2xl border-rose-300/60 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-rose-700">Error</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-rose-800" role="alert">
                {error}
              </p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

/* ---------------------------- Sub-components ---------------------------- */

function MessageBubble({ message }: { message: ChatMsg }) {
  const isUser = message.role === "user";
  return (
    <li className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-700 text-xs font-semibold text-white shadow-lg shadow-brand-700/20">
          AI
        </div>
      )}
      <div
        className={
          isUser
            ? "max-w-[80%] rounded-2xl rounded-br-md bg-brand-700 px-4 py-3 text-sm text-white shadow-lg shadow-brand-700/20"
            : "glass max-w-[80%] rounded-2xl rounded-bl-md px-4 py-3 text-sm text-slate-800 whitespace-pre-wrap"
        }
      >
        {message.content}
      </div>
      {isUser && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
          You
        </div>
      )}
    </li>
  );
}

function TypingBubble() {
  return (
    <li className="flex gap-3 justify-start">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-700 text-xs font-semibold text-white shadow-lg shadow-brand-700/20">
        AI
      </div>
      <div className="glass rounded-2xl rounded-bl-md px-4 py-3">
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
    <div className="flex h-full flex-col items-center justify-center text-center">
      <div className="glass-muted mb-4 flex h-16 w-16 items-center justify-center rounded-2xl">
        <svg className="h-8 w-8 text-brand-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-4l-4 4v-4z" />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-slate-900">Start a conversation</h3>
      <p className="mt-1 max-w-sm text-sm text-slate-500">
        Ask anything about your uploaded documents. Try one of these to get started:
      </p>
      <div className="mt-5 grid w-full max-w-xl gap-2 sm:grid-cols-2">
        {SUGGESTED_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => onPick(prompt)}
            className="glass rounded-xl px-4 py-3 text-left text-sm text-slate-700 hover:bg-white/80 hover:text-slate-900 transition-colors"
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
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
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p
        className={`mt-0.5 truncate text-sm font-semibold ${
          tone === "error" ? "text-rose-700" : "text-slate-900"
        }`}
        title={value}
      >
        {value}
      </p>
    </div>
  );
}
