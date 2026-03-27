"use client";

import { FormEvent, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

type JobStatus = {
  status: string;
  output: {
    answer?: string;
    sources?: string[];
    ingested?: number;
    source?: string;
  } | null;
};

async function pollJob(eventId: string): Promise<JobStatus> {
  for (let i = 0; i < 60; i += 1) {
    const res = await fetch(`${API_BASE}/v1/jobs/${eventId}`);
    const data = (await res.json()) as JobStatus;
    if (["Completed", "Succeeded", "Success", "Finished"].includes(data.status)) {
      return data;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  return { status: "timeout", output: null };
}

export default function Page() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [sources, setSources] = useState<string[]>([]);
  const [status, setStatus] = useState("idle");

  const [file, setFile] = useState<File | null>(null);
  const [ingestResult, setIngestResult] = useState("");

  async function onAsk(e: FormEvent) {
    e.preventDefault();
    setStatus("querying");
    setAnswer("");
    setSources([]);

    const res = await fetch(`${API_BASE}/v1/query`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ question, top_k: 4 }),
    });
    const { event_ids } = (await res.json()) as { event_ids: string[] };
    const job = await pollJob(event_ids[0]);
    setStatus(job.status);
    setAnswer(job.output?.answer ?? "");
    setSources(job.output?.sources ?? []);
  }

  async function onUpload(e: FormEvent) {
    e.preventDefault();
    if (!file) return;
    setIngestResult("uploading...");
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`${API_BASE}/v1/ingest`, { method: "POST", body: fd });
    const { event_ids } = (await res.json()) as { event_ids: string[] };
    const job = await pollJob(event_ids[0]);
    setIngestResult(
      job.output?.ingested != null
        ? `ingested ${job.output.ingested} chunks from ${job.output.source}`
        : `status: ${job.status}`
    );
  }

  return (
    <main>
      <h1>Chatbot UI (Next.js)</h1>
      <p className="muted">Provider is selected in backend env: openai or ollama.</p>

      <section className="card">
        <h3>1) Upload PDF</h3>
        <form onSubmit={onUpload} className="row">
          <input
            className="full"
            type="file"
            accept=".pdf"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <button className="btn" type="submit">
            Ingest
          </button>
        </form>
        <p className="muted">{ingestResult}</p>
      </section>

      <section className="card">
        <h3>2) Ask Question</h3>
        <form onSubmit={onAsk} className="row">
          <input
            className="full"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask something from your ingested PDFs"
          />
          <button className="btn" type="submit">
            Ask
          </button>
        </form>
        <p className="muted">Job status: {status}</p>
        <p>{answer}</p>
        {sources.length > 0 && <p className="muted">Sources: {sources.join(", ")}</p>}
      </section>
    </main>
  );
}

