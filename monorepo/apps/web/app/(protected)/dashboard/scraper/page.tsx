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

  return (
    <div>
      <h1 className="text-2xl font-semibold text-zinc-900">Web Scraper</h1>
      <p className="mt-2 text-zinc-600">
        Scrape a single page or crawl an entire website following internal links.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4 max-w-2xl">
        {/* Action toggle */}
        <div className="flex gap-2 p-1 bg-zinc-100 rounded-lg w-fit">
          <button
            type="button"
            onClick={() => setAction("scrape")}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              action === "scrape"
                ? "bg-white text-zinc-900 shadow-sm"
                : "text-zinc-500 hover:text-zinc-700"
            }`}
          >
            Single Page
          </button>
          <button
            type="button"
            onClick={() => setAction("crawl")}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              action === "crawl"
                ? "bg-white text-zinc-900 shadow-sm"
                : "text-zinc-500 hover:text-zinc-700"
            }`}
          >
            Crawl Site
          </button>
        </div>

        <div>
          <label htmlFor="url" className="block text-sm font-medium text-zinc-700 mb-1">
            URL
          </label>
          <input
            id="url"
            type="url"
            required
            placeholder="https://example.com"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 outline-none"
          />
        </div>

        <div>
          <label htmlFor="mode" className="block text-sm font-medium text-zinc-700 mb-1">
            Mode
          </label>
          <select
            id="mode"
            value={mode}
            onChange={(e) => setMode(e.target.value as "auto" | "static" | "dynamic")}
            className="w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-sm text-zinc-900 bg-white focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 outline-none"
          >
            <option value="auto">Auto (detect)</option>
            <option value="static">Static (httpx)</option>
            <option value="dynamic">Dynamic (Playwright)</option>
          </select>
        </div>

        {action === "crawl" && (
          <div className="flex gap-4">
            <div className="flex-1">
              <label htmlFor="maxPages" className="block text-sm font-medium text-zinc-700 mb-1">
                Max Pages
              </label>
              <input
                id="maxPages"
                type="number"
                min={1}
                max={200}
                value={maxPages}
                onChange={(e) => setMaxPages(Number(e.target.value))}
                className="w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-sm text-zinc-900 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 outline-none"
              />
            </div>
            <div className="flex-1">
              <label htmlFor="maxDepth" className="block text-sm font-medium text-zinc-700 mb-1">
                Max Depth
              </label>
              <input
                id="maxDepth"
                type="number"
                min={1}
                max={10}
                value={maxDepth}
                onChange={(e) => setMaxDepth(Number(e.target.value))}
                className="w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-sm text-zinc-900 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 outline-none"
              />
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="self-start rounded-lg bg-sky-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading
            ? action === "scrape" ? "Scraping..." : "Crawling..."
            : action === "scrape" ? "Scrape" : "Start Crawl"}
        </button>
      </form>

      {/* Single scrape result */}
      {scrapeResult && (
        <div className="mt-8 max-w-4xl">
          {scrapeResult.success && scrapeResult.data ? (
            <div>
              <button
                type="button"
                onClick={() => {
                  const text = formatPageToText(scrapeResult.data!);
                  const hostname = new URL(scrapeResult.data!.url).hostname;
                  downloadTxt(text, `scrape-${hostname}.txt`);
                }}
                className="mb-4 inline-flex items-center gap-2 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download .txt
              </button>
              <PageResult data={scrapeResult.data} />
            </div>
          ) : (
            <ErrorBox error={scrapeResult.error} />
          )}
        </div>
      )}

      {/* Crawl result */}
      {crawlResult && (
        <div className="mt-8 max-w-4xl">
          {crawlResult.success ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-green-200 bg-green-50 p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <p className="text-sm font-medium text-green-800">
                    Crawled <span className="font-semibold">{crawlResult.total_pages}</span> pages
                  </p>
                  {crawlResult.failed_urls.length > 0 && (
                    <p className="text-sm text-amber-700">
                      {crawlResult.failed_urls.length} failed
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const sections = crawlResult.pages.map((page, i) =>
                      `${"=".repeat(60)}\nPage ${i + 1} of ${crawlResult.total_pages}\n${"=".repeat(60)}\n${formatPageToText(page)}`
                    );
                    const hostname = crawlResult.pages[0] ? new URL(crawlResult.pages[0].url).hostname : "site";
                    downloadTxt(sections.join("\n\n"), `crawl-${hostname}.txt`);
                  }}
                  className="inline-flex items-center gap-2 rounded-lg border border-green-300 bg-white px-4 py-2 text-sm font-medium text-green-700 hover:bg-green-50 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download All .txt
                </button>
              </div>

              {/* Page list */}
              <div className="space-y-2">
                {crawlResult.pages.map((page, i) => (
                  <div key={i} className="rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setExpandedPage(expandedPage === i ? null : i)}
                      className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-zinc-50 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-zinc-900 truncate">
                          {page.title || "(no title)"}
                        </p>
                        <p className="text-xs text-zinc-500 truncate mt-0.5">{page.url}</p>
                      </div>
                      <div className="flex items-center gap-3 ml-4 shrink-0">
                        <span className="text-xs text-zinc-400">{page.mode_used}</span>
                        <svg
                          className={`w-4 h-4 text-zinc-400 transition-transform ${expandedPage === i ? "rotate-180" : ""}`}
                          fill="none" stroke="currentColor" viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </button>
                    {expandedPage === i && (
                      <div className="border-t border-zinc-200 p-6">
                        <PageResult data={page} />
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Failed URLs */}
              {crawlResult.failed_urls.length > 0 && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-6">
                  <h3 className="text-sm font-medium text-red-800 mb-2">Failed URLs</h3>
                  <div className="space-y-1">
                    {crawlResult.failed_urls.map((f, i) => (
                      <div key={i} className="text-sm">
                        <span className="text-red-700 font-mono text-xs break-all">{f.url}</span>
                        <span className="text-red-500 ml-2">— {f.error}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <ErrorBox error={crawlResult.error} />
          )}
        </div>
      )}
    </div>
  );
}

function PageResult({ data }: { data: ScrapedData }) {
  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-green-200 bg-green-50 p-4">
        <p className="text-sm font-medium text-green-800">
          Scraped successfully using <span className="font-semibold">{data.mode_used}</span> mode
        </p>
      </div>

      {data.title && (
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-medium text-zinc-500">Title</h2>
          <p className="mt-1 text-lg text-zinc-900">{data.title}</p>
        </div>
      )}

      {data.meta_description && (
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-medium text-zinc-500">Meta Description</h2>
          <p className="mt-1 text-zinc-700">{data.meta_description}</p>
        </div>
      )}

      {Object.keys(data.headings).length > 0 && (
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-medium text-zinc-500 mb-3">Headings</h2>
          {Object.entries(data.headings).map(([tag, texts]) => (
            <div key={tag} className="mb-2">
              <span className="text-xs font-mono font-semibold text-sky-600 uppercase">{tag}</span>
              <ul className="ml-4 mt-1 space-y-0.5">
                {texts.map((text, i) => (
                  <li key={i} className="text-sm text-zinc-700">{text}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {data.links.length > 0 && (
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-medium text-zinc-500 mb-3">
            Links ({data.links.length})
          </h2>
          <div className="max-h-60 overflow-y-auto space-y-1">
            {data.links.map((link, i) => (
              <div key={i} className="text-sm">
                <span className="text-zinc-700">{link.text || "(no text)"}</span>
                <span className="text-zinc-400 ml-2 text-xs font-mono break-all">{link.href}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {data.text_content && (
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-medium text-zinc-500 mb-3">Text Content</h2>
          <pre className="text-sm text-zinc-700 whitespace-pre-wrap max-h-80 overflow-y-auto font-sans">
            {data.text_content}
          </pre>
        </div>
      )}
    </div>
  );
}

function ErrorBox({ error }: { error?: string }) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-4">
      <p className="text-sm font-medium text-red-800">
        Error: {error || "Unknown error"}
      </p>
    </div>
  );
}
