/**
 * RAG ingest, sources, and vector deletes follow the same backend toggle as chat
 * (`USE_CHATBOT_API`). Both Python services default to `monorepo/chroma_data`.
 */
import {
    getChatbotApiBaseUrl,
    getModelGatewayApiBaseUrl,
    isChatbotApiEnabled,
} from "@/lib/chatbot/getChatbotServiceBaseUrl";

export function isRagOnChatbotApi(): boolean {
    return isChatbotApiEnabled();
}

/** Base URL for ingest, list/delete sources, and scrape→vector writes. */
export function getRagServiceBaseUrl(): string {
    return isRagOnChatbotApi() ? getChatbotApiBaseUrl() : getModelGatewayApiBaseUrl();
}

export function ragListSourcesUrl(baseUrl: string): string {
    return isRagOnChatbotApi() ? `${baseUrl}/v1/sources` : `${baseUrl}/api/rag/sources`;
}

export function ragDeleteSourceUrl(baseUrl: string, sourceId: string): string {
    const encoded = encodeURIComponent(sourceId);
    return isRagOnChatbotApi()
        ? `${baseUrl}/v1/sources/${encoded}`
        : `${baseUrl}/api/rag/sources/${encoded}`;
}

export function ragIngestPdfUrl(baseUrl: string): string {
    return isRagOnChatbotApi() ? `${baseUrl}/v1/ingest` : `${baseUrl}/api/rag/ingest`;
}

export function ragIngestTextUrl(baseUrl: string): string {
    return isRagOnChatbotApi() ? `${baseUrl}/v1/ingest-text` : `${baseUrl}/api/rag/ingest-text`;
}

/** Headers for chatbot-api (`x-user-id`). Model-gateway uses query/form `user_id` instead. */
export function ragUserHeaders(userId: string): Record<string, string> {
    return isRagOnChatbotApi() ? { "x-user-id": userId } : {};
}

export function ragListSourcesRequestUrl(baseUrl: string, userId: string): string {
    if (isRagOnChatbotApi()) {
        return ragListSourcesUrl(baseUrl);
    }
    return `${ragListSourcesUrl(baseUrl)}?user_id=${encodeURIComponent(userId)}`;
}

export function ragDeleteSourceRequestUrl(baseUrl: string, userId: string, sourceId: string): string {
    if (isRagOnChatbotApi()) {
        return ragDeleteSourceUrl(baseUrl, sourceId);
    }
    return `${ragDeleteSourceUrl(baseUrl, sourceId)}?user_id=${encodeURIComponent(userId)}`;
}
