"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

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

async function pollJob(eventId: string): Promise<JobStatus> {
  for (let i = 0; i < 60; i += 1) {
    const res = await fetch(`/api/chatbot/jobs/${eventId}`);
    const data = await parseJsonResponse<JobStatus>(res);
    assertOkJson(res, data);
    if (["Completed", "Succeeded", "Success", "Finished"].includes(data.status)) {
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

  async function onAsk(e: FormEvent) {
    e.preventDefault();
    if (!question.trim()) return;

    const q = question.trim();
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

      if (
        answer &&
        ["Completed", "Succeeded", "Success", "Finished"].includes(job.status)
      ) {
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
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setStatus("idle");
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4 max-w-4xl">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">Chatbot</h1>
          <p className="mt-2 text-zinc-600">
            Ask questions about your uploaded documents. Prior messages in this chat are sent as context for
            follow-ups.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void onClearHistory()}
          disabled={messages.length === 0 || status === "clearing"}
          className="shrink-0 rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
        >
          {status === "clearing" ? "Clearing…" : "Clear conversation"}
        </button>
      </div>

      <div className="mt-6 rounded-xl border border-zinc-200 bg-zinc-50/80 p-4 max-w-4xl min-h-[200px] max-h-[480px] overflow-y-auto">
        {loadingHistory ? (
          <p className="text-sm text-zinc-500">Loading conversation…</p>
        ) : messages.length === 0 ? (
          <p className="text-sm text-zinc-500">No messages yet. Ask a question below.</p>
        ) : (
          <ul className="space-y-4">
            {messages.map((m) => (
              <li
                key={m.id}
                className={
                  m.role === "user"
                    ? "rounded-lg border border-sky-200 bg-white px-4 py-3 text-sm text-zinc-900"
                    : "rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-800 whitespace-pre-wrap"
                }
              >
                <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-500">
                  {m.role === "user" ? "You" : "Assistant"}
                </span>
                {m.content}
              </li>
            ))}
          </ul>
        )}
      </div>

      <form onSubmit={onAsk} className="mt-6 flex gap-3 max-w-3xl">
        <input
          className="flex-1 rounded-lg border border-zinc-300 px-4 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 outline-none"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask a question from your ingested PDFs"
        />
        <button
          className="rounded-lg bg-sky-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          type="submit"
          disabled={!question.trim() || status === "querying"}
        >
          {status === "querying" ? "Asking…" : "Ask"}
        </button>
      </form>

      <div className="mt-4 max-w-4xl">
        <p className="text-sm text-zinc-600">Status: {status}</p>
        {lastSources.length > 0 && (
          <p className="mt-1 text-sm text-zinc-500">Last reply — sources: {lastSources.join(", ")}</p>
        )}
        {error && (
          <p className="mt-2 text-sm text-red-700 whitespace-pre-wrap" role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
