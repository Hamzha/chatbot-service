/**
 * Base URL selector for the public widget chat endpoint.
 *
 * When the feature flag is on, the widget talks to chatbot-api. Otherwise it
 * talks to model-gateway-api.
 */
function isTruthy(value: string | undefined): boolean {
    if (!value) return false;
    const normalized = value.trim().toLowerCase();
    return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

function normalizeBaseUrl(raw: string, fallback: string): string {
    const candidate = raw.trim() || fallback;
    try {
        const url = new URL(candidate);
        if (url.hostname === "localhost") {
            url.hostname = "127.0.0.1";
        }
        return url.origin;
    } catch {
        return candidate;
    }
}

export function getChatbotApiBaseUrl(): string {
    return normalizeBaseUrl(
        process.env.CHATBOT_API_URL?.trim() || process.env.NEXT_PUBLIC_CHATBOT_API_BASE_URL?.trim() || "",
        "http://127.0.0.1:8001",
    );
}

export function getModelGatewayApiBaseUrl(): string {
    return normalizeBaseUrl(
        process.env.MODEL_GATEWAY_API_URL?.trim() || process.env.NEXT_PUBLIC_MODEL_GATEWAY_API_BASE_URL?.trim() || "",
        "http://127.0.0.1:8003",
    );
}

export function getWidgetChatBackendBaseUrl(): string {
    const useChatbotApi = isTruthy(process.env.USE_CHATBOT_API) || isTruthy(process.env.NEXT_PUBLIC_USE_CHATBOT_API);
    return useChatbotApi ? getChatbotApiBaseUrl() : getModelGatewayApiBaseUrl();
}