import Link from "next/link";
import { requirePagePermission } from "@/lib/auth/requirePagePermission";

type PipelineStep = {
  step: number;
  title: string;
  description: string;
  href: string;
  cta: string;
  icon: React.ReactNode;
};

const PIPELINE: PipelineStep[] = [
  {
    step: 1,
    title: "Web Scraper",
    description: "Pull a single page or crawl an entire site to collect clean text content.",
    href: "/dashboard/scraper",
    cta: "Open scraper",
    icon: (
      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
      </svg>
    ),
  },
  {
    step: 2,
    title: "Upload Document",
    description: "Embed PDFs into the vector index so the chatbot can reference them.",
    href: "/dashboard/upload-document",
    cta: "Upload PDFs",
    icon: (
      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M7 16a4 4 0 01.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
      </svg>
    ),
  },
  {
    step: 3,
    title: "Chatbot",
    description: "Ask questions and get RAG-backed answers grounded in your knowledge base.",
    href: "/dashboard/chatbot",
    cta: "Start chatting",
    icon: (
      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-4l-4 4v-4z" />
      </svg>
    ),
  },
];

export default async function DashboardPage() {
  const { user } = await requirePagePermission("dashboard:read");
  const firstName = user.name?.split(" ")[0] ?? "there";

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Welcome header */}
      <header className="glass-strong relative overflow-hidden rounded-2xl p-8">
        <div className="relative z-10 flex flex-wrap items-start justify-between gap-6">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-700">Dashboard · Overview</p>
            <h1 className="text-3xl font-semibold text-slate-900">Welcome back, {firstName}</h1>
            <p className="max-w-2xl text-sm leading-6 text-slate-600">
              Here is your three-step workflow for turning raw web pages and documents into reliable chatbot
              answers. Pick up where you left off, or jump straight into the chatbot.
            </p>
          </div>
          <Link
            href="/dashboard/chatbot"
            className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-700/20 transition hover:bg-brand-800"
          >
            Open chatbot
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </Link>
        </div>
      </header>

      {/* Pipeline */}
      <section>
        <div className="mb-3 flex items-center justify-between px-1">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Your pipeline</h2>
          <span className="text-xs text-slate-500">3 steps</span>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          {PIPELINE.map((item, i) => (
            <Link
              key={item.step}
              href={item.href}
              className="glass-strong group relative flex flex-col rounded-2xl p-6 transition-all hover:-translate-y-0.5 hover:shadow-xl"
            >
              {/* Step badge + connector */}
              <div className="mb-5 flex items-center justify-between">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-brand-700 text-sm font-semibold text-white shadow-lg shadow-brand-700/20">
                  {item.step}
                </span>
                {i < PIPELINE.length - 1 && (
                  <span className="hidden text-slate-300 md:inline-flex" aria-hidden="true">
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </span>
                )}
              </div>

              {/* Icon disc */}
              <div className="glass-muted mb-4 flex h-12 w-12 items-center justify-center rounded-2xl text-brand-700">
                {item.icon}
              </div>

              <h3 className="text-lg font-semibold text-slate-900">{item.title}</h3>
              <p className="mt-1 text-sm leading-6 text-slate-600">{item.description}</p>

              <div className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 transition group-hover:gap-2.5">
                {item.cta}
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Bottom row: getting started + tips */}
      <section className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <div className="glass-strong rounded-2xl p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-700">Getting started</p>
          <h2 className="mt-1 text-lg font-semibold text-slate-900">Build your knowledge base in three moves</h2>
          <ol className="mt-5 space-y-4">
            <Step
              num="1"
              title="Collect content"
              body="Use the scraper to grab text from public websites, or upload PDFs you already have on hand."
            />
            <Step
              num="2"
              title="Ingest into the vector index"
              body="Each document is automatically chunked and embedded. The status panel shows when ingestion is complete."
            />
            <Step
              num="3"
              title="Ask the chatbot"
              body="Questions are answered using only your indexed content. Sources for each reply appear alongside the conversation."
            />
          </ol>
        </div>

        <aside className="glass-dark flex flex-col rounded-2xl p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-200">Tips</p>
          <h3 className="mt-1 text-lg font-semibold text-white">Get better answers</h3>
          <ul className="mt-4 space-y-3 text-sm text-slate-200">
            <Tip>Upload focused, high-quality PDFs over giant catch-all dumps.</Tip>
            <Tip>Use the scraper&apos;s <span className="font-semibold text-white">dynamic</span> mode for JS-heavy sites.</Tip>
            <Tip>Phrase questions specifically &mdash; the more context, the better the retrieval.</Tip>
            <Tip>Clear the conversation when switching topics so old context doesn&apos;t bleed in.</Tip>
          </ul>
        </aside>
      </section>
    </div>
  );
}

function Step({ num, title, body }: { num: string; title: string; body: string }) {
  return (
    <li className="flex gap-4">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-700/10 text-xs font-semibold text-brand-800">
        {num}
      </span>
      <div>
        <p className="text-sm font-semibold text-slate-900">{title}</p>
        <p className="mt-0.5 text-sm leading-6 text-slate-600">{body}</p>
      </div>
    </li>
  );
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-brand-300" aria-hidden="true" />
      <span className="leading-6">{children}</span>
    </li>
  );
}
