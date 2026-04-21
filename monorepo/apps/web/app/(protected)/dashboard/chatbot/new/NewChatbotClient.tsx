"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";

import { PageContainer } from "@/components/shell/PageContainer";
import {
  assertOkJson,
  formatApiErrorMessage,
  parseJsonResponse,
} from "@/lib/chatbot/parseJsonResponse";
import { toast } from "@/lib/ui/toast";
import { extractErrorMessage } from "@/lib/ui/notifyMutation";

type JobStatus = {
  status: string;
  output: { ingested?: number; source?: string } | null;
};

type LibraryDoc = {
  id: string;
  source: string;
  chunks: number;
  kind?: "upload" | "site";
  pageCount?: number;
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

export function NewChatbotClient() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [documents, setDocuments] = useState<LibraryDoc[]>([]);
  const [docsLoading, setDocsLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState("idle");
  const [uploadMessage, setUploadMessage] = useState("");
  const [isDragging, setIsDragging] = useState(false);

  const loadDocuments = useCallback(async () => {
    setDocsLoading(true);
    try {
      const res = await fetch("/api/chatbot/documents");
      const data = await parseJsonResponse<{ sources?: LibraryDoc[] }>(res);
      if (res.ok) {
        setDocuments(data.sources ?? []);
      }
    } catch {
      setDocuments([]);
    } finally {
      setDocsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  function toggleDoc(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handlePickedPdf(files: FileList | null) {
    const picked = files?.[0];
    if (!picked) return;
    if (picked.type === "application/pdf" || picked.name.toLowerCase().endsWith(".pdf")) {
      setFile(picked);
      setUploadMessage("");
    }
  }

  async function onUploadPdf(e: FormEvent) {
    e.preventDefault();
    if (!file) return;
    setUploadStatus("uploading");
    setUploadMessage("");
    const loadingId = toast.loading(`Uploading ${file.name}…`);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/chatbot/ingest", { method: "POST", body: fd });
      const body = await parseJsonResponse<{
        event_ids?: string[];
        document?: { id: string; source: string };
      }>(res);
      assertOkJson(res, body);
      const eventId = body.event_ids?.[0];
      const documentId = body.document?.id;
      if (!eventId || !documentId) {
        throw new Error("Unexpected response from ingest.");
      }
      const job = await pollJob(eventId);
      setUploadStatus(job.status);
      let finalizeOk = false;
      if (job.output?.ingested != null && SUCCESS_STATES.includes(job.status)) {
        const recordRes = await fetch("/api/chatbot/documents", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ documentId, chunks: job.output.ingested }),
        });
        if (!recordRes.ok) {
          const errBody = await parseJsonResponse<unknown>(recordRes).catch(() => null);
          const msg = errBody
            ? formatApiErrorMessage(errBody, recordRes.status)
            : "Could not finalize document record.";
          setUploadMessage(msg);
          toast.error(msg, { id: loadingId });
        } else {
          finalizeOk = true;
          setUploadMessage(`Added “${body.document?.source ?? file.name}” (${job.output.ingested} chunks).`);
          toast.success(
            `Document added — ${job.output.ingested.toLocaleString()} chunks indexed`,
            { id: loadingId },
          );
          setFile(null);
          if (fileInputRef.current) fileInputRef.current.value = "";
        }
      } else {
        const msg = `Ingest status: ${job.status}`;
        setUploadMessage(msg);
        toast.error(msg, { id: loadingId });
      }
      await loadDocuments();
      if (finalizeOk) {
        setSelectedIds((prev) => new Set(prev).add(documentId));
      }
    } catch (err) {
      setUploadStatus("error");
      const msg = extractErrorMessage(err, "Upload failed");
      setUploadMessage(msg);
      toast.error(msg, { id: loadingId });
    }
  }

  async function onCreateChat(e: FormEvent) {
    e.preventDefault();
    const ids = [...selectedIds];
    if (ids.length === 0) {
      setFormError("Select at least one document for this chatbot.");
      return;
    }
    setCreating(true);
    setFormError(null);
    const loadingId = toast.loading("Creating chatbot…");
    try {
      const res = await fetch("/api/chatbot/sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: name.trim() || "Untitled chat", documentIds: ids }),
      });
      const data = await parseJsonResponse<{ session?: { id: string } }>(res);
      if (!res.ok) {
        const msg = formatApiErrorMessage(data, res.status);
        setFormError(msg);
        toast.error(msg, { id: loadingId });
        return;
      }
      const id = data.session?.id;
      if (!id) {
        setFormError("No session id returned.");
        toast.error("No session id returned.", { id: loadingId });
        return;
      }
      toast.success("Chatbot created", { id: loadingId });
      router.push(`/dashboard/chatbot/${id}`);
    } catch (err) {
      const msg = extractErrorMessage(err, "Could not create chatbot");
      setFormError(msg);
      toast.error(msg, { id: loadingId });
    } finally {
      setCreating(false);
    }
  }

  const isUploading = uploadStatus === "uploading";

  return (
    <PageContainer size="md">
      <div>
        <Link
          href="/dashboard/chatbot"
          className="inline-flex items-center rounded-lg text-sm font-semibold text-brand-800 underline-offset-2 hover:underline"
        >
          ← All chatbots
        </Link>
        <header className="glass-strong mt-3 rounded-2xl p-5 sm:p-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-700">New chatbot</p>
          <h1 className="mt-1 text-2xl font-semibold leading-tight tracking-tight text-slate-900 sm:text-3xl">
            Create a chatbot
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-700">
            Upload PDFs here or pick files already in your library, then choose a name and create.
          </p>
        </header>
      </div>

      <section className="glass-strong rounded-2xl p-5 sm:p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-800">1 · Upload a document</h2>
        <p className="mt-1 text-sm text-slate-700">PDF only. New files appear in the list below and can be auto-selected.</p>
        <form onSubmit={onUploadPdf} className="mt-4 space-y-4">
          <label
            htmlFor="new-chat-pdf-input"
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              handlePickedPdf(e.dataTransfer.files);
            }}
            className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-4 py-8 text-center transition-colors sm:px-6 sm:py-10 ${
              isDragging ? "border-brand-500 bg-brand-50/50" : "border-slate-300/70 bg-white/30 hover:border-brand-400"
            }`}
          >
            <input
              id="new-chat-pdf-input"
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              className="sr-only"
              onChange={(e) => handlePickedPdf(e.target.files)}
            />
            <span className="wrap-break-word text-sm font-semibold text-slate-900">
              {file ? file.name : "Drop a PDF or click to browse"}
            </span>
            <span className="mt-1 text-xs text-slate-600">Max practical size depends on your machine and Ollama.</span>
          </label>
          <button
            type="submit"
            disabled={!file || isUploading}
            className="w-full rounded-2xl border border-brand-200 bg-white/60 py-3 text-sm font-semibold text-brand-900 hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isUploading ? "Uploading & ingesting…" : "Upload & add to library"}
          </button>
        </form>
        {uploadMessage && (
          <p
            className={`mt-3 wrap-break-word text-sm ${uploadStatus === "error" ? "text-rose-800" : "text-slate-800"}`}
            role="status"
          >
            {uploadMessage}
          </p>
        )}
      </section>

      <section className="glass-strong rounded-2xl p-5 sm:p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-800">2 · Name & documents</h2>
        <form onSubmit={onCreateChat} className="mt-4 space-y-4">
          <div>
            <label htmlFor="bot-name" className="text-xs font-semibold uppercase tracking-wide text-slate-700">
              Chatbot name
            </label>
            <input
              id="bot-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. HR handbook Q&A"
              className="glass-input mt-1 h-11 w-full rounded-xl px-4 text-base text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 sm:text-sm"
            />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">Documents for this chatbot</p>
            {docsLoading ? (
              <p className="mt-2 text-sm text-slate-700">Loading library…</p>
            ) : documents.length === 0 ? (
              <p className="mt-2 text-sm text-slate-700">
                No documents yet. Upload a PDF in step 1, or add files on{" "}
                <Link href="/dashboard/upload-document" className="font-semibold text-brand-800 underline-offset-2 hover:underline">
                  Upload Document
                </Link>
                .
              </p>
            ) : (
              <ul className="mt-2 max-h-64 space-y-1 overflow-y-auto rounded-xl border border-white/40 bg-white/30 p-2">
                {documents.map((d) => {
                  const isSite = d.kind === "site";
                  const pageCount = d.pageCount ?? 0;
                  return (
                    <li key={d.id}>
                      <label className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-lg px-2 py-2 hover:bg-white/50">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(d.id)}
                          onChange={() => toggleDoc(d.id)}
                          className="h-4 w-4 rounded border-slate-300 text-brand-700"
                        />
                        <span className="min-w-0 flex-1 truncate text-sm text-slate-900">{d.source}</span>
                        {isSite ? (
                          <span className="shrink-0 rounded-full bg-brand-700/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-800">
                            Site
                          </span>
                        ) : null}
                        <span className="hidden shrink-0 text-xs text-slate-700 sm:inline">
                          {d.chunks === 0
                            ? "Pending"
                            : isSite
                              ? `${pageCount} ${pageCount === 1 ? "page" : "pages"} · ${d.chunks} chunks`
                              : `${d.chunks} chunks`}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          {formError && (
            <p className="text-sm font-medium text-rose-800" role="alert">
              {formError}
            </p>
          )}
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <Link
              href="/dashboard/chatbot"
              className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white/60 px-5 py-3 text-sm font-medium text-slate-800 hover:bg-white/85"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={creating || selectedIds.size === 0}
              className="inline-flex items-center justify-center rounded-2xl bg-brand-700 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-700/20 hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {creating ? "Creating…" : "Create chatbot"}
            </button>
          </div>
        </form>
      </section>
    </PageContainer>
  );
}
