"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";

import {
  assertOkJson,
  formatApiErrorMessage,
  parseJsonResponse,
} from "@/lib/chatbot/parseJsonResponse";

type ChatSessionRow = {
  id: string;
  name: string;
  selectedRagKeys: string[];
  updatedAt: string;
};

type LibraryDoc = {
  id: string;
  source: string;
  chunks: number;
};

export default function ChatbotHubPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<ChatSessionRow[]>([]);
  const [documents, setDocuments] = useState<LibraryDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [docsLoading, setDocsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);
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

  const loadDocuments = useCallback(async () => {
    try {
      const res = await fetch("/api/chatbot/documents");
      const data = await parseJsonResponse<{ sources?: LibraryDoc[] }>(res);
      if (!res.ok) {
        return;
      }
      setDocuments(data.sources ?? []);
    } catch {
      setDocuments([]);
    } finally {
      setDocsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSessions();
    void loadDocuments();
  }, [loadSessions, loadDocuments]);

  function toggleDoc(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    const ids = [...selectedIds];
    if (ids.length === 0) return;

    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/chatbot/sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: name.trim() || "Untitled chat", documentIds: ids }),
      });
      const data = await parseJsonResponse<{ session?: { id: string } }>(res);
      if (!res.ok) {
        setError(formatApiErrorMessage(data, res.status));
        return;
      }
      const id = data.session?.id;
      if (!id) {
        setError("No session id returned.");
        return;
      }
      setName("");
      setSelectedIds(new Set());
      router.push(`/dashboard/chatbot/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCreating(false);
    }
  }

  async function onDeleteSession(sessionId: string) {
    if (!confirm("Delete this chat and all of its messages?")) return;
    setDeletingId(sessionId);
    setError(null);
    try {
      const res = await fetch(`/api/chatbot/sessions/${encodeURIComponent(sessionId)}`, {
        method: "DELETE",
      });
      const data = await parseJsonResponse<unknown>(res);
      if (!res.ok) {
        setError(formatApiErrorMessage(data, res.status));
        return;
      }
      await loadSessions();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <header className="glass-strong rounded-2xl p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-700">Chat</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">Your chatbots</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-600">
          Each chat uses only the library documents you select. Upload PDFs under{" "}
          <Link href="/dashboard/upload-document" className="font-medium text-brand-800 underline-offset-2 hover:underline">
            Upload Document
          </Link>
          , then start a new chat here.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section className="glass-strong rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-slate-900">New chat</h2>
          <p className="mt-1 text-sm text-slate-600">Pick a name and one or more documents from your library.</p>

          <form onSubmit={onCreate} className="mt-5 space-y-4">
            <div>
              <label htmlFor="chat-name" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Name
              </label>
              <input
                id="chat-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Q4 report Q&A"
                className="glass-input mt-1 w-full rounded-xl px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
              />
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Documents</p>
              {docsLoading ? (
                <p className="mt-2 text-sm text-slate-500">Loading library…</p>
              ) : documents.length === 0 ? (
                <p className="mt-2 text-sm text-slate-600">
                  No documents yet.{" "}
                  <Link href="/dashboard/upload-document" className="text-brand-800 underline-offset-2 hover:underline">
                    Upload a PDF
                  </Link>{" "}
                  first.
                </p>
              ) : (
                <ul className="mt-2 max-h-56 space-y-2 overflow-y-auto rounded-xl border border-white/40 bg-white/20 p-2">
                  {documents.map((d) => (
                    <li key={d.id}>
                      <label className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 hover:bg-white/40">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(d.id)}
                          onChange={() => toggleDoc(d.id)}
                          className="h-4 w-4 rounded border-slate-300 text-brand-700"
                        />
                        <span className="min-w-0 flex-1 truncate text-sm text-slate-800">{d.source}</span>
                        <span className="shrink-0 text-xs text-slate-500">
                          {d.chunks === 0 ? "Pending" : `${d.chunks} chunks`}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <button
              type="submit"
              disabled={creating || selectedIds.size === 0 || documents.length === 0}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-700 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-700/20 hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {creating ? "Creating…" : "Create chat"}
            </button>
          </form>
        </section>

        <section className="glass-strong rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-slate-900">Existing chats</h2>
          {loading ? (
            <div className="mt-8 flex justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-brand-600" />
            </div>
          ) : sessions.length === 0 ? (
            <p className="mt-4 text-sm text-slate-600">No chats yet. Create one on the left.</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {sessions.map((s) => (
                <li
                  key={s.id}
                  className="glass flex items-center gap-3 rounded-xl px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/dashboard/chatbot/${s.id}`}
                      className="block truncate text-sm font-medium text-brand-900 hover:underline"
                    >
                      {s.name}
                    </Link>
                    <p className="text-xs text-slate-500">
                      {s.selectedRagKeys.length} document{s.selectedRagKeys.length === 1 ? "" : "s"} · Updated{" "}
                      {new Date(s.updatedAt).toLocaleString()}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void onDeleteSession(s.id)}
                    disabled={deletingId === s.id}
                    className="shrink-0 rounded-lg border border-rose-300/70 bg-white/40 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50/60 disabled:opacity-50"
                  >
                    {deletingId === s.id ? "…" : "Delete"}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {error && (
        <div className="glass rounded-2xl border-rose-300/60 p-4 text-sm text-rose-800" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}
