"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ChatComposer } from "@/components/dashboard/chat/ChatComposer";
import { ChatHeader } from "@/components/dashboard/chat/ChatHeader";
import { ChatMessages } from "@/components/dashboard/chat/ChatMessages";
import { ChatRightPanel } from "@/components/dashboard/chat/ChatRightPanel";
import type { ChatMsg, ChatSessionRow, SelectedDocForUi } from "@/components/dashboard/chat/types";
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

type LibraryDoc = {
  id: string;
  source: string;
  ragSourceKey?: string;
  chunks: number;
};

const SUCCESS_STATES = ["Completed", "Succeeded", "Success", "Finished"];

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

export function ChatbotSessionClient() {
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
  const [failedQuestion, setFailedQuestion] = useState<string | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [lastSources, setLastSources] = useState<string[]>([]);
  const askFnRef = useRef<((q: string) => Promise<void>) | null>(null);

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

  const sourceLabels = useMemo(
    () => lastSources.map((rag) => labelByRag[rag] ?? rag),
    [lastSources, labelByRag],
  );

  /** Server-resolved filenames; client fallback if an older API omits `selectedDocuments`. */
  const selectedDocsForUi: SelectedDocForUi[] = useMemo(() => {
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

  const ask = useCallback(
    async (q: string, options?: { isRetry?: boolean }) => {
      const trimmedQuestion = q.trim();
      if (!trimmedQuestion || !sessionId) return;

      if (!options?.isRetry) {
        setQuestion("");
      }
      setStatus("querying");
      setError(null);
      setFailedQuestion(null);
      setLastSources([]);

      if (!options?.isRetry) {
        // Add user message to chat immediately (optimistic UI)
        const userMessageId = `user-${Date.now()}`;
        const userMessage: ChatMsg = {
          id: userMessageId,
          role: "user",
          content: trimmedQuestion,
          createdAt: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, userMessage]);
      }

      try {
        const res = await fetch("/api/chatbot/query", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ question: trimmedQuestion, top_k: 4, sessionId }),
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
              question: trimmedQuestion,
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
          // Add bot response to chat instead of reloading all messages
          const botMessage: ChatMsg = {
            id: `bot-${Date.now()}`,
            role: "assistant",
            content: answer,
            createdAt: new Date().toISOString(),
          };
          setMessages((prev) => [...prev, botMessage]);
        }
      } catch (err) {
        setStatus("error");
        setError(err instanceof Error ? err.message : String(err));
        setFailedQuestion(trimmedQuestion);
      }
    },
    [sessionId],
  );

  askFnRef.current = ask;

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
      setFailedQuestion(null);
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
        <Link href="/dashboard/chatbot" className="font-semibold underline">
          Back to chats
        </Link>
      </div>
    );
  }

  if (loadingSession) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div
          className="h-10 w-10 animate-spin rounded-full border-4 border-slate-300 border-t-brand-600"
          aria-hidden="true"
        />
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
          className="inline-flex rounded-lg text-sm font-semibold text-brand-800 underline-offset-2 hover:underline"
        >
          ← All chats
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 sm:gap-5 lg:h-[calc(100dvh-5rem)]">
      <ChatHeader
        session={session}
        selectedDocs={selectedDocsForUi}
        disableClear={messages.length === 0}
        isClearing={isClearing}
        onClear={() => void onClearHistory()}
      />

      {/* Mobile-only selected-documents block (right panel is desktop only) */}
      <section
        className="glass-strong rounded-2xl p-4 lg:hidden"
        aria-label="Selected documents"
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-700">
          Selected documents
        </p>
        {selectedDocsForUi.length > 0 ? (
          <ul className="mt-2 space-y-1.5 text-sm text-slate-900">
            {selectedDocsForUi.map((d) => (
              <li key={d.ragSourceKey} className="flex items-center gap-2">
                <span className="min-w-0 truncate font-medium">{d.displayName}</span>
                {!d.inLibrary && (
                  <span className="shrink-0 text-[10px] font-semibold uppercase text-amber-800">
                    removed
                  </span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-slate-700">None</p>
        )}
      </section>

      <div className="grid flex-1 min-h-0 gap-4 sm:gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <section className="glass-strong flex min-h-[55vh] min-w-0 flex-col rounded-2xl lg:min-h-0">
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
            <ChatMessages
              messages={messages}
              loadingHistory={loadingHistory}
              isQuerying={isQuerying}
              errorMessage={error}
              canRetry={Boolean(failedQuestion) && !isQuerying}
              onRetry={() => {
                if (failedQuestion) {
                  void ask(failedQuestion, { isRetry: true });
                }
              }}
              onPickPrompt={(p) => void askFnRef.current?.(p)}
            />
          </div>

          <ChatComposer
            question={question}
            onQuestionChange={setQuestion}
            onSubmit={onAsk}
            disabled={isQuerying}
            isQuerying={isQuerying}
          />
        </section>

        <ChatRightPanel
          selectedDocs={selectedDocsForUi}
          messagesCount={messages.length}
          status={status}
          sourceLabels={sourceLabels}
          error={error}
        />
      </div>

      {/* Mobile error display (desktop error lives inside right panel) */}
      {error && (
        <div className="glass rounded-2xl border-rose-300/60 p-4 lg:hidden" role="alert">
          <p className="text-xs font-semibold uppercase tracking-wide text-rose-800">Error</p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-rose-900">{error}</p>
        </div>
      )}
    </div>
  );
}
