import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/crawlJobRepo", () => ({
    appendIngestedPage: vi.fn(),
    appendVisitingUrl: vi.fn(),
    markCrawlJobCompleted: vi.fn(),
    markCrawlJobFailed: vi.fn(),
    markCrawlJobRunning: vi.fn(),
    markUrlDone: vi.fn(),
    markUrlFailed: vi.fn(),
}));

vi.mock("@/lib/scraper/registerScrapedDocument", () => ({
    registerScrapedDocument: vi.fn(),
}));

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
import { runCrawlJob } from "@/lib/scraper/crawlJobWorker";

/** Build a `Response` whose body is an NDJSON-encoded stream of the given events. */
function makeNdjsonResponse(events: Array<Record<string, unknown>>, ok = true): Response {
    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
        start(controller) {
            for (const e of events) {
                controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
            }
            controller.close();
        },
    });
    return new Response(body, {
        status: ok ? 200 : 500,
        headers: { "Content-Type": "application/x-ndjson" },
    });
}

const BASE_INPUT = {
    jobId: "job-1",
    userId: "user-1",
    startUrl: "https://example.com",
    mode: "auto",
    maxPages: 5,
    maxDepth: 1,
};

beforeEach(() => {
    vi.clearAllMocks();
});

describe("runCrawlJob — happy path", () => {
    it("marks job running, processes events, ingests pages, and marks complete", async () => {
        const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
            makeNdjsonResponse([
                { type: "start", start_url: "https://example.com", max_pages: 5, max_depth: 1 },
                { type: "visiting", url: "https://example.com", depth: 0, index: 1, max_pages: 5 },
                {
                    type: "page",
                    url: "https://example.com",
                    depth: 0,
                    index: 1,
                    data: {
                        url: "https://example.com",
                        title: "Home",
                        text_content: "hello world",
                    },
                },
                { type: "visiting", url: "https://example.com/about", depth: 1, index: 2, max_pages: 5 },
                {
                    type: "page",
                    url: "https://example.com/about",
                    depth: 1,
                    index: 2,
                    data: {
                        url: "https://example.com/about",
                        title: "About",
                        text_content: "about page",
                    },
                },
                { type: "done", total_pages: 2, failed_count: 0 },
            ]),
        );

        vi.mocked(registerScrapedDocument).mockImplementation(
            async (_userId, page) => ({
                ingested: 3,
                displaySource: `${page.title} — ${page.url}`,
                ragSourceKey: page.url,
            }),
        );

        await runCrawlJob(BASE_INPUT);

        expect(fetchSpy).toHaveBeenCalledWith(
            expect.stringMatching(/\/api\/v1\/crawl\/stream$/),
            expect.objectContaining({ method: "POST" }),
        );

        expect(markCrawlJobRunning).toHaveBeenCalledWith("job-1");
        expect(appendVisitingUrl).toHaveBeenCalledTimes(2);
        expect(appendVisitingUrl).toHaveBeenNthCalledWith(1, "job-1", "https://example.com", 0);
        expect(appendVisitingUrl).toHaveBeenNthCalledWith(2, "job-1", "https://example.com/about", 1);

        expect(registerScrapedDocument).toHaveBeenCalledTimes(2);
        expect(registerScrapedDocument).toHaveBeenNthCalledWith(1, "user-1", {
            url: "https://example.com",
            title: "Home",
            textContent: "hello world",
        });

        expect(markUrlDone).toHaveBeenCalledTimes(2);
        expect(markUrlDone).toHaveBeenNthCalledWith(1, "job-1", "https://example.com", 0, 3);

        expect(appendIngestedPage).toHaveBeenCalledTimes(2);
        expect(appendIngestedPage).toHaveBeenNthCalledWith(1, "job-1", {
            url: "https://example.com",
            displaySource: "Home — https://example.com",
            ragSourceKey: "https://example.com",
            ingested: 3,
        });

        expect(markUrlFailed).not.toHaveBeenCalled();
        expect(markCrawlJobFailed).not.toHaveBeenCalled();
        expect(markCrawlJobCompleted).toHaveBeenCalledWith("job-1");
    });
});

describe("runCrawlJob — failed page events", () => {
    it("records failed URLs but still completes successfully when stream ends cleanly", async () => {
        vi.spyOn(globalThis, "fetch").mockResolvedValue(
            makeNdjsonResponse([
                { type: "visiting", url: "https://example.com/broken", depth: 0, index: 1, max_pages: 5 },
                { type: "failed", url: "https://example.com/broken", error: "HTTP 500" },
                { type: "done", total_pages: 0, failed_count: 1 },
            ]),
        );

        await runCrawlJob(BASE_INPUT);

        expect(markUrlFailed).toHaveBeenCalledWith("job-1", "https://example.com/broken", "HTTP 500");
        expect(markCrawlJobFailed).not.toHaveBeenCalled();
        expect(markCrawlJobCompleted).toHaveBeenCalledWith("job-1");
    });

    it("marks job failed when the stream emits a top-level error event", async () => {
        vi.spyOn(globalThis, "fetch").mockResolvedValue(
            makeNdjsonResponse([
                { type: "start", start_url: "https://x", max_pages: 1, max_depth: 1 },
                { type: "error", error: "scraper blew up" },
            ]),
        );

        await runCrawlJob(BASE_INPUT);

        expect(markCrawlJobFailed).toHaveBeenCalledWith("job-1", "scraper blew up");
        expect(markCrawlJobCompleted).not.toHaveBeenCalled();
    });
});

describe("runCrawlJob — upstream failures", () => {
    it("marks the job failed when scraper service is unreachable", async () => {
        vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("ECONNREFUSED"));

        await runCrawlJob(BASE_INPUT);

        expect(markCrawlJobRunning).toHaveBeenCalledWith("job-1");
        expect(markCrawlJobFailed).toHaveBeenCalledWith(
            "job-1",
            expect.stringContaining("Scraper service unreachable"),
        );
        expect(markCrawlJobCompleted).not.toHaveBeenCalled();
    });

    it("marks the job failed when scraper service returns non-2xx", async () => {
        vi.spyOn(globalThis, "fetch").mockResolvedValue(
            new Response("upstream boom", { status: 500 }),
        );

        await runCrawlJob(BASE_INPUT);

        expect(markCrawlJobFailed).toHaveBeenCalledWith(
            "job-1",
            expect.stringContaining("Scraper upstream 500"),
        );
        expect(markCrawlJobCompleted).not.toHaveBeenCalled();
    });
});

describe("runCrawlJob — ingestion edge cases", () => {
    it("marks url done with undefined chunks when ingestion fails, and does not append ingested page", async () => {
        vi.spyOn(globalThis, "fetch").mockResolvedValue(
            makeNdjsonResponse([
                { type: "visiting", url: "https://example.com", depth: 0, index: 1, max_pages: 5 },
                {
                    type: "page",
                    url: "https://example.com",
                    depth: 0,
                    index: 1,
                    data: { url: "https://example.com", title: "Home", text_content: "content" },
                },
                { type: "done", total_pages: 1, failed_count: 0 },
            ]),
        );
        vi.mocked(registerScrapedDocument).mockResolvedValue(null);

        await runCrawlJob(BASE_INPUT);

        expect(markUrlDone).toHaveBeenCalledWith("job-1", "https://example.com", 0, undefined);
        expect(appendIngestedPage).not.toHaveBeenCalled();
        expect(markCrawlJobCompleted).toHaveBeenCalledWith("job-1");
    });

    it("still marks url done when ingestion throws", async () => {
        vi.spyOn(globalThis, "fetch").mockResolvedValue(
            makeNdjsonResponse([
                { type: "visiting", url: "https://example.com", depth: 0, index: 1, max_pages: 5 },
                {
                    type: "page",
                    url: "https://example.com",
                    depth: 0,
                    index: 1,
                    data: { url: "https://example.com", title: "Home", text_content: "content" },
                },
                { type: "done", total_pages: 1, failed_count: 0 },
            ]),
        );
        vi.mocked(registerScrapedDocument).mockRejectedValue(new Error("chroma down"));

        await runCrawlJob(BASE_INPUT);

        expect(markUrlDone).toHaveBeenCalledWith("job-1", "https://example.com", 0, undefined);
        expect(appendIngestedPage).not.toHaveBeenCalled();
        expect(markCrawlJobCompleted).toHaveBeenCalledWith("job-1");
    });

    it("gracefully ignores malformed JSON lines in the stream", async () => {
        const encoder = new TextEncoder();
        const body = new ReadableStream<Uint8Array>({
            start(controller) {
                controller.enqueue(encoder.encode("not-json\n"));
                controller.enqueue(
                    encoder.encode(
                        JSON.stringify({
                            type: "visiting",
                            url: "https://example.com",
                            depth: 0,
                            index: 1,
                            max_pages: 5,
                        }) + "\n",
                    ),
                );
                controller.enqueue(encoder.encode("{garbage\n"));
                controller.enqueue(
                    encoder.encode(JSON.stringify({ type: "done", total_pages: 0, failed_count: 0 }) + "\n"),
                );
                controller.close();
            },
        });
        vi.spyOn(globalThis, "fetch").mockResolvedValue(
            new Response(body, { status: 200 }),
        );

        await runCrawlJob(BASE_INPUT);

        expect(appendVisitingUrl).toHaveBeenCalledTimes(1);
        expect(markCrawlJobCompleted).toHaveBeenCalledWith("job-1");
    });
});
