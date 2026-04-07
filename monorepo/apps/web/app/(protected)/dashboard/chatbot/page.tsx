"use client";

import { FormEvent, useState } from "react";

import { assertOkJson, parseJsonResponse } from "@/lib/chatbot/parseJsonResponse";

type JobStatus = {
  status: string;
  output: {
    answer?: string;
    sources?: string[];
  } | null;
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
  const [answer, setAnswer] = useState("");
  const [sources, setSources] = useState<string[]>([]);

  async function onAsk(e: FormEvent) {
    e.preventDefault();
    if (!question.trim()) return;

    setStatus("querying");
    setAnswer("");
    setSources([]);

    try {
      const res = await fetch("/api/chatbot/query", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question, top_k: 4 }),
      });
      const body = await parseJsonResponse<{ event_ids?: string[] }>(res);
      assertOkJson(res, body);
      const eventId = body.event_ids?.[0];
      if (!eventId) {
        throw new Error("No query event ID returned from chatbot API.");
      }
      const job = await pollJob(eventId);
      setStatus(job.status);
      setAnswer(job.output?.answer ?? "");
      setSources(job.output?.sources ?? []);
    } catch (err) {
      setStatus("error");
      setAnswer(String(err));
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-zinc-900">Chatbot</h1>
      <p className="mt-2 text-zinc-600">
        Ask questions based on documents uploaded in the Upload Document section.
      </p>

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
          {status === "querying" ? "Asking..." : "Ask"}
        </button>
      </form>

      <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm max-w-4xl">
        <p className="text-sm text-zinc-600">Job status: {status}</p>
        <p className="mt-2 text-zinc-900 whitespace-pre-wrap">{answer}</p>
        {sources.length > 0 && (
          <p className="mt-3 text-sm text-zinc-500">Sources: {sources.join(", ")}</p>
        )}
      </div>
    </div>
  );
}

