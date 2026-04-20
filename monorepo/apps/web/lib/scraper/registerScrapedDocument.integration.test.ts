/**
 * Integration test for `registerScrapedDocument`: verifies the scrape ingest
 * path ends up writing a Mongo `ChatbotDocument` row so the scraped page shows
 * up in the dashboard document list (bug regression coverage for the scraper
 * → chatbot pipeline).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Types } from "mongoose";
import { setupMongoTestEnv } from "@/lib/testing/mongo";
import { listChatbotDocuments } from "@/lib/db/chatbotDocumentRepo";
import { registerScrapedDocument } from "@/lib/scraper/registerScrapedDocument";

setupMongoTestEnv();

function stubChatbotApi(
    status: number,
    body: unknown,
    overrides?: Partial<Response>,
) {
    const resp = new Response(
        typeof body === "string" ? body : JSON.stringify(body),
        {
            status,
            headers: { "content-type": "application/json" },
            ...overrides,
        },
    );
    return vi.spyOn(globalThis, "fetch").mockResolvedValue(resp);
}

beforeEach(() => {
    process.env.CHATBOT_API_URL = "http://chatbot.test:9999";
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe("registerScrapedDocument — site-grouping happy path", () => {
    it("ingests the page and upserts a site-level aggregator row keyed by origin", async () => {
        const userId = new Types.ObjectId().toString();
        stubChatbotApi(200, { ingested: 5, source_id: "https://x.com/about" });

        const result = await registerScrapedDocument(userId, {
            url: "https://x.com/about",
            title: "About Us",
            textContent: "Some page text.",
        });

        // Return value keeps the PAGE-level key for progress UI.
        expect(result).not.toBeNull();
        expect(result!.ingested).toBe(5);
        expect(result!.ragSourceKey).toBe("https://x.com/about");

        // Mongo row is a single site aggregator keyed on the ORIGIN.
        const docs = await listChatbotDocuments(userId);
        expect(docs).toHaveLength(1);
        expect(docs[0].chunks).toBe(5);
        expect(docs[0].ragSourceKey).toBe("https://x.com");
        expect(docs[0].source).toBe("x.com");
        expect(docs[0].kind).toBe("site");
        expect(docs[0].pages).toEqual([
            { key: "https://x.com/about", chunks: 5 },
        ]);
    });

    it("crawling multiple pages of the same site collapses into ONE aggregator row", async () => {
        const userId = new Types.ObjectId().toString();

        stubChatbotApi(200, { ingested: 3, source_id: "https://x.com/about" });
        await registerScrapedDocument(userId, {
            url: "https://x.com/about",
            title: "About",
            textContent: "about page",
        });

        vi.restoreAllMocks();
        stubChatbotApi(200, { ingested: 4, source_id: "https://x.com/team" });
        await registerScrapedDocument(userId, {
            url: "https://x.com/team",
            title: "Team",
            textContent: "team page",
        });

        vi.restoreAllMocks();
        stubChatbotApi(200, { ingested: 2, source_id: "https://x.com/contact" });
        await registerScrapedDocument(userId, {
            url: "https://x.com/contact",
            title: "Contact",
            textContent: "contact page",
        });

        const docs = await listChatbotDocuments(userId);
        expect(docs).toHaveLength(1);
        const row = docs[0];
        expect(row.kind).toBe("site");
        expect(row.ragSourceKey).toBe("https://x.com");
        expect(row.chunks).toBe(9); // 3 + 4 + 2
        expect(row.pages.map((p) => p.key).sort()).toEqual([
            "https://x.com/about",
            "https://x.com/contact",
            "https://x.com/team",
        ]);
    });

    it("re-ingesting the same URL replaces that page's chunk count (no duplicate, total stays accurate)", async () => {
        const userId = new Types.ObjectId().toString();

        stubChatbotApi(200, { ingested: 3, source_id: "https://x.com/page" });
        await registerScrapedDocument(userId, {
            url: "https://x.com/page",
            title: "Page",
            textContent: "first snapshot",
        });

        vi.restoreAllMocks();
        stubChatbotApi(200, { ingested: 8, source_id: "https://x.com/page" });
        await registerScrapedDocument(userId, {
            url: "https://x.com/page",
            title: "Page",
            textContent: "second snapshot",
        });

        const docs = await listChatbotDocuments(userId);
        expect(docs).toHaveLength(1);
        expect(docs[0].chunks).toBe(8);
        expect(docs[0].pages).toEqual([{ key: "https://x.com/page", chunks: 8 }]);
    });

    it("crawling two distinct origins produces two separate site rows", async () => {
        const userId = new Types.ObjectId().toString();

        stubChatbotApi(200, { ingested: 2, source_id: "https://a.com/x" });
        await registerScrapedDocument(userId, {
            url: "https://a.com/x",
            textContent: "a",
        });

        vi.restoreAllMocks();
        stubChatbotApi(200, { ingested: 5, source_id: "https://b.com/y" });
        await registerScrapedDocument(userId, {
            url: "https://b.com/y",
            textContent: "b",
        });

        const docs = await listChatbotDocuments(userId);
        expect(docs).toHaveLength(2);
        expect(docs.map((d) => d.ragSourceKey).sort()).toEqual([
            "https://a.com",
            "https://b.com",
        ]);
    });
});

describe("registerScrapedDocument — failure modes", () => {
    it("returns null and writes no Mongo row when textContent is empty", async () => {
        const userId = new Types.ObjectId().toString();
        const spy = stubChatbotApi(200, { ingested: 1 });

        const res = await registerScrapedDocument(userId, {
            url: "https://x.com/",
            textContent: "   ",
        });

        expect(res).toBeNull();
        expect(spy).not.toHaveBeenCalled();
        const docs = await listChatbotDocuments(userId);
        expect(docs).toHaveLength(0);
    });

    it("returns null and writes no Mongo row when chatbot-api errors", async () => {
        const userId = new Types.ObjectId().toString();
        stubChatbotApi(500, { detail: "boom" });

        const res = await registerScrapedDocument(userId, {
            url: "https://x.com/",
            textContent: "hello",
        });

        expect(res).toBeNull();
        const docs = await listChatbotDocuments(userId);
        expect(docs).toHaveLength(0);
    });

    it("returns null when the chatbot-api fetch throws", async () => {
        const userId = new Types.ObjectId().toString();
        vi.spyOn(globalThis, "fetch").mockRejectedValue(
            new Error("connection refused"),
        );

        const res = await registerScrapedDocument(userId, {
            url: "https://x.com/",
            textContent: "hello",
        });

        expect(res).toBeNull();
        const docs = await listChatbotDocuments(userId);
        expect(docs).toHaveLength(0);
    });
});

describe("registerScrapedDocument — display source", () => {
    it("uses the site host as the display name regardless of per-page title", async () => {
        const userId = new Types.ObjectId().toString();
        stubChatbotApi(200, { ingested: 1, source_id: "https://x.com/notitle" });

        await registerScrapedDocument(userId, {
            url: "https://x.com/notitle",
            textContent: "txt",
        });

        const docs = await listChatbotDocuments(userId);
        expect(docs[0].source).toBe("x.com");
        expect(docs[0].kind).toBe("site");
    });
});
