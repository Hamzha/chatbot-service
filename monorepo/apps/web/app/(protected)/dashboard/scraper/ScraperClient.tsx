"use client";

import { useEffect, useRef, useState } from "react";

import { PageContainer } from "@/components/shell/PageContainer";
import { toast } from "@/lib/ui/toast";
import { extractErrorMessage } from "@/lib/ui/notifyMutation";

type ScrapedData = {
  url: string;
  title: string | null;
  meta_description: string | null;
  headings: Record<string, string[]>;
  links: { text: string; href: string }[];
  images: { alt: string; src: string }[];
  text_content: string;
  tables: string[][][];
  mode_used: string;
};

type IngestionSummary = {
  ingested: number;
  displaySource: string;
  ragSourceKey: string;
};

type ScrapeResponse = {
  success: boolean;
  data?: ScrapedData;
  ingestion?: IngestionSummary;
  error?: string;
};

type CrawlIngestedPage = {
  url: string;
  displaySource: string;
  ragSourceKey: string;
  ingested: number;
};

type CrawlResponse = {
  success: boolean;
  total_pages: number;
  pages: ScrapedData[];
  failed_urls: { url: string; error: string }[];
  ingestion?: { pages: CrawlIngestedPage[] };
  error?: string;
};

type KnowledgeBaseItem = {
  id: string;
  source: string;
  ragSourceKey?: string;
  chunks: number;
  kind?: "upload" | "site";
  pageCount?: number;
};

type CrawlLiveRow = {
  url: string;
  depth: number;
  status: "visiting" | "done" | "failed";
  chunks?: number;
  error?: string;
};

type CrawlLiveState = {
  jobId: string;
  maxPages: number;
  maxDepth: number;
  startedAt: number;
  rows: CrawlLiveRow[];
  doneCount: number;
  failedCount: number;
  finished: boolean;
};

type CrawlJobRecord = {
  id: string;
  userId: string;
  startUrl: string;
  mode: string;
  maxPages: number;
  maxDepth: number;
  state: "queued" | "running" | "completed" | "failed";
  doneCount: number;
  failedCount: number;
  urls: Array<{
    url: string;
    depth: number;
    status: "visiting" | "done" | "failed";
    chunks?: number;
    error?: string;
    at: string;
  }>;
  ingestedPages: CrawlIngestedPage[];
  error?: string;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  finishedAt?: string;
};

type ActionType = "scrape" | "crawl";

function formatPageToText(data: ScrapedData): string {
  const lines: string[] = [];
  lines.push(`URL: ${data.url}`);
  lines.push(`Mode: ${data.mode_used}`);
  if (data.title) lines.push(`Title: ${data.title}`);
  if (data.meta_description) lines.push(`Description: ${data.meta_description}`);

  if (Object.keys(data.headings).length > 0) {
    lines.push("\n--- Headings ---");
    for (const [tag, texts] of Object.entries(data.headings)) {
      for (const text of texts) {
        lines.push(`  [${tag}] ${text}`);
      }
    }
  }

  if (data.links.length > 0) {
    lines.push(`\n--- Links (${data.links.length}) ---`);
    for (const link of data.links) {
      lines.push(`  ${link.text || "(no text)"} -> ${link.href}`);
    }
  }

  if (data.text_content) {
    lines.push("\n--- Text Content ---");
    lines.push(data.text_content);
  }

  return lines.join("\n");
}

function downloadTxt(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ScraperClient() {
  const [url, setUrl] = useState("");
  const [mode, setMode] = useState<"auto" | "static" | "dynamic">("auto");
  const [action, setAction] = useState<ActionType>("scrape");
  const [maxPages, setMaxPages] = useState(10);
  const [maxDepth, setMaxDepth] = useState(2);
  const [loading, setLoading] = useState(false);
  const [scrapeResult, setScrapeResult] = useState<ScrapeResponse | null>(null);
  const [crawlResult, setCrawlResult] = useState<CrawlResponse | null>(null);
  const [expandedPage, setExpandedPage] = useState<number | null>(null);

  const [kbItems, setKbItems] = useState<KnowledgeBaseItem[]>([]);
  const [kbLoading, setKbLoading] = useState(true);
  const [kbError, setKbError] = useState<string | null>(null);
  const [kbDeleting, setKbDeleting] = useState<string | null>(null);

  const [crawlLive, setCrawlLive] = useState<CrawlLiveState | null>(null);
  const pollTokenRef = useRef(0);

  async function loadKnowledgeBase() {
    setKbLoading(true);
    setKbError(null);
    try {
      const res = await fetch("/api/chatbot/documents");
      const data = (await res.json().catch(() => ({}))) as {
        sources?: KnowledgeBaseItem[];
        error?: string;
      };
      if (!res.ok) {
        setKbItems([]);
        setKbError(data.error || `Failed to load knowledge base (${res.status})`);
        return;
      }
      // "Scraped" = either the new site aggregator rows or legacy per-page rows
      // whose ragSourceKey is a URL. This way the page surface both models during
      // the transition period.
      const onlyScraped = (data.sources ?? []).filter(
        (s) => s.kind === "site" || /^https?:\/\//i.test(s.ragSourceKey ?? ""),
      );
      setKbItems(onlyScraped);
    } catch (err) {
      setKbItems([]);
      setKbError(err instanceof Error ? err.message : String(err));
    } finally {
      setKbLoading(false);
    }
  }

  useEffect(() => {
    loadKnowledgeBase();
  }, []);

  async function onDeleteKbItem(documentId: string) {
    setKbDeleting(documentId);
    setKbError(null);
    const loadingId = toast.loading("Deleting source…");
    try {
      const res = await fetch(`/api/chatbot/documents/${encodeURIComponent(documentId)}`, {
        method: "DELETE",
      });
      if (res.status === 404) {
        // Local list was stale (another tab deleted it, or the Mongo row was
        // re-seeded). Refresh to re-sync and surface a non-scary message.
        setKbError(
          "This item was already removed. The list has been refreshed.",
        );
        toast.info("Already removed — list refreshed", { id: loadingId });
        await loadKnowledgeBase();
        return;
      }
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        const msg = body.error || `Delete failed (${res.status})`;
        setKbError(msg);
        toast.error(msg, { id: loadingId });
        return;
      }
      toast.success("Source deleted", { id: loadingId });
      await loadKnowledgeBase();
    } catch (err) {
      const msg = extractErrorMessage(err, "Delete failed");
      setKbError(msg);
      toast.error(msg, { id: loadingId });
    } finally {
      setKbDeleting(null);
    }
  }

  function jobToLiveState(job: CrawlJobRecord): CrawlLiveState {
    const startedAtTs = job.startedAt
      ? new Date(job.startedAt).getTime()
      : new Date(job.createdAt).getTime();
    return {
      jobId: job.id,
      maxPages: job.maxPages,
      maxDepth: job.maxDepth,
      startedAt: Number.isFinite(startedAtTs) ? startedAtTs : Date.now(),
      rows: job.urls.map((u) => ({
        url: u.url,
        depth: u.depth,
        status: u.status,
        chunks: u.chunks,
        error: u.error,
      })),
      doneCount: job.doneCount,
      failedCount: job.failedCount,
      finished: job.state === "completed" || job.state === "failed",
    };
  }

  function jobToCrawlResult(job: CrawlJobRecord): CrawlResponse {
    return {
      success: job.state === "completed",
      total_pages: job.doneCount,
      pages: [],
      failed_urls: job.urls
        .filter((u) => u.status === "failed")
        .map((u) => ({ url: u.url, error: u.error ?? "Unknown error" })),
      ingestion: { pages: job.ingestedPages },
      error: job.error,
    };
  }

  async function pollCrawlJob(jobId: string, token: number) {
    const POLL_MS = 1000;
    // Poll until the user starts another action (token bumps) or the job hits a terminal state.
    while (pollTokenRef.current === token) {
      try {
        const res = await fetch(
          `/api/scraper/crawl/jobs/${encodeURIComponent(jobId)}`,
          { cache: "no-store" },
        );
        if (!res.ok) {
          if (res.status === 404) {
            setCrawlResult({
              success: false,
              total_pages: 0,
              pages: [],
              failed_urls: [],
              error: "Crawl job disappeared.",
            });
            return;
          }
          await new Promise((r) => setTimeout(r, POLL_MS));
          continue;
        }
        const body = (await res.json()) as { job: CrawlJobRecord };
        const job = body.job;
        setCrawlLive(jobToLiveState(job));
        if (job.state === "completed" || job.state === "failed") {
          setCrawlResult(jobToCrawlResult(job));
          if (job.state === "completed") {
            const totalChunks = job.ingestedPages.reduce(
              (a, p) => a + p.ingested,
              0,
            );
            toast.success(
              `Crawl finished — ${job.doneCount} page${job.doneCount === 1 ? "" : "s"}, ${totalChunks.toLocaleString()} chunks`,
            );
          } else {
            toast.error(
              job.error ? `Crawl failed: ${job.error}` : "Crawl failed",
            );
          }
          await loadKnowledgeBase();
          return;
        }
      } catch (err) {
        console.error("poll crawl job failed:", err);
      }
      await new Promise((r) => setTimeout(r, POLL_MS));
    }
  }

  async function startCrawlJob(): Promise<void> {
    pollTokenRef.current += 1;
    const token = pollTokenRef.current;
    setCrawlLive({
      jobId: "",
      maxPages,
      maxDepth,
      startedAt: Date.now(),
      rows: [],
      doneCount: 0,
      failedCount: 0,
      finished: false,
    });

    let res: Response;
    try {
      res = await fetch("/api/scraper/crawl/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          mode,
          max_pages: maxPages,
          max_depth: maxDepth,
        }),
      });
    } catch (err) {
      setCrawlResult({
        success: false,
        total_pages: 0,
        pages: [],
        failed_urls: [],
        error: String(err),
      });
      setCrawlLive((prev) => (prev ? { ...prev, finished: true } : prev));
      return;
    }

    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setCrawlResult({
        success: false,
        total_pages: 0,
        pages: [],
        failed_urls: [],
        error: body.error || `Could not start crawl (${res.status})`,
      });
      setCrawlLive((prev) => (prev ? { ...prev, finished: true } : prev));
      return;
    }

    const body = (await res.json()) as { job: CrawlJobRecord };
    setCrawlLive(jobToLiveState(body.job));
    await pollCrawlJob(body.job.id, token);
  }

  async function resumeActiveCrawl() {
    try {
      const res = await fetch("/api/scraper/crawl/jobs", { cache: "no-store" });
      if (!res.ok) return;
      const body = (await res.json()) as { jobs: CrawlJobRecord[] };
      const active = body.jobs.find(
        (j) => j.state === "queued" || j.state === "running",
      );
      if (!active) return;
      pollTokenRef.current += 1;
      const token = pollTokenRef.current;
      setAction("crawl");
      setCrawlLive(jobToLiveState(active));
      setLoading(true);
      try {
        await pollCrawlJob(active.id, token);
      } finally {
        setLoading(false);
      }
    } catch (err) {
      console.error("resume active crawl failed:", err);
    }
  }

  useEffect(() => {
    resumeActiveCrawl();
    return () => {
      pollTokenRef.current += 1;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;

    setLoading(true);
    setScrapeResult(null);
    setCrawlResult(null);
    setCrawlLive(null);
    setExpandedPage(null);

    try {
      if (action === "scrape") {
        const res = await fetch("/api/scraper/scrape", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url, mode }),
        });
        const data: ScrapeResponse = await res.json();
        setScrapeResult(data);
        if (data.success) {
          const ingested = data.ingestion?.ingested ?? 0;
          toast.success(
            ingested > 0
              ? `Page scraped — ${ingested.toLocaleString()} chunks indexed`
              : "Page scraped",
          );
        } else {
          toast.error(data.error || "Scrape failed");
        }
      } else {
        toast.info("Crawl started");
        await startCrawlJob();
      }
      await loadKnowledgeBase();
    } catch (err) {
      const msg = extractErrorMessage(err, "Request failed");
      if (action === "scrape") {
        setScrapeResult({ success: false, error: msg });
      } else {
        setCrawlResult({ success: false, total_pages: 0, pages: [], failed_urls: [], error: msg });
      }
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  const hasResult = Boolean(scrapeResult || crawlResult);

  return (
    <PageContainer>
      {/* Page header */}
      <header className="glass-strong flex flex-col gap-4 rounded-2xl p-5 sm:p-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-700">Ingestion · Step 1</p>
          <h1 className="text-2xl font-semibold leading-tight tracking-tight text-slate-900 sm:text-3xl">Web scraper</h1>
          <p className="max-w-2xl text-sm leading-6 text-slate-700">
            Pull a single page or crawl an entire site to feed clean content into your chatbot knowledge base.
          </p>
        </div>

        {/* Action toggle */}
        <div
          className="glass flex w-full gap-1 rounded-xl p-1 sm:w-auto"
          role="radiogroup"
          aria-label="Scrape action"
        >
          <button
            type="button"
            role="radio"
            aria-checked={action === "scrape"}
            onClick={() => setAction("scrape")}
            className={`min-h-[40px] flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition-colors sm:flex-initial ${
              action === "scrape"
                ? "bg-white/85 text-slate-900 shadow-sm"
                : "text-slate-700 hover:bg-white/40 hover:text-slate-900"
            }`}
          >
            Single page
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={action === "crawl"}
            onClick={() => setAction("crawl")}
            className={`min-h-[40px] flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition-colors sm:flex-initial ${
              action === "crawl"
                ? "bg-white/85 text-slate-900 shadow-sm"
                : "text-slate-700 hover:bg-white/40 hover:text-slate-900"
            }`}
          >
            Crawl site
          </button>
        </div>
      </header>

      {/* Two-column workspace */}
      <div className="grid gap-5 sm:gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
        {/* Config form */}
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <form onSubmit={handleSubmit} className="glass-strong space-y-5 rounded-2xl p-5 sm:p-6">
            <div className="flex items-center gap-2">
              <span
                className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-brand-700 text-xs font-semibold text-white"
                aria-hidden="true"
              >
                1
              </span>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-800">
                {action === "scrape" ? "Scrape configuration" : "Crawl configuration"}
              </h2>
            </div>

            <div>
              <label htmlFor="url" className="mb-1.5 block text-sm font-semibold text-slate-800">
                Target URL
              </label>
              <input
                id="url"
                type="url"
                required
                placeholder="https://example.com"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="glass-input w-full rounded-xl px-4 py-2.5 text-base text-slate-900 placeholder:text-slate-500 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 sm:text-sm"
              />
              <p className="mt-1.5 text-xs text-slate-600">
                Include the protocol (http:// or https://).
              </p>
            </div>

            <div>
              <label htmlFor="mode" className="mb-1.5 block text-sm font-semibold text-slate-800">
                Render mode
              </label>
              <select
                id="mode"
                value={mode}
                onChange={(e) => setMode(e.target.value as "auto" | "static" | "dynamic")}
                className="glass-input w-full rounded-xl px-4 py-2.5 text-base text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 sm:text-sm"
              >
                <option value="auto">Auto (detect)</option>
                <option value="static">Static (httpx)</option>
                <option value="dynamic">Dynamic (Playwright)</option>
              </select>
            </div>

            {action === "crawl" && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="maxPages" className="mb-1.5 block text-sm font-semibold text-slate-800">
                    Max pages
                  </label>
                  <input
                    id="maxPages"
                    type="number"
                    min={1}
                    max={200}
                    value={maxPages}
                    onChange={(e) => setMaxPages(Number(e.target.value))}
                    className="glass-input w-full rounded-xl px-4 py-2.5 text-base text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 sm:text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="maxDepth" className="mb-1.5 block text-sm font-semibold text-slate-800">
                    Max depth
                  </label>
                  <input
                    id="maxDepth"
                    type="number"
                    min={1}
                    max={10}
                    value={maxDepth}
                    onChange={(e) => setMaxDepth(Number(e.target.value))}
                    className="glass-input w-full rounded-xl px-4 py-2.5 text-base text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 sm:text-sm"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-brand-700 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-700/20 transition-colors hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading
                ? action === "scrape" ? "Scraping…" : "Crawling…"
                : action === "scrape" ? "Scrape page" : "Start crawl"}
            </button>

            {/* Quick tips */}
            <div className="space-y-1.5 border-t border-white/30 pt-4 text-xs leading-5 text-slate-700">
              <p className="font-semibold uppercase tracking-wide text-slate-800">Tips</p>
              <p>· Use <span className="font-semibold text-slate-900">Static</span> for fast, plain HTML pages.</p>
              <p>· Use <span className="font-semibold text-slate-900">Dynamic</span> for JS-heavy sites.</p>
              {action === "crawl" && (
                <p>· Crawl follows internal links only, up to depth {maxDepth}.</p>
              )}
            </div>
          </form>
        </aside>

        {/* Results pane */}
        <section className="min-w-0">
          {!hasResult && !loading && !crawlLive && <EmptyResults action={action} />}
          {loading && action === "scrape" && <LoadingResults action="scrape" />}
          {action === "crawl" && crawlLive && !crawlResult && (
            <CrawlProgressPanel state={crawlLive} />
          )}

          {scrapeResult && !loading && (
            scrapeResult.success && scrapeResult.data ? (
              <ScrapeResultView
                data={scrapeResult.data}
                ingestion={scrapeResult.ingestion}
                onDownload={() => {
                  const text = formatPageToText(scrapeResult.data!);
                  const hostname = new URL(scrapeResult.data!.url).hostname;
                  downloadTxt(text, `scrape-${hostname}.txt`);
                }}
              />
            ) : (
              <ErrorBox error={scrapeResult.error} />
            )
          )}

          {crawlResult && !loading && (
            crawlResult.success ? (
              <CrawlResultView
                result={crawlResult}
                expandedPage={expandedPage}
                setExpandedPage={setExpandedPage}
                onDownloadAll={() => {
                  const sections = crawlResult.pages.map((page, i) =>
                    `${"=".repeat(60)}\nPage ${i + 1} of ${crawlResult.total_pages}\n${"=".repeat(60)}\n${formatPageToText(page)}`
                  );
                  const hostname = crawlResult.pages[0] ? new URL(crawlResult.pages[0].url).hostname : "site";
                  downloadTxt(sections.join("\n\n"), `crawl-${hostname}.txt`);
                }}
              />
            ) : (
              <ErrorBox error={crawlResult.error} />
            )
          )}

          {/* Knowledge base list — shared with Upload Document */}
          <KnowledgeBaseList
            items={kbItems}
            loading={kbLoading}
            error={kbError}
            deletingId={kbDeleting}
            onDelete={onDeleteKbItem}
            className="mt-5 sm:mt-6"
          />
        </section>
      </div>
    </PageContainer>
  );
}

function KnowledgeBaseList({
  items,
  loading,
  error,
  deletingId,
  onDelete,
  className,
}: {
  items: KnowledgeBaseItem[];
  loading: boolean;
  error: string | null;
  deletingId: string | null;
  onDelete: (id: string) => void;
  className?: string;
}) {
  const totalChunks = items.reduce((sum, s) => sum + s.chunks, 0);
  return (
    <section className={`glass-strong rounded-2xl p-5 sm:p-6 ${className ?? ""}`}>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between sm:gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-700">
            Knowledge base
          </p>
          <h2 className="mt-0.5 text-lg font-semibold text-slate-900">Scraped pages</h2>
          <p className="mt-1 text-xs text-slate-600">
            Only pages you&apos;ve scraped or crawled are listed here. Uploaded PDFs live on the Upload Document page.
          </p>
        </div>
        <div className="flex gap-3">
          <div className="glass-muted flex-1 rounded-xl px-4 py-2 text-right sm:flex-initial">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-700">
              Items
            </p>
            <p className="text-lg font-semibold text-slate-900">{items.length}</p>
          </div>
          <div className="glass-muted flex-1 rounded-xl px-4 py-2 text-right sm:flex-initial">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-700">
              Total chunks
            </p>
            <p className="text-lg font-semibold text-slate-900">
              {totalChunks.toLocaleString()}
            </p>
          </div>
        </div>
      </header>

      {error && (
        <p
          className="mt-4 rounded-xl bg-amber-50/70 px-4 py-2 text-sm text-amber-950"
          role="alert"
        >
          {error}
        </p>
      )}

      <div className="mt-5">
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <div
              className="inline-block h-7 w-7 animate-spin rounded-full border-4 border-slate-300 border-t-brand-600"
              aria-hidden="true"
            />
          </div>
        ) : items.length === 0 ? (
          <div className="glass rounded-2xl py-10 text-center text-sm text-slate-700">
            No scraped pages yet. Run a scrape or crawl above to index a URL.
          </div>
        ) : (
          <ul className="space-y-2">
            {items.map((item) => {
              const isUrl = /^https?:\/\//i.test(item.ragSourceKey ?? "");
              const isSite = item.kind === "site";
              const pageCount = item.pageCount ?? 0;
              return (
                <li
                  key={item.id}
                  className="glass flex items-center gap-3 rounded-xl px-3 py-3 sm:px-4"
                >
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-700/10"
                    aria-hidden="true"
                  >
                    {isUrl ? (
                      <svg className="h-5 w-5 text-brand-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13.828 10.172a4 4 0 015.656 0l.707.707a4 4 0 010 5.656l-3.182 3.182a4 4 0 01-5.656 0l-.707-.707m-1.414-7.071l-.707-.707a4 4 0 010-5.656L11.707 2.79a4 4 0 015.656 0l.707.707" />
                      </svg>
                    ) : (
                      <svg className="h-5 w-5 text-brand-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold text-slate-900">{item.source}</p>
                      {isSite ? (
                        <span className="shrink-0 rounded-full bg-brand-700/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-800">
                          Site
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-0.5 wrap-break-word text-xs text-slate-700">
                      {isSite
                        ? `${pageCount.toLocaleString()} ${pageCount === 1 ? "page" : "pages"} · ${item.chunks.toLocaleString()} chunks`
                        : `${item.chunks.toLocaleString()} chunks`}
                      {isUrl && !isSite && item.ragSourceKey ? ` · ${item.ragSourceKey}` : ""}
                      {isSite && item.ragSourceKey ? ` · ${item.ragSourceKey}` : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onDelete(item.id)}
                    disabled={deletingId === item.id}
                    aria-label={`Delete ${item.source}`}
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-rose-300/70 bg-white/40 text-rose-700 backdrop-blur transition-colors hover:bg-rose-50/60 disabled:opacity-50 sm:h-9 sm:w-auto sm:px-3 sm:text-xs sm:font-semibold"
                  >
                    {deletingId === item.id ? (
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
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

/* ---------------------------- Sub-views ---------------------------- */

function EmptyResults({ action }: { action: ActionType }) {
  return (
    <div className="glass flex min-h-[320px] flex-col items-center justify-center rounded-2xl p-6 text-center sm:min-h-[420px] sm:p-10">
      <div className="glass-muted mb-4 flex h-14 w-14 items-center justify-center rounded-2xl" aria-hidden="true">
        <svg className="h-7 w-7 text-brand-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
        </svg>
      </div>
      <h3 className="text-base font-semibold text-slate-900">
        {action === "scrape" ? "No page scraped yet" : "No crawl run yet"}
      </h3>
      <p className="mt-1 max-w-sm text-sm text-slate-700">
        {action === "scrape"
          ? "Enter a URL on the left and hit Scrape page to extract its title, headings, links, and text content."
          : "Enter a starting URL on the left to crawl an entire site following internal links."}
      </p>
    </div>
  );
}

function LoadingResults({ action }: { action: ActionType }) {
  return (
    <div
      className="glass flex min-h-[320px] flex-col items-center justify-center rounded-2xl p-6 text-center sm:min-h-[420px] sm:p-10"
      role="status"
      aria-live="polite"
    >
      <div
        className="mb-4 inline-block h-10 w-10 animate-spin rounded-full border-4 border-slate-300 border-t-brand-600"
        aria-hidden="true"
      />
      <p className="text-sm font-semibold text-slate-800">
        {action === "scrape" ? "Fetching page…" : "Crawling site…"}
      </p>
      <p className="mt-1 text-xs text-slate-700">This can take a few seconds depending on the site.</p>
    </div>
  );
}

function CrawlProgressPanel({ state }: { state: CrawlLiveState }) {
  const { rows, maxPages, maxDepth, doneCount, failedCount, finished, startedAt } = state;
  const visitingRow = rows.find((r) => r.status === "visiting");
  const progressPct = Math.min(100, Math.round((doneCount / Math.max(1, maxPages)) * 100));
  const elapsedSec = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));

  // Newest first so the active URL is near the top
  const ordered = rows.slice().reverse();

  return (
    <div className="space-y-4">
      <div className="glass-strong rounded-2xl p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            {!finished ? (
              <div
                className="inline-block h-8 w-8 shrink-0 animate-spin rounded-full border-4 border-slate-300 border-t-brand-600"
                aria-hidden="true"
              />
            ) : (
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100/70"
                aria-hidden="true"
              >
                <svg className="h-4 w-4 text-emerald-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            )}
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900">
                {finished
                  ? "Crawl finished"
                  : visitingRow
                    ? "Crawling site"
                    : "Starting crawl…"}
              </p>
              <p className="mt-0.5 truncate text-xs text-slate-700">
                {visitingRow ? `Visiting: ${visitingRow.url}` : `Elapsed ${elapsedSec}s`}
              </p>
            </div>
          </div>
          <div className="flex gap-3 text-right">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-700">Done</p>
              <p className="text-base font-semibold text-brand-800">
                {doneCount} / {maxPages}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-700">Failed</p>
              <p
                className={`text-base font-semibold ${
                  failedCount > 0 ? "text-amber-800" : "text-slate-700"
                }`}
              >
                {failedCount}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-700">Depth</p>
              <p className="text-base font-semibold text-slate-800">{maxDepth}</p>
            </div>
          </div>
        </div>
        <div
          className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-white/50"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progressPct}
        >
          <div
            className="h-full bg-brand-600 transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      <div className="glass rounded-2xl p-2">
        {rows.length === 0 ? (
          <div className="py-8 text-center text-sm text-slate-700">
            Waiting for the first URL…
          </div>
        ) : (
          <ul className="max-h-[480px] divide-y divide-white/30 overflow-y-auto">
            {ordered.map((row) => (
              <li
                key={row.url}
                className="flex items-center gap-3 px-3 py-2.5 sm:px-4"
              >
                <CrawlRowStatus status={row.status} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-slate-900">{row.url}</p>
                  {row.status === "failed" && row.error && (
                    <p className="truncate text-xs text-rose-700">{row.error}</p>
                  )}
                </div>
                <span className="glass-muted shrink-0 rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-700">
                  d{row.depth}
                </span>
                {row.status === "done" && (
                  <span className="hidden shrink-0 text-xs font-medium text-slate-700 sm:inline">
                    {row.chunks != null ? `${row.chunks.toLocaleString()} chunks` : "indexed"}
                  </span>
                )}
                {row.status === "visiting" && (
                  <span className="shrink-0 text-xs font-semibold text-brand-800">crawling…</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function CrawlRowStatus({ status }: { status: CrawlLiveRow["status"] }) {
  if (status === "visiting") {
    return (
      <span className="inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-slate-300 border-t-brand-600" />
    );
  }
  if (status === "done") {
    return (
      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-100/80">
        <svg className="h-3 w-3 text-emerald-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
        </svg>
      </span>
    );
  }
  return (
    <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-rose-100/80">
      <svg className="h-3 w-3 text-rose-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
      </svg>
    </span>
  );
}

function ScrapeResultView({
  data,
  ingestion,
  onDownload,
}: {
  data: ScrapedData;
  ingestion?: IngestionSummary;
  onDownload: () => void;
}) {
  return (
    <div className="space-y-5">
      {/* Status + actions bar */}
      <div className="glass flex flex-col gap-3 rounded-2xl border-emerald-300/60 p-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:px-5 sm:py-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-emerald-800">
            Scraped successfully · <span className="font-semibold">{data.mode_used}</span> mode
          </p>
          <p className="mt-0.5 truncate text-xs text-slate-700">{data.url}</p>
        </div>
        <button
          type="button"
          onClick={onDownload}
          className="glass inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-800 transition-colors hover:bg-white/85 sm:w-auto"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Download .txt
        </button>
      </div>

      {ingestion && ingestion.ingested > 0 && (
        <div className="glass flex items-center gap-3 rounded-2xl border-brand-300/60 p-4 sm:px-5 sm:py-4">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100/70"
            aria-hidden="true"
          >
            <svg className="h-5 w-5 text-brand-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-brand-800">
              Added to your knowledge base · {ingestion.ingested.toLocaleString()} chunks indexed
            </p>
            <p className="mt-0.5 truncate text-xs text-slate-700">{ingestion.displaySource}</p>
          </div>
        </div>
      )}

      <PageResult data={data} />
    </div>
  );
}

function CrawlResultView({
  result,
  expandedPage,
  setExpandedPage,
  onDownloadAll,
}: {
  result: CrawlResponse;
  expandedPage: number | null;
  setExpandedPage: (n: number | null) => void;
  onDownloadAll: () => void;
}) {
  return (
    <div className="space-y-5">
      {/* Stats bar */}
      <div className="glass-strong rounded-2xl p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="Pages crawled" value={String(result.total_pages)} tone="brand" />
            <Stat label="Failed" value={String(result.failed_urls.length)} tone={result.failed_urls.length ? "warn" : "muted"} />
            <Stat
              label="Indexed"
              value={String(result.ingestion?.pages.length ?? 0)}
              tone="success"
            />
            <Stat
              label="Chunks"
              value={(result.ingestion?.pages.reduce((a, p) => a + p.ingested, 0) ?? 0).toLocaleString()}
              tone="brand"
            />
          </div>
          <button
            type="button"
            onClick={onDownloadAll}
            className="glass inline-flex w-full items-center justify-center gap-2 rounded-xl border-emerald-300/60 px-4 py-2.5 text-sm font-semibold text-emerald-800 transition-colors hover:bg-white/85 sm:w-auto"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download all
          </button>
        </div>
      </div>

      {result.ingestion && result.ingestion.pages.length > 0 && (
        <div className="glass rounded-2xl border-brand-300/60 p-4 sm:p-5">
          <h3 className="mb-3 text-sm font-semibold text-brand-800">
            Added to your knowledge base ({result.ingestion.pages.length})
          </h3>
          <ul className="max-h-48 space-y-1.5 overflow-y-auto pr-1">
            {result.ingestion.pages.map((p, i) => (
              <li key={i} className="flex justify-between gap-3 text-xs text-slate-800">
                <span className="min-w-0 flex-1 truncate">{p.displaySource}</span>
                <span className="shrink-0 font-semibold text-slate-700">
                  {p.ingested.toLocaleString()} chunks
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Page list */}
      <div className="glass rounded-2xl p-2">
        <ul className="divide-y divide-white/30">
          {result.pages.map((page, i) => {
            const isOpen = expandedPage === i;
            return (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => setExpandedPage(isOpen ? null : i)}
                  aria-expanded={isOpen}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-white/40 sm:gap-4 sm:px-4"
                >
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-700/10 text-xs font-semibold text-brand-800"
                    aria-hidden="true"
                  >
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {page.title || "(no title)"}
                    </p>
                    <p className="truncate text-xs text-slate-700">{page.url}</p>
                  </div>
                  <span className="glass-muted hidden shrink-0 rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-700 sm:inline-flex">
                    {page.mode_used}
                  </span>
                  <svg
                    className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${isOpen ? "rotate-180" : ""}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {isOpen && (
                  <div className="px-3 pb-5 pt-2 sm:px-4">
                    <PageResult data={page} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {/* Failed URLs */}
      {result.failed_urls.length > 0 && (
        <div className="glass rounded-2xl border-rose-300/60 p-4 sm:p-5">
          <h3 className="mb-3 text-sm font-semibold text-rose-800">
            Failed URLs ({result.failed_urls.length})
          </h3>
          <ul className="space-y-1.5">
            {result.failed_urls.map((f, i) => (
              <li key={i} className="text-sm">
                <span className="break-all font-mono text-xs text-rose-800">{f.url}</span>
                <span className="ml-2 text-rose-700">— {f.error}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "brand" | "success" | "warn" | "muted";
}) {
  const toneClass =
    tone === "brand" ? "text-brand-800"
    : tone === "success" ? "text-emerald-800"
    : tone === "warn" ? "text-amber-800"
    : "text-slate-700";
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-700">{label}</p>
      <p className={`mt-0.5 text-2xl font-semibold ${toneClass}`}>{value}</p>
    </div>
  );
}

function PageResult({ data }: { data: ScrapedData }) {
  const headingCount = Object.values(data.headings).reduce((a, b) => a + b.length, 0);

  return (
    <div className="space-y-5">
      {/* Hero: title + meta */}
      {(data.title || data.meta_description) && (
        <div className="glass rounded-2xl p-5 sm:p-6">
          {data.title && (
            <>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-700">Title</p>
              <h3 className="mt-1 wrap-break-word text-lg font-semibold text-slate-900">{data.title}</h3>
            </>
          )}
          {data.meta_description && (
            <>
              <p className="mt-4 text-[11px] font-semibold uppercase tracking-wider text-slate-700">Meta description</p>
              <p className="mt-1 text-sm leading-6 text-slate-800">{data.meta_description}</p>
            </>
          )}
        </div>
      )}

      {/* Headings + Links side by side on wide screens */}
      <div className="grid gap-5 lg:grid-cols-2">
        {Object.keys(data.headings).length > 0 && (
          <div className="glass rounded-2xl p-5 sm:p-6">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-800">Headings</h2>
              <span className="text-xs text-slate-700">{headingCount} total</span>
            </div>
            <div className="max-h-64 space-y-3 overflow-y-auto pr-1">
              {Object.entries(data.headings).map(([tag, texts]) => (
                <div key={tag}>
                  <span className="font-mono text-[10px] font-semibold uppercase text-brand-800">{tag}</span>
                  <ul className="ml-3 mt-1 space-y-0.5">
                    {texts.map((text, i) => (
                      <li key={i} className="wrap-break-word text-sm text-slate-800">{text}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}

        {data.links.length > 0 && (
          <div className="glass rounded-2xl p-5 sm:p-6">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-800">Links</h2>
              <span className="text-xs text-slate-700">{data.links.length} total</span>
            </div>
            <div className="max-h-64 space-y-1.5 overflow-y-auto pr-1">
              {data.links.map((link, i) => (
                <div key={i} className="text-sm">
                  <span className="wrap-break-word text-slate-800">{link.text || "(no text)"}</span>
                  <span className="ml-2 break-all font-mono text-xs text-slate-600">{link.href}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Text content full width */}
      {data.text_content && (
        <div className="glass rounded-2xl p-5 sm:p-6">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-slate-800">Text content</h2>
            <span className="shrink-0 text-xs text-slate-700">{data.text_content.length.toLocaleString()} chars</span>
          </div>
          <pre className="max-h-96 overflow-y-auto whitespace-pre-wrap font-sans text-sm leading-6 text-slate-800">
            {data.text_content}
          </pre>
        </div>
      )}
    </div>
  );
}

function ErrorBox({ error }: { error?: string }) {
  return (
    <div
      className="glass flex min-h-[200px] flex-col items-center justify-center rounded-2xl border-rose-300/60 p-6 text-center sm:p-8"
      role="alert"
    >
      <div
        className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-rose-100/60"
        aria-hidden="true"
      >
        <svg className="h-6 w-6 text-rose-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <p className="text-sm font-semibold text-rose-800">Something went wrong</p>
      <p className="mt-1 max-w-md wrap-break-word text-sm text-rose-800">{error || "Unknown error"}</p>
    </div>
  );
}
