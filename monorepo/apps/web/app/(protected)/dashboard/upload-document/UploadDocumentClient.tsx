"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

import { PageContainer } from "@/components/shell/PageContainer";
import { PageHeader } from "@/components/shell/PageHeader";
import {
  assertOkJson,
  formatApiErrorMessage,
  parseJsonResponse,
} from "@/lib/chatbot/parseJsonResponse";
import { toast } from "@/lib/ui/toast";
import { extractErrorMessage } from "@/lib/ui/notifyMutation";

type JobStatus = {
  status: string;
  output: {
    ingested?: number;
    source?: string;
  } | null;
};

type SourceItem = {
  id: string;
  source: string;
  ragSourceKey?: string;
  chunks: number;
  kind?: "upload" | "site";
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

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function UploadDocumentClient() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState("idle");
  const [result, setResult] = useState("");
  const [sources, setSources] = useState<SourceItem[]>([]);
  const [loadingSources, setLoadingSources] = useState(true);
  const [deletingSource, setDeletingSource] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function loadSources() {
    setLoadingSources(true);
    setListError(null);
    try {
      const res = await fetch("/api/chatbot/documents");
      const data = await parseJsonResponse<{ sources?: SourceItem[] }>(res);
      if (!res.ok) {
        setSources([]);
        setListError(formatApiErrorMessage(data, res.status));
        return;
      }
      // The upload page only manages file uploads; scraped site aggregators live on /scraper.
      setSources((data.sources ?? []).filter((s) => s.kind !== "site"));
    } catch (err) {
      setSources([]);
      setListError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingSources(false);
    }
  }

  useEffect(() => {
    loadSources();
  }, []);

  async function onUpload(e: FormEvent) {
    e.preventDefault();
    if (!file) return;

    setStatus("uploading");
    setResult("");
    const loadingId = toast.loading(`Uploading ${file.name}…`);

    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/chatbot/ingest", {
        method: "POST",
        body: fd,
      });
      const body = await parseJsonResponse<{
        event_ids?: string[];
        document?: { id: string; source: string };
      }>(res);
      assertOkJson(res, body);
      const eventId = body.event_ids?.[0];
      const documentId = body.document?.id;
      if (!eventId) {
        throw new Error("No ingestion event ID returned from chatbot API.");
      }
      if (!documentId) {
        throw new Error("No document record returned from ingest.");
      }
      const job = await pollJob(eventId);
      setStatus(job.status);
      setResult(
        job.output?.ingested != null
          ? `Ingested ${job.output.ingested} chunks from ${body.document?.source ?? file.name}`
          : `Status: ${job.status}`
      );
      if (
        job.output?.ingested != null &&
        SUCCESS_STATES.includes(job.status)
      ) {
        const recordRes = await fetch("/api/chatbot/documents", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            documentId,
            chunks: job.output.ingested,
          }),
        });
        if (!recordRes.ok) {
          const errBody = await parseJsonResponse<unknown>(recordRes).catch(() => null);
          const msg = errBody
            ? formatApiErrorMessage(errBody, recordRes.status)
            : `Could not save document record (${recordRes.status})`;
          setResult((prev) => `${prev}\n${msg}`);
          toast.error(msg, { id: loadingId });
        } else {
          toast.success(
            `Document added — ${job.output.ingested.toLocaleString()} chunks indexed`,
            { id: loadingId },
          );
        }
      } else if (SUCCESS_STATES.includes(job.status)) {
        toast.success("Document added", { id: loadingId });
      } else {
        toast.error(`Ingest finished with status: ${job.status}`, {
          id: loadingId,
        });
      }
      await loadSources();
    } catch (err) {
      setStatus("error");
      const msg = extractErrorMessage(err, "Upload failed");
      setResult(msg);
      toast.error(msg, { id: loadingId });
    }
  }

  async function onDeleteSource(documentId: string) {
    setDeletingSource(documentId);
    setListError(null);
    const loadingId = toast.loading("Deleting document…");
    try {
      const res = await fetch(`/api/chatbot/documents/${encodeURIComponent(documentId)}`, {
        method: "DELETE",
      });
      if (res.status === 404) {
        setListError("This document was already removed. The list has been refreshed.");
        toast.info("Already removed — list refreshed", { id: loadingId });
        await loadSources();
        return;
      }
      const data = await parseJsonResponse<unknown>(res);
      if (!res.ok) {
        const msg = formatApiErrorMessage(data, res.status);
        setListError(msg);
        toast.error(msg, { id: loadingId });
        return;
      }
      toast.success("Document deleted", { id: loadingId });
      await loadSources();
    } catch (err) {
      const msg = extractErrorMessage(err, "Delete failed");
      setListError(msg);
      toast.error(msg, { id: loadingId });
    } finally {
      setDeletingSource(null);
    }
  }

  function handleFiles(files: FileList | null) {
    const picked = files?.[0];
    if (!picked) return;
    if (picked.type === "application/pdf" || picked.name.toLowerCase().endsWith(".pdf")) {
      setFile(picked);
    }
  }

  function onDrop(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  }

  const totalChunks = sources.reduce((sum, s) => sum + s.chunks, 0);
  const isUploading = status === "uploading";
  const isSuccess = SUCCESS_STATES.includes(status);
  const isError = status === "error";

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Ingestion · Step 2"
        title="Upload document"
        subtitle="Build your document library here. PDFs are chunked and indexed; when you create a chat, you choose which documents that chat may use."
      />

      {/* Two-column workspace */}
      <div className="grid gap-5 sm:gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        {/* Upload column */}
        <section className="space-y-5">
          <form onSubmit={onUpload} className="glass-strong space-y-5 rounded-2xl p-5 sm:p-6">
            <div className="flex items-center gap-2">
              <span
                className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-brand-700 text-xs font-semibold text-white"
                aria-hidden="true"
              >
                1
              </span>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-800">
                Choose a PDF
              </h2>
            </div>

            {/* Dropzone */}
            <label
              htmlFor="file"
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragEnter={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={onDrop}
              className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-4 py-8 text-center transition-all sm:px-6 sm:py-10 ${
                isDragging
                  ? "border-brand-500 bg-brand-50/50"
                  : "border-slate-300/70 bg-white/30 hover:border-brand-400 hover:bg-white/50"
              }`}
            >
              <div
                className="glass-muted mb-3 flex h-14 w-14 items-center justify-center rounded-2xl"
                aria-hidden="true"
              >
                <svg className="h-7 w-7 text-brand-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M7 16a4 4 0 01.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <p className="wrap-break-word text-sm font-semibold text-slate-900">
                {file ? "Replace file" : "Drop your PDF here"}
              </p>
              <p className="mt-1 text-xs text-slate-700">
                or <span className="font-semibold text-brand-800">click to browse</span> · PDF only
              </p>
              <input
                ref={fileInputRef}
                id="file"
                className="sr-only"
                type="file"
                accept=".pdf,application/pdf"
                onChange={(e) => handleFiles(e.target.files)}
              />
            </label>

            {/* Selected file preview */}
            {file && (
              <div className="glass flex items-center gap-3 rounded-xl p-3">
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-700/10"
                  aria-hidden="true"
                >
                  <svg className="h-5 w-5 text-brand-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-900">{file.name}</p>
                  <p className="text-xs text-slate-700">{formatBytes(file.size)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-white/60 hover:text-slate-900"
                  aria-label="Remove file"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}

            <button
              className="w-full rounded-xl bg-brand-700 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-700/20 transition-colors hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50"
              type="submit"
              disabled={!file || isUploading}
            >
              {isUploading ? "Ingesting…" : "Ingest document"}
            </button>
          </form>

          {/* Status panel — only when something happened */}
          {status !== "idle" && (
            <div
              className={`glass rounded-2xl p-4 sm:p-5 ${
                isSuccess ? "border-emerald-300/60" : isError ? "border-rose-300/60" : ""
              }`}
              role={isError ? "alert" : "status"}
              aria-live="polite"
            >
              <div className="flex items-center gap-3">
                <StatusIcon state={isUploading ? "loading" : isSuccess ? "success" : isError ? "error" : "info"} />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">Job status</p>
                  <p
                    className={`text-sm font-semibold ${
                      isSuccess ? "text-emerald-800" : isError ? "text-rose-800" : "text-slate-900"
                    }`}
                  >
                    {status}
                  </p>
                </div>
              </div>
              {result && (
                <p className="mt-3 wrap-break-word whitespace-pre-wrap rounded-xl bg-white/40 p-3 text-sm text-slate-800">
                  {result}
                </p>
              )}
            </div>
          )}

          {/* Backend error */}
          {listError && (
            <div
              className="glass rounded-2xl border-amber-300/60 p-4 text-sm text-amber-950 sm:p-5"
              role="alert"
            >
              <p className="font-semibold">Chatbot backend unreachable</p>
              <p className="mt-1 wrap-break-word whitespace-pre-wrap text-amber-900">{listError}</p>
              <p className="mt-2 text-xs text-amber-900/80">
                From the monorepo root, start the API (port 8001 by default), then ensure{" "}
                <code className="rounded bg-amber-100/80 px-1.5 py-0.5 font-mono">CHATBOT_API_URL</code> in the web app
                matches that URL.
              </p>
            </div>
          )}
        </section>

        {/* My Documents column */}
        <section className="glass-strong rounded-2xl p-5 sm:p-6">
          <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between sm:gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-700">Knowledge base</p>
              <h2 className="mt-0.5 text-lg font-semibold text-slate-900">My documents</h2>
            </div>
            <div className="flex gap-3">
              <Stat label="Documents" value={String(sources.length)} />
              <Stat label="Total chunks" value={totalChunks.toLocaleString()} />
            </div>
          </header>

          <div className="mt-5">
            {loadingSources ? (
              <div className="flex items-center justify-center py-12">
                <div
                  className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-brand-600"
                  aria-hidden="true"
                />
              </div>
            ) : sources.length === 0 ? (
              <div className="glass flex flex-col items-center justify-center rounded-2xl py-10 text-center sm:py-12">
                <div
                  className="glass-muted mb-3 flex h-12 w-12 items-center justify-center rounded-2xl"
                  aria-hidden="true"
                >
                  <svg className="h-6 w-6 text-brand-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <p className="text-sm font-semibold text-slate-900">No documents yet</p>
                <p className="mt-1 max-w-xs text-xs text-slate-700">
                  Upload your first PDF on the left to get started.
                </p>
              </div>
            ) : (
              <ul className="space-y-2">
                {sources.map((item) => (
                  <li
                    key={item.id}
                    className="glass flex items-center gap-3 rounded-xl px-3 py-3 sm:px-4"
                  >
                    <div
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-700/10"
                      aria-hidden="true"
                    >
                      <svg className="h-5 w-5 text-brand-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-900">{item.source}</p>
                      <p className="text-xs text-slate-700">{item.chunks.toLocaleString()} chunks</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onDeleteSource(item.id)}
                      disabled={deletingSource === item.id}
                      aria-label={`Delete ${item.source}`}
                      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-rose-300/70 bg-white/40 text-rose-700 backdrop-blur transition-colors hover:bg-rose-50/60 disabled:opacity-50 sm:h-9 sm:w-auto sm:px-3 sm:text-xs sm:font-semibold"
                    >
                      {deletingSource === item.id ? (
                        <span aria-hidden="true">…</span>
                      ) : (
                        <>
                          <svg
                            className="h-4 w-4 sm:hidden"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            aria-hidden="true"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3"
                            />
                          </svg>
                          <span className="hidden sm:inline">Delete</span>
                        </>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </PageContainer>
  );
}

/* ---------------------------- Sub-components ---------------------------- */

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass-muted flex-1 rounded-xl px-4 py-2 text-right sm:flex-initial">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-700">{label}</p>
      <p className="text-lg font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function StatusIcon({ state }: { state: "loading" | "success" | "error" | "info" }) {
  if (state === "loading") {
    return (
      <div
        className="inline-block h-9 w-9 shrink-0 animate-spin rounded-full border-4 border-slate-300 border-t-brand-600"
        aria-hidden="true"
      />
    );
  }
  if (state === "success") {
    return (
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100/70"
        aria-hidden="true"
      >
        <svg className="h-5 w-5 text-emerald-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
        </svg>
      </div>
    );
  }
  if (state === "error") {
    return (
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rose-100/70"
        aria-hidden="true"
      >
        <svg className="h-5 w-5 text-rose-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </div>
    );
  }
  return (
    <div
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100/70"
      aria-hidden="true"
    >
      <svg className="h-5 w-5 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    </div>
  );
}
