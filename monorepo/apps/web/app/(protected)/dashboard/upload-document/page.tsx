"use client";

import { FormEvent, useState } from "react";

const CHATBOT_API_BASE =
  process.env.NEXT_PUBLIC_CHATBOT_API_BASE_URL ?? "http://127.0.0.1:8001";

type JobStatus = {
  status: string;
  output: {
    ingested?: number;
    source?: string;
  } | null;
};

async function pollJob(eventId: string): Promise<JobStatus> {
  for (let i = 0; i < 60; i += 1) {
    const res = await fetch(`${CHATBOT_API_BASE}/v1/jobs/${eventId}`);
    const data = (await res.json()) as JobStatus;
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

  async function onUpload(e: FormEvent) {
    e.preventDefault();
    if (!file) return;

    setStatus("uploading");
    setResult("");

    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`${CHATBOT_API_BASE}/v1/ingest`, {
        method: "POST",
        body: fd,
      });
      const { event_ids } = (await res.json()) as { event_ids: string[] };
      const eventId = event_ids[0];
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
    } catch (err) {
      setStatus("error");
      setResult(String(err));
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
    </div>
  );
}

