import { getChatbotApiBaseUrl } from "@/lib/chatbot/getChatbotApiBaseUrl";

export type IngestTextResult = {
    ingested: number;
    sourceId: string;
};

/**
 * Call chatbot-api `POST /v1/ingest-text` for a single scraped page.
 * Returns the number of chunks written to Chroma (or `null` when the service is unreachable / errored).
 */
export async function sendScrapedTextToChatbot(
    userId: string,
    opts: {
        textContent: string;
        sourceId: string;
        title?: string;
        url?: string;
    },
): Promise<IngestTextResult | null> {
    if (!opts.textContent.trim()) return null;
    try {
        const res = await fetch(`${getChatbotApiBaseUrl()}/v1/ingest-text`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-user-id": userId,
            },
            body: JSON.stringify({
                text_content: opts.textContent,
                source_id: opts.sourceId,
                title: opts.title ?? opts.sourceId,
                url: opts.url ?? "",
            }),
        });
        if (!res.ok) {
            const detail = await res.text().catch(() => "");
            console.error(
                `[scraper→chatbot] ingest-text failed ${res.status}: ${detail.slice(0, 500)}`,
            );
            return null;
        }
        const body = (await res.json()) as { ingested?: number; source_id?: string };
        return {
            ingested: typeof body.ingested === "number" ? body.ingested : 0,
            sourceId: (body.source_id ?? opts.sourceId).trim(),
        };
    } catch (err) {
        console.error("[scraper→chatbot] ingest-text threw:", err);
        return null;
    }
}
