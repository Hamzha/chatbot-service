"use client";

import { useState } from "react";

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

type ScrapeResponse = {
  success: boolean;
  data?: ScrapedData;
  error?: string;
};

type CrawlResponse = {
  success: boolean;
  total_pages: number;
  pages: ScrapedData[];
  failed_urls: { url: string; error: string }[];
  error?: string;
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

export default function ScraperPage() {
  const [url, setUrl] = useState("");
  const [mode, setMode] = useState<"auto" | "static" | "dynamic">("auto");
  const [action, setAction] = useState<ActionType>("scrape");
  const [maxPages, setMaxPages] = useState(10);
  const [maxDepth, setMaxDepth] = useState(2);
  const [loading, setLoading] = useState(false);
  const [scrapeResult, setScrapeResult] = useState<ScrapeResponse | null>(null);
  const [crawlResult, setCrawlResult] = useState<CrawlResponse | null>(null);
  const [expandedPage, setExpandedPage] = useState<number | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;

    setLoading(true);
    setScrapeResult(null);
    setCrawlResult(null);
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
      } else {
        const res = await fetch("/api/scraper/crawl", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url, mode, max_pages: maxPages, max_depth: maxDepth }),
        });
        const data: CrawlResponse = await res.json();
        setCrawlResult(data);
      }
    } catch (err) {
      if (action === "scrape") {
        setScrapeResult({ success: false, error: String(err) });
      } else {
        setCrawlResult({ success: false, total_pages: 0, pages: [], failed_urls: [], error: String(err) });
      }
    } finally {
      setLoading(false);
    }
  }

  const hasResult = Boolean(scrapeResult || crawlResult);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Page header */}
      <header className="glass-strong flex flex-wrap items-start justify-between gap-4 rounded-2xl p-6">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-700">Ingestion · Step 1</p>
          <h1 className="text-2xl font-semibold text-slate-900">Web Scraper</h1>
          <p className="max-w-2xl text-sm text-slate-600">
            Pull a single page or crawl an entire site to feed clean content into your chatbot knowledge base.
          </p>
        </div>

        {/* Action toggle moves into header */}
        <div className="glass flex gap-1 rounded-xl p-1">
          <button
            type="button"
            onClick={() => setAction("scrape")}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              action === "scrape"
                ? "bg-white/85 text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700 hover:bg-white/40"
            }`}
          >
            Single Page
          </button>
          <button
            type="button"
            onClick={() => setAction("crawl")}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              action === "crawl"
                ? "bg-white/85 text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700 hover:bg-white/40"
            }`}
          >
            Crawl Site
          </button>
        </div>
      </header>

      {/* Two-column workspace */}
      <div className="grid gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
        {/* Config form */}
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <form onSubmit={handleSubmit} className="glass-strong space-y-5 rounded-2xl p-6">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-brand-700 text-xs font-semibold text-white">
                {action === "scrape" ? "1" : "1"}
              </span>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
                {action === "scrape" ? "Scrape configuration" : "Crawl configuration"}
              </h2>
            </div>

            <div>
              <label htmlFor="url" className="block text-sm font-medium text-slate-700 mb-1.5">
                Target URL
              </label>
              <input
                id="url"
                type="url"
                required
                placeholder="https://example.com"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="glass-input w-full rounded-xl px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none"
              />
              <p className="mt-1.5 text-xs text-slate-500">
                Include the protocol (http:// or https://).
              </p>
            </div>

            <div>
              <label htmlFor="mode" className="block text-sm font-medium text-slate-700 mb-1.5">
                Render mode
              </label>
              <select
                id="mode"
                value={mode}
                onChange={(e) => setMode(e.target.value as "auto" | "static" | "dynamic")}
                className="glass-input w-full rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none"
              >
                <option value="auto">Auto (detect)</option>
                <option value="static">Static (httpx)</option>
                <option value="dynamic">Dynamic (Playwright)</option>
              </select>
            </div>

            {action === "crawl" && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="maxPages" className="block text-sm font-medium text-slate-700 mb-1.5">
                    Max pages
                  </label>
                  <input
                    id="maxPages"
                    type="number"
                    min={1}
                    max={200}
                    value={maxPages}
                    onChange={(e) => setMaxPages(Number(e.target.value))}
                    className="glass-input w-full rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="maxDepth" className="block text-sm font-medium text-slate-700 mb-1.5">
                    Max depth
                  </label>
                  <input
                    id="maxDepth"
                    type="number"
                    min={1}
                    max={10}
                    value={maxDepth}
                    onChange={(e) => setMaxDepth(Number(e.target.value))}
                    className="glass-input w-full rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-brand-700 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-700/20 hover:bg-brand-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading
                ? action === "scrape" ? "Scraping..." : "Crawling..."
                : action === "scrape" ? "Scrape page" : "Start crawl"}
            </button>

            {/* Quick tips */}
            <div className="border-t border-white/30 pt-4 text-xs text-slate-500 space-y-1.5">
              <p className="font-semibold uppercase tracking-wide text-slate-600">Tips</p>
              <p>· Use <span className="font-medium text-slate-700">Static</span> for fast, plain HTML pages.</p>
              <p>· Use <span className="font-medium text-slate-700">Dynamic</span> for JS-heavy sites.</p>
              {action === "crawl" && (
                <p>· Crawl follows internal links only, up to depth {maxDepth}.</p>
              )}
            </div>
          </form>
        </aside>

        {/* Results pane */}
        <section className="min-w-0">
          {!hasResult && !loading && <EmptyResults action={action} />}
          {loading && <LoadingResults action={action} />}

          {scrapeResult && !loading && (
            scrapeResult.success && scrapeResult.data ? (
              <ScrapeResultView
                data={scrapeResult.data}
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
        </section>
      </div>
    </div>
  );
}

/* ---------------------------- Sub-views ---------------------------- */

function EmptyResults({ action }: { action: ActionType }) {
  return (
    <div className="glass flex min-h-[420px] flex-col items-center justify-center rounded-2xl p-10 text-center">
      <div className="glass-muted mb-4 flex h-14 w-14 items-center justify-center rounded-2xl">
        <svg className="h-7 w-7 text-brand-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
        </svg>
      </div>
      <h3 className="text-base font-semibold text-slate-900">
        {action === "scrape" ? "No page scraped yet" : "No crawl run yet"}
      </h3>
      <p className="mt-1 max-w-sm text-sm text-slate-500">
        {action === "scrape"
          ? "Enter a URL on the left and hit Scrape page to extract its title, headings, links, and text content."
          : "Enter a starting URL on the left to crawl an entire site following internal links."}
      </p>
    </div>
  );
}

function LoadingResults({ action }: { action: ActionType }) {
  return (
    <div className="glass flex min-h-[420px] flex-col items-center justify-center rounded-2xl p-10 text-center">
      <div className="mb-4 inline-block h-10 w-10 animate-spin rounded-full border-4 border-slate-300 border-t-brand-600" />
      <p className="text-sm font-medium text-slate-700">
        {action === "scrape" ? "Fetching page..." : "Crawling site..."}
      </p>
      <p className="mt-1 text-xs text-slate-500">This can take a few seconds depending on the site.</p>
    </div>
  );
}

function ScrapeResultView({ data, onDownload }: { data: ScrapedData; onDownload: () => void }) {
  return (
    <div className="space-y-5">
      {/* Status + actions bar */}
      <div className="glass flex flex-wrap items-center justify-between gap-3 rounded-2xl border-emerald-300/60 px-5 py-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-emerald-800">
            Scraped successfully · <span className="font-semibold">{data.mode_used}</span> mode
          </p>
          <p className="mt-0.5 truncate text-xs text-slate-500">{data.url}</p>
        </div>
        <button
          type="button"
          onClick={onDownload}
          className="glass inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-slate-700 hover:bg-white/80 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Download .txt
        </button>
      </div>

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
      <div className="glass-strong rounded-2xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Stat label="Pages crawled" value={String(result.total_pages)} tone="brand" />
            <Stat label="Failed" value={String(result.failed_urls.length)} tone={result.failed_urls.length ? "warn" : "muted"} />
            <Stat label="Status" value="Done" tone="success" />
          </div>
          <button
            type="button"
            onClick={onDownloadAll}
            className="glass inline-flex items-center gap-2 rounded-xl border-emerald-300/60 px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-white/80 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download all
          </button>
        </div>
      </div>

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
                  className="w-full px-4 py-3 flex items-center gap-4 text-left hover:bg-white/40 transition-colors rounded-xl"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-700/10 text-xs font-semibold text-brand-800">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-900 truncate">
                      {page.title || "(no title)"}
                    </p>
                    <p className="text-xs text-slate-500 truncate">{page.url}</p>
                  </div>
                  <span className="hidden sm:inline-flex glass-muted shrink-0 rounded-md px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-600">
                    {page.mode_used}
                  </span>
                  <svg
                    className={`w-4 h-4 shrink-0 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {isOpen && (
                  <div className="px-4 pb-5 pt-2">
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
        <div className="glass rounded-2xl border-rose-300/60 p-5">
          <h3 className="text-sm font-semibold text-rose-800 mb-3">
            Failed URLs ({result.failed_urls.length})
          </h3>
          <ul className="space-y-1.5">
            {result.failed_urls.map((f, i) => (
              <li key={i} className="text-sm">
                <span className="text-rose-700 font-mono text-xs break-all">{f.url}</span>
                <span className="text-rose-500 ml-2">— {f.error}</span>
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
    : tone === "success" ? "text-emerald-700"
    : tone === "warn" ? "text-amber-700"
    : "text-slate-500";
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
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
        <div className="glass rounded-2xl p-6">
          {data.title && (
            <>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Title</p>
              <h3 className="mt-1 text-lg font-semibold text-slate-900">{data.title}</h3>
            </>
          )}
          {data.meta_description && (
            <>
              <p className="mt-4 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Meta description</p>
              <p className="mt-1 text-sm leading-6 text-slate-700">{data.meta_description}</p>
            </>
          )}
        </div>
      )}

      {/* Headings + Links side by side on wide screens */}
      <div className="grid gap-5 lg:grid-cols-2">
        {Object.keys(data.headings).length > 0 && (
          <div className="glass rounded-2xl p-6">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-700">Headings</h2>
              <span className="text-xs text-slate-500">{headingCount} total</span>
            </div>
            <div className="max-h-64 overflow-y-auto space-y-3 pr-1">
              {Object.entries(data.headings).map(([tag, texts]) => (
                <div key={tag}>
                  <span className="text-[10px] font-mono font-semibold text-brand-700 uppercase">{tag}</span>
                  <ul className="ml-3 mt-1 space-y-0.5">
                    {texts.map((text, i) => (
                      <li key={i} className="text-sm text-slate-700">{text}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}

        {data.links.length > 0 && (
          <div className="glass rounded-2xl p-6">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-700">Links</h2>
              <span className="text-xs text-slate-500">{data.links.length} total</span>
            </div>
            <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1">
              {data.links.map((link, i) => (
                <div key={i} className="text-sm">
                  <span className="text-slate-700">{link.text || "(no text)"}</span>
                  <span className="text-slate-400 ml-2 text-xs font-mono break-all">{link.href}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Text content full width */}
      {data.text_content && (
        <div className="glass rounded-2xl p-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">Text content</h2>
            <span className="text-xs text-slate-500">{data.text_content.length.toLocaleString()} chars</span>
          </div>
          <pre className="text-sm text-slate-700 whitespace-pre-wrap max-h-96 overflow-y-auto font-sans leading-6">
            {data.text_content}
          </pre>
        </div>
      )}
    </div>
  );
}

function ErrorBox({ error }: { error?: string }) {
  return (
    <div className="glass flex min-h-[200px] flex-col items-center justify-center rounded-2xl border-rose-300/60 p-8 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-rose-100/60">
        <svg className="h-6 w-6 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <p className="text-sm font-semibold text-rose-800">Something went wrong</p>
      <p className="mt-1 max-w-md text-sm text-rose-700/90">{error || "Unknown error"}</p>
    </div>
  );
}
