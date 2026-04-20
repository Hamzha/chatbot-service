import {
    appendIngestedPage,
    appendVisitingUrl,
    markCrawlJobCompleted,
    markCrawlJobFailed,
    markCrawlJobRunning,
    markUrlDone,
    markUrlFailed,
} from "@/lib/db/crawlJobRepo";
import { registerScrapedDocument } from "@/lib/scraper/registerScrapedDocument";

const SCRAPER_API_URL = process.env.SCRAPER_API_URL || "http://localhost:8000";

type CrawlStreamEvent =
    | { type: "start"; start_url: string; max_pages: number; max_depth: number }
    | { type: "visiting"; url: string; depth: number; index: number; max_pages: number }
    | {
          type: "page";
          url: string;
          depth: number;
          index: number;
          data: { url?: string; title?: string | null; text_content?: string };
      }
    | { type: "failed"; url: string; error: string }
    | { type: "done"; total_pages: number; failed_count: number }
    | { type: "error"; error: string };

export type CrawlJobInput = {
    jobId: string;
    userId: string;
    startUrl: string;
    mode: string;
    maxPages: number;
    maxDepth: number;
};

/**
 * Consume the scraper service's NDJSON stream and persist progress to Mongo in real time.
 * Designed to run detached from the HTTP request that started the job (e.g. via `void runCrawlJob(...)`),
 * so the crawl continues even after the client disconnects.
 *
 * Errors are swallowed: the job doc always ends in a terminal state (`completed` or `failed`) that the UI
 * can observe via polling `GET /api/scraper/crawl/jobs/:id`.
 */
export async function runCrawlJob(input: CrawlJobInput): Promise<void> {
    try {
        await markCrawlJobRunning(input.jobId);
    } catch (err) {
        console.error("[crawl-worker] failed to mark job running:", err);
        return;
    }

    let upstream: Response;
    try {
        upstream = await fetch(`${SCRAPER_API_URL}/api/v1/crawl/stream`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                url: input.startUrl,
                mode: input.mode,
                max_pages: input.maxPages,
                max_depth: input.maxDepth,
            }),
        });
    } catch (err) {
        await safeFailJob(input.jobId, `Scraper service unreachable: ${stringifyError(err)}`);
        return;
    }

    if (!upstream.ok || !upstream.body) {
        const detail = await upstream.text().catch(() => "");
        await safeFailJob(
            input.jobId,
            `Scraper upstream ${upstream.status}: ${detail.slice(0, 500)}`,
        );
        return;
    }

    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let streamError: string | null = null;

    const handleEvent = async (evt: CrawlStreamEvent): Promise<void> => {
        if (evt.type === "visiting") {
            await appendVisitingUrl(input.jobId, evt.url, evt.depth);
            return;
        }
        if (evt.type === "page") {
            const pageUrl = (evt.data?.url || evt.url || "").trim();
            const ingestion = await registerScrapedDocument(input.userId, {
                url: pageUrl,
                title: evt.data?.title ?? undefined,
                textContent: evt.data?.text_content ?? "",
            }).catch((err) => {
                console.error("[crawl-worker] ingest failed:", err);
                return null;
            });
            await markUrlDone(input.jobId, pageUrl, evt.depth, ingestion?.ingested);
            if (ingestion) {
                await appendIngestedPage(input.jobId, {
                    url: pageUrl,
                    displaySource: ingestion.displaySource,
                    ragSourceKey: ingestion.ragSourceKey,
                    ingested: ingestion.ingested,
                });
            }
            return;
        }
        if (evt.type === "failed") {
            await markUrlFailed(input.jobId, evt.url, evt.error);
            return;
        }
        if (evt.type === "error") {
            streamError = evt.error;
            return;
        }
        // "start" / "done" need no persistent action besides the terminal transition handled below.
    };

    try {
        for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            let idx: number;
            while ((idx = buffer.indexOf("\n")) !== -1) {
                const line = buffer.slice(0, idx).trim();
                buffer = buffer.slice(idx + 1);
                if (!line) continue;
                let evt: CrawlStreamEvent;
                try {
                    evt = JSON.parse(line) as CrawlStreamEvent;
                } catch {
                    continue;
                }
                await handleEvent(evt);
            }
        }
        const tail = buffer.trim();
        if (tail) {
            try {
                await handleEvent(JSON.parse(tail) as CrawlStreamEvent);
            } catch {
                /* ignore partial line */
            }
        }
    } catch (err) {
        streamError = stringifyError(err);
    }

    if (streamError) {
        await safeFailJob(input.jobId, streamError);
    } else {
        try {
            await markCrawlJobCompleted(input.jobId);
        } catch (err) {
            console.error("[crawl-worker] failed to mark job completed:", err);
        }
    }
}

async function safeFailJob(jobId: string, message: string): Promise<void> {
    try {
        await markCrawlJobFailed(jobId, message);
    } catch (err) {
        console.error("[crawl-worker] failed to mark job failed:", err);
    }
}

function stringifyError(err: unknown): string {
    if (err instanceof Error) return err.message;
    return String(err);
}
