"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

import {
  assertOkJson,
  formatApiErrorMessage,
  parseJsonResponse,
} from "@/lib/chatbot/parseJsonResponse";

type JobStatus = {
  status: string;
  output: {
    ingested?: number;
    source?: string;
  } | null;
};

type SourceItem = {
  source: string;
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

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function UploadDocumentPage() {
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
      setSources(data.sources ?? []);
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

    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/chatbot/ingest", {
        method: "POST",
        body: fd,
      });
      const body = await parseJsonResponse<{ event_ids?: string[] }>(res);
      assertOkJson(res, body);
      const eventId = body.event_ids?.[0];
      if (!eventId) {
        throw new Error("No ingestion event ID returned from chatbot API.");
      }
      const job = await pollJob(eventId);
      setStatus(job.status);
      setResult(
        job.output?.ingested != null
          ? `Ingested ${job.output.ingested} chunks from ${job.output.source ?? file.name}`
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
            source: job.output.source ?? file.name,
            chunks: job.output.ingested,
          }),
        });
        if (!recordRes.ok) {
          const errBody = await parseJsonResponse<unknown>(recordRes).catch(() => null);
          const msg = errBody
            ? formatApiErrorMessage(errBody, recordRes.status)
            : `Could not save document record (${recordRes.status})`;
          setResult((prev) => `${prev}\n${msg}`);
        }
      }
      await loadSources();
    } catch (err) {
      setStatus("error");
      setResult(String(err));
    }
  }

  async function onDeleteSource(source: string) {
    setDeletingSource(source);
    setListError(null);
    try {
      const res = await fetch(`/api/chatbot/documents/${encodeURIComponent(source)}`, {
        method: "DELETE",
      });
      const data = await parseJsonResponse<unknown>(res);
      if (!res.ok) {
        setListError(formatApiErrorMessage(data, res.status));
        return;
      }
      await loadSources();
    } catch (err) {
      setListError(err instanceof Error ? err.message : String(err));
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
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Page header */}
      <header className="glass-strong rounded-2xl p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-700">Ingestion · Step 2</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">Upload Document</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-600">
          Drop a PDF here to embed it into the chatbot knowledge base. Each upload is chunked and stored in the
          vector index.
        </p>
      </header>

      {/* Two-column workspace */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        {/* Upload column */}
        <section className="space-y-5">
          <form onSubmit={onUpload} className="glass-strong rounded-2xl p-6 space-y-5">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-brand-700 text-xs font-semibold text-white">
                1
              </span>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
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
              className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-all ${
                isDragging
                  ? "border-brand-500 bg-brand-50/50"
                  : "border-slate-300/70 bg-white/30 hover:border-brand-400 hover:bg-white/50"
              }`}
            >
              <div className="glass-muted mb-3 flex h-14 w-14 items-center justify-center rounded-2xl">
                <svg className="h-7 w-7 text-brand-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M7 16a4 4 0 01.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-slate-900">
                {file ? "Replace file" : "Drop your PDF here"}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                or <span className="font-medium text-brand-700">click to browse</span> · PDF only
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
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-700/10">
                  <svg className="h-5 w-5 text-brand-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">{file.name}</p>
                  <p className="text-xs text-slate-500">{formatBytes(file.size)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-white/60 hover:text-slate-700 transition-colors"
                  aria-label="Remove file"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}

            <button
              className="w-full rounded-xl bg-brand-700 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-700/20 hover:bg-brand-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              type="submit"
              disabled={!file || isUploading}
            >
              {isUploading ? "Ingesting..." : "Ingest document"}
            </button>
          </form>

          {/* Status panel — only when something happened */}
          {status !== "idle" && (
            <div
              className={`glass rounded-2xl p-5 ${
                isSuccess ? "border-emerald-300/60" : isError ? "border-rose-300/60" : ""
              }`}
            >
              <div className="flex items-center gap-3">
                <StatusIcon state={isUploading ? "loading" : isSuccess ? "success" : isError ? "error" : "info"} />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Job status</p>
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
                <p className="mt-3 whitespace-pre-wrap rounded-xl bg-white/40 p-3 text-sm text-slate-700">
                  {result}
                </p>
              )}
            </div>
          )}

          {/* Backend error */}
          {listError && (
            <div className="glass rounded-2xl border-amber-300/60 p-5 text-sm text-amber-950">
              <p className="font-semibold">Chatbot backend unreachable</p>
              <p className="mt-1 whitespace-pre-wrap text-amber-900">{listError}</p>
              <p className="mt-2 text-xs text-amber-900/80">
                From the monorepo root, start the API (port 8001 by default), then ensure{" "}
                <code className="rounded bg-amber-100/80 px-1.5 py-0.5 font-mono">CHATBOT_API_URL</code> in the web app
                matches that URL.
              </p>
            </div>
          )}
        </section>

        {/* My Documents column */}
        <section className="glass-strong rounded-2xl p-6">
          <header className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-700">Knowledge base</p>
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
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-brand-600" />
              </div>
            ) : sources.length === 0 ? (
              <div className="glass flex flex-col items-center justify-center rounded-2xl py-12 text-center">
                <div className="glass-muted mb-3 flex h-12 w-12 items-center justify-center rounded-2xl">
                  <svg className="h-6 w-6 text-brand-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <p className="text-sm font-semibold text-slate-900">No documents yet</p>
                <p className="mt-1 max-w-xs text-xs text-slate-500">
                  Upload your first PDF on the left to get started.
                </p>
              </div>
            ) : (
              <ul className="space-y-2">
                {sources.map((item) => (
                  <li
                    key={item.source}
                    className="glass flex items-center gap-3 rounded-xl px-4 py-3"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-700/10">
                      <svg className="h-5 w-5 text-brand-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900">{item.source}</p>
                      <p className="text-xs text-slate-500">{item.chunks.toLocaleString()} chunks</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onDeleteSource(item.source)}
                      disabled={deletingSource === item.source}
                      className="shrink-0 rounded-lg border border-rose-300/70 bg-white/40 px-3 py-1.5 text-xs font-medium text-rose-700 backdrop-blur hover:bg-rose-50/60 disabled:opacity-50 transition-colors"
                    >
                      {deletingSource === item.source ? "Deleting..." : "Delete"}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

/* ---------------------------- Sub-components ---------------------------- */

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass-muted rounded-xl px-4 py-2 text-right">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="text-lg font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function StatusIcon({ state }: { state: "loading" | "success" | "error" | "info" }) {
  if (state === "loading") {
    return (
      <div className="inline-block h-9 w-9 shrink-0 animate-spin rounded-full border-4 border-slate-300 border-t-brand-600" />
    );
  }
  if (state === "success") {
    return (
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100/70">
        <svg className="h-5 w-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
        </svg>
      </div>
    );
  }
  if (state === "error") {
    return (
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rose-100/70">
        <svg className="h-5 w-5 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </div>
    );
  }
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100/70">
      <svg className="h-5 w-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    </div>
  );
}
