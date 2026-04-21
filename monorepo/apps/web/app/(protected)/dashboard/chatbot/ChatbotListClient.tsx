"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import {
  assertOkJson,
  formatApiErrorMessage,
  parseJsonResponse,
} from "@/lib/chatbot/parseJsonResponse";
import { toast } from "@/lib/ui/toast";
import { extractErrorMessage } from "@/lib/ui/notifyMutation";

type ChatSessionRow = {
  id: string;
  name: string;
  selectedRagKeys: string[];
  updatedAt: string;
};

export function ChatbotListClient() {
  const [sessions, setSessions] = useState<ChatSessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadSessions = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/chatbot/sessions");
      const data = await parseJsonResponse<{ sessions?: ChatSessionRow[] }>(res);
      assertOkJson(res, data);
      setSessions(data.sessions ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  async function onDeleteSession(e: React.MouseEvent, sessionId: string) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Delete this chat and all of its messages?")) return;
    setDeletingId(sessionId);
    setError(null);
    const loadingId = toast.loading("Deleting chatbot…");
    try {
      const res = await fetch(`/api/chatbot/sessions/${encodeURIComponent(sessionId)}`, {
        method: "DELETE",
      });
      const data = await parseJsonResponse<unknown>(res);
      if (!res.ok) {
        const msg = formatApiErrorMessage(data, res.status);
        setError(msg);
        toast.error(msg, { id: loadingId });
        return;
      }
      toast.success("Chatbot deleted", { id: loadingId });
      await loadSessions();
    } catch (err) {
      const msg = extractErrorMessage(err, "Delete failed");
      setError(msg);
      toast.error(msg, { id: loadingId });
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <header className="glass-strong flex flex-col gap-4 rounded-2xl p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-700">Chat</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">Your chatbots</h1>
          <p className="mt-1 max-w-xl text-sm text-slate-600">
            One card per chat. Open a bot to talk, or create a new one and attach documents.
          </p>
        </div>
        <Link
          href="/dashboard/chatbot/new"
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-brand-700 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-700/25 transition-colors hover:bg-brand-800"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New chatbot
        </Link>
      </header>

      {error && (
        <div className="glass rounded-2xl border-rose-300/60 p-4 text-sm text-rose-800" role="alert">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex min-h-[40vh] items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-300 border-t-brand-600" />
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          <Link
            href="/dashboard/chatbot/new"
            className="group flex min-h-[200px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-brand-300/70 bg-white/20 p-6 text-center transition-all hover:border-brand-500 hover:bg-brand-50/40"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-700/10 text-brand-800 transition-colors group-hover:bg-brand-700/15">
              <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <p className="mt-4 text-sm font-semibold text-slate-900">Add new chatbot</p>
            <p className="mt-1 max-w-[220px] text-xs text-slate-600">
              Name your chat, upload PDFs, and pick which documents it can use.
            </p>
          </Link>

          {sessions.map((s) => (
            <Link
              key={s.id}
              href={`/dashboard/chatbot/${s.id}`}
              className="group glass-strong flex min-h-[200px] flex-col rounded-2xl p-6 transition-shadow hover:shadow-lg hover:shadow-brand-900/5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-700/12 text-brand-800">
                    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.6}
                        d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                      />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <h2 className="truncate text-lg font-semibold text-slate-900 group-hover:text-brand-900">
                      {s.name}
                    </h2>
                    <p className="mt-1 text-xs text-slate-500">
                      {s.selectedRagKeys.length} document{s.selectedRagKeys.length === 1 ? "" : "s"}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={(e) => void onDeleteSession(e, s.id)}
                  disabled={deletingId === s.id}
                  className="shrink-0 rounded-lg border border-rose-200/80 bg-white/50 px-2.5 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                  aria-label={`Delete ${s.name}`}
                >
                  {deletingId === s.id ? "…" : "Delete"}
                </button>
              </div>
              <p className="mt-auto pt-6 text-xs text-slate-500">
                Updated {new Date(s.updatedAt).toLocaleString()}
              </p>
              <p className="mt-2 text-xs font-medium text-brand-800">Open chat →</p>
            </Link>
          ))}
        </div>
      )}

      {!loading && sessions.length === 0 && (
        <p className="text-center text-sm text-slate-600">
          No chatbots yet. Use <strong>Add new chatbot</strong> above to create your first one.
        </p>
      )}
    </div>
  );
}
