"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  assertOkJson,
  formatApiErrorMessage,
  parseJsonResponse,
} from "@/lib/chatbot/parseJsonResponse";
import type { SessionSelectedDocRow } from "@/lib/chatbot/resolveSessionSelectedDocuments";
import { toast } from "@/lib/ui/toast";
import { extractErrorMessage } from "@/lib/ui/notifyMutation";

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

type ChatSessionRow = {
  id: string;
  name: string;
  selectedRagKeys: string[];
};

type LibraryDoc = {
  id: string;
  source: string;
  ragSourceKey?: string;
  chunks: number;
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

export default function ChatSessionPage() {
  const params = useParams();
  const sessionId = typeof params.sessionId === "string" ? params.sessionId : "";

  const [session, setSession] = useState<ChatSessionRow | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [labelByRag, setLabelByRag] = useState<Record<string, string>>({});
  const [selectedDocumentsFromApi, setSelectedDocumentsFromApi] = useState<SessionSelectedDocRow[]>([]);

  const [question, setQuestion] = useState("");
  const [status, setStatus] = useState("idle");
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [lastSources, setLastSources] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const loadSessionAndLabels = useCallback(async () => {
    if (!sessionId) return;
    setSessionError(null);
    setLoadingSession(true);
    setSelectedDocumentsFromApi([]);
    try {
      const [sRes, dRes] = await Promise.all([
        fetch(`/api/chatbot/sessions/${encodeURIComponent(sessionId)}`),
        fetch("/api/chatbot/documents"),
      ]);
      const sData = await parseJsonResponse<{
        session?: ChatSessionRow;
        selectedDocuments?: SessionSelectedDocRow[];
      }>(sRes);
      if (!sRes.ok) {
        setSession(null);
        setSessionError(formatApiErrorMessage(sData, sRes.status));
        return;
      }
      setSession(sData.session ?? null);
      setSelectedDocumentsFromApi(sData.selectedDocuments ?? []);

      const dData = await parseJsonResponse<{ sources?: LibraryDoc[] }>(dRes);
      if (dRes.ok && dData.sources) {
        const map: Record<string, string> = {};
        for (const d of dData.sources) {
          const key = d.ragSourceKey ?? d.source;
          map[key] = d.source;
        }
        setLabelByRag(map);
      }
    } catch (err) {
      setSession(null);
      setSessionError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingSession(false);
    }
  }, [sessionId]);

  const loadMessages = useCallback(async () => {
    if (!sessionId) return;
    setError(null);
    try {
      const res = await fetch(`/api/chatbot/messages?sessionId=${encodeURIComponent(sessionId)}`);
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
  }, [sessionId]);

  useEffect(() => {
    void loadSessionAndLabels();
  }, [loadSessionAndLabels]);

  useEffect(() => {
    if (session) void loadMessages();
  }, [session, loadMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status]);

  const sourceLabels = useMemo(() => {
    return lastSources.map((rag) => labelByRag[rag] ?? rag);
  }, [lastSources, labelByRag]);

  /** Server-resolved filenames; client fallback if an older API omits `selectedDocuments`. */
  const selectedDocsForUi = useMemo((): SessionSelectedDocRow[] => {
    if (selectedDocumentsFromApi.length > 0) {
      return selectedDocumentsFromApi;
    }
    if (!session?.selectedRagKeys.length) {
      return [];
    }
    return session.selectedRagKeys.map((rag) => ({
      ragSourceKey: rag,
      displayName: labelByRag[rag] ?? rag,
      documentId: null,
      inLibrary: Object.prototype.hasOwnProperty.call(labelByRag, rag),
    }));
  }, [selectedDocumentsFromApi, session, labelByRag]);

  async function ask(q: string) {
    if (!q.trim() || !sessionId) return;

    setQuestion("");
    setStatus("querying");
    setError(null);
    setLastSources([]);

    try {
      const res = await fetch("/api/chatbot/query", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: q, top_k: 4, sessionId }),
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
            sessionId,
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
    if (!sessionId) return;
    if (!confirm("Clear this conversation? This cannot be undone.")) return;
    setStatus("clearing");
    const loadingId = toast.loading("Clearing conversation…");
    try {
      const res = await fetch(`/api/chatbot/messages?sessionId=${encodeURIComponent(sessionId)}`, {
        method: "DELETE",
      });
      const data = await parseJsonResponse<unknown>(res);
      if (!res.ok) {
        const msg = formatApiErrorMessage(data, res.status);
        setError(msg);
        toast.error(msg, { id: loadingId });
        return;
      }
      setMessages([]);
      setLastSources([]);
      setError(null);
      toast.success("Conversation cleared", { id: loadingId });
    } catch (err) {
      const msg = extractErrorMessage(err, "Could not clear conversation");
      setError(msg);
      toast.error(msg, { id: loadingId });
    } finally {
      setStatus("idle");
    }
  }

  const isQuerying = status === "querying";
  const isClearing = status === "clearing";

  if (!sessionId) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-amber-200 bg-amber-50/80 p-6 text-sm text-amber-950">
        Invalid session link.{" "}
        <Link href="/dashboard/chatbot" className="font-medium underline">
          Back to chats
        </Link>
      </div>
    );
  }

  if (loadingSession) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-300 border-t-brand-600" />
      </div>
    );
  }

  if (sessionError || !session) {
    return (
      <div className="mx-auto max-w-lg space-y-4">
        <div className="rounded-2xl border border-rose-200 bg-rose-50/80 p-6 text-sm text-rose-900">
          {sessionError ?? "Chat not found."}
        </div>
        <Link
          href="/dashboard/chatbot"
          className="inline-flex text-sm font-medium text-brand-800 underline-offset-2 hover:underline"
        >
          ← All chats
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-4rem)] max-w-7xl flex-col gap-5">
      <header className="glass-strong flex flex-wrap items-start justify-between gap-4 rounded-2xl p-5">
        <div>
          <Link
            href="/dashboard/chatbot"
            className="text-xs font-medium text-brand-800 underline-offset-2 hover:underline"
          >
            ← All chats
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-slate-900">{session.name}</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Retrieval uses only the documents below. Prior messages in this chat are used as follow-up context.
          </p>
          {selectedDocsForUi.length > 0 ? (
            <ul className="mt-3 flex flex-wrap gap-2" aria-label="Selected documents for this chat">
              {selectedDocsForUi.map((d) => (
                <li
                  key={d.ragSourceKey}
                  className={`inline-flex max-w-full items-center gap-1 rounded-xl border px-3 py-1.5 text-xs font-medium ${
                    d.inLibrary
                      ? "border-brand-200/80 bg-brand-50/80 text-brand-900"
                      : "border-amber-200/80 bg-amber-50/90 text-amber-950"
                  }`}
                  title={d.inLibrary ? d.displayName : `${d.displayName} (rag: ${d.ragSourceKey})`}
                >
                  <svg className="h-3.5 w-3.5 shrink-0 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.8}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  <span className="truncate">{d.displayName}</span>
                  {!d.inLibrary && (
                    <span className="shrink-0 rounded bg-amber-200/60 px-1 py-0.5 text-[10px] uppercase tracking-wide">
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
          onClick={() => void onClearHistory()}
          disabled={messages.length === 0 || isClearing}
          className="glass inline-flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-slate-700 hover:bg-white/80 disabled:opacity-50"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

      <section
        className="glass-strong rounded-2xl p-4 lg:hidden"
        aria-label="Selected documents"
      >
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-700">Selected documents</p>
        {selectedDocsForUi.length > 0 ? (
          <ul className="mt-2 space-y-1.5 text-sm text-slate-800">
            {selectedDocsForUi.map((d) => (
              <li key={d.ragSourceKey} className="flex items-center gap-2">
                <span className="min-w-0 truncate">{d.displayName}</span>
                {!d.inLibrary && (
                  <span className="shrink-0 text-[10px] font-semibold uppercase text-amber-800">removed</span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-slate-600">None</p>
        )}
      </section>

      <div className="grid min-h-0 flex-1 gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <section className="glass-strong flex min-h-0 flex-col rounded-2xl">
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
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

          <div className="border-t border-white/30 px-4 py-4 sm:px-6">
            <form onSubmit={onAsk} className="flex items-end gap-3">
              <div className="glass-input flex-1 rounded-2xl px-4 py-2.5 focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/20">
                <input
                  className="w-full bg-transparent text-sm text-slate-900 placeholder-slate-400 outline-none"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Ask about the documents selected for this chat…"
                  disabled={isQuerying}
                />
              </div>
              <button
                className="inline-flex items-center gap-2 rounded-2xl bg-brand-700 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-700/20 hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50"
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
              Press Enter to send · Retrieval is limited to this chat&apos;s documents only
            </p>
          </div>
        </section>

        <aside className="hidden flex-col gap-4 lg:flex">
          <div className="glass-strong rounded-2xl p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-700">Selected documents</p>
            <p className="mt-1 text-xs text-slate-500">Always used for retrieval in this chat</p>
            {selectedDocsForUi.length > 0 ? (
              <ul className="mt-3 space-y-2">
                {selectedDocsForUi.map((d) => (
                  <li
                    key={d.ragSourceKey}
                    className="glass flex items-center gap-2 rounded-xl px-3 py-2"
                  >
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-700/10">
                      <svg className="h-4 w-4 text-brand-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.8}
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-slate-800">{d.displayName}</p>
                      {!d.inLibrary && (
                        <p className="text-[10px] text-amber-800">Removed from library — chunks may still exist in search until deleted.</p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-xs text-slate-500">No documents linked.</p>
            )}
          </div>

          <div className="glass-strong rounded-2xl p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-700">Conversation</p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <Stat label="Messages" value={String(messages.length)} />
              <Stat
                label="Status"
                value={status === "idle" ? "Ready" : status}
                tone={status === "error" ? "error" : "default"}
              />
            </div>
          </div>

          <div className="glass-strong min-h-0 flex-1 overflow-y-auto rounded-2xl p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-700">Cited in last answer</p>
            <p className="mt-1 text-xs text-slate-500">Which excerpts the last reply used (may be a subset of selected docs)</p>
            {sourceLabels.length > 0 ? (
              <ul className="mt-3 space-y-2">
                {sourceLabels.map((src, i) => (
                  <li key={i} className="glass flex items-center gap-2 rounded-xl px-3 py-2">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-700/10">
                      <svg className="h-4 w-4 text-brand-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.8}
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                    </div>
                    <span className="truncate text-xs font-medium text-slate-700">{src}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-xs text-slate-500">
                No sources yet. Send a question to see which documents the answer drew from.
              </p>
            )}
          </div>

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
            : "glass max-w-[80%] rounded-2xl rounded-bl-md px-4 py-3 text-sm whitespace-pre-wrap text-slate-800"
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
    <li className="flex justify-start gap-3">
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
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.8}
            d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-4l-4 4v-4z"
          />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-slate-900">Start a conversation</h3>
      <p className="mt-1 max-w-sm text-sm text-slate-500">
        Ask anything about the documents linked to this chat. Try one of these to get started:
      </p>
      <div className="mt-5 grid w-full max-w-xl gap-2 sm:grid-cols-2">
        {SUGGESTED_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => onPick(prompt)}
            className="glass rounded-xl px-4 py-3 text-left text-sm text-slate-700 transition-colors hover:bg-white/80 hover:text-slate-900"
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
