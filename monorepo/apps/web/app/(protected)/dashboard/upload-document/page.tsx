"use client";

import { FormEvent, useState } from "react";
import { useEffect } from "react";

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

export default function UploadDocumentPage() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState("idle");
  const [result, setResult] = useState("");
  const [sources, setSources] = useState<SourceItem[]>([]);
  const [loadingSources, setLoadingSources] = useState(true);
  const [deletingSource, setDeletingSource] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);

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
        ["Completed", "Succeeded", "Success", "Finished"].includes(job.status)
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

  return (
    <div>
      <h1 className="text-2xl font-semibold text-zinc-900">Upload Document</h1>
      <p className="mt-2 text-zinc-600">
        Upload PDF documents to ingest them into the chatbot knowledge base.
      </p>

      <form onSubmit={onUpload} className="mt-6 flex flex-col gap-4 max-w-2xl">
        <div>
          <label htmlFor="file" className="block text-sm font-medium text-zinc-700 mb-1">
            PDF File
          </label>
          <input
            id="file"
            className="w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-sm text-zinc-900 file:mr-4 file:rounded-md file:border-0 file:bg-zinc-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-zinc-700"
            type="file"
            accept=".pdf"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </div>
        <button
          className="self-start rounded-lg bg-sky-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          type="submit"
          disabled={!file || status === "uploading"}
        >
          {status === "uploading" ? "Uploading..." : "Ingest Document"}
        </button>
      </form>

      <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm max-w-2xl">
        <p className="text-sm text-zinc-600">Job status: {status}</p>
        <p className="mt-1 text-zinc-900">{result}</p>
      </div>

      {listError && (
        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 max-w-3xl">
          <p className="font-medium">Chatbot backend unreachable</p>
          <p className="mt-1 whitespace-pre-wrap">{listError}</p>
          <p className="mt-2 text-xs text-amber-900">
            From the monorepo root, start the API (port 8001 by default), then ensure{" "}
            <code className="rounded bg-amber-100/80 px-1">CHATBOT_API_URL</code> in the web app matches
            that URL.
          </p>
        </div>
      )}

      <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm max-w-3xl">
        <h2 className="text-lg font-medium text-zinc-900">My Documents</h2>
        {loadingSources ? (
          <p className="mt-2 text-sm text-zinc-500">Loading...</p>
        ) : sources.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">No documents uploaded yet.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {sources.map((item) => (
              <div
                key={item.source}
                className="flex items-center justify-between rounded-lg border border-zinc-200 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-zinc-900">{item.source}</p>
                  <p className="text-xs text-zinc-500">{item.chunks} chunks</p>
                </div>
                <button
                  type="button"
                  onClick={() => onDeleteSource(item.source)}
                  disabled={deletingSource === item.source}
                  className="rounded-md border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                >
                  {deletingSource === item.source ? "Deleting..." : "Delete"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

