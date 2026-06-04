import {
    getRagServiceBaseUrl,
    isRagOnChatbotApi,
    ragIngestTextUrl,
    ragUserHeaders,
} from "@/lib/chatbot/ragService";

export type IngestTextResult = {
    ingested: number;
    sourceId: string;
};

/**
 * Ingest scraped page text into Chroma via the active RAG backend
 * (chatbot-api or model-gateway-api, per `USE_CHATBOT_API`).
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
    const baseUrl = getRagServiceBaseUrl();
    const url = ragIngestTextUrl(baseUrl);

    const body = isRagOnChatbotApi()
        ? {
              text_content: opts.textContent,
              source_id: opts.sourceId,
              title: opts.title ?? opts.sourceId,
              url: opts.url ?? "",
          }
        : {
              user_id: userId,
              text_content: opts.textContent,
              source_id: opts.sourceId,
          };

    try {
        const res = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...ragUserHeaders(userId),
            },
            body: JSON.stringify(body),
        });
        if (!res.ok) {
            const detail = await res.text().catch(() => "");
            console.error(`[scraper→rag] ingest-text failed ${res.status}: ${detail.slice(0, 500)}`);
            return null;
        }
        const parsed = (await res.json()) as { ingested?: number; source_id?: string; source?: string };
        const sourceKey = (parsed.source_id ?? parsed.source ?? opts.sourceId).trim();
        return {
            ingested: typeof parsed.ingested === "number" ? parsed.ingested : 0,
            sourceId: sourceKey,
        };
    } catch (err) {
        console.error("[scraper→rag] ingest-text threw:", err);
        return null;
    }
}
