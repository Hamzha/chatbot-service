import { upsertChatbotSiteDocument } from "@/lib/db/chatbotDocumentRepo";
import { sendScrapedTextToChatbot } from "@/lib/scraper/sendScrapedTextToChatbot";

/**
 * Derive the site-level aggregator key from a page URL.
 * Returns `<protocol>//<host>` (e.g. `https://www.gentivahs.com`). Falls back to the
 * raw URL if parsing fails so we never silently drop ingestion.
 */
function deriveSiteKey(url: string): { siteKey: string; host: string } {
    try {
        const u = new URL(url);
        return { siteKey: `${u.protocol}//${u.host}`, host: u.host };
    } catch {
        return { siteKey: url, host: url };
    }
}

/**
 * Ingest a scraped/crawled page into Chroma via chatbot-api (keyed by page URL, unchanged),
 * then upsert a site-level Mongo `ChatbotDocument` row so ALL pages from the same website
 * collapse into a single library entry.
 *
 * The per-page Chroma source id is pushed into the site row's `pages[]` array, and chat sessions
 * that reference the site key get every page expanded at query time (see `expandSessionRagKeys`).
 *
 * Returned `ragSourceKey` is the PAGE-level key (used by crawl-job progress UI), but the library
 * row's own `ragSourceKey` is the site-level key (origin).
 */
export async function registerScrapedDocument(
    userId: string,
    page: { url: string; title?: string; textContent: string },
): Promise<{ ingested: number; displaySource: string; ragSourceKey: string } | null> {
    const url = page.url.trim();
    if (!url || !page.textContent.trim()) return null;

    const result = await sendScrapedTextToChatbot(userId, {
        textContent: page.textContent,
        sourceId: url,
        title: page.title,
        url,
    });
    if (!result) return null;

    const { siteKey, host } = deriveSiteKey(url);
    try {
        const record = await upsertChatbotSiteDocument({
            userId,
            siteKey,
            displaySource: host,
            pageKey: url,
            pageChunks: result.ingested,
        });
        return {
            ingested: result.ingested,
            displaySource: record.source,
            ragSourceKey: url,
        };
    } catch (err) {
        console.error("[scraper] failed to upsert site ChatbotDocument row:", err);
        return { ingested: result.ingested, displaySource: host, ragSourceKey: url };
    }
}
