/**
 * Base URL for the Python chatbot-api (server-side route handlers only).
 *
 * Node's fetch often resolves `localhost` to IPv6 (::1) first. Uvicorn defaults to
 * 127.0.0.1 only, which causes `TypeError: fetch failed` on Windows. We force IPv4
 * for the hostname `localhost` only (custom hosts like Docker are unchanged).
 */
export function getChatbotApiBaseUrl(): string {
  const raw =
    process.env.CHATBOT_API_URL?.trim() ||
    process.env.NEXT_PUBLIC_CHATBOT_API_BASE_URL?.trim() ||
    "http://127.0.0.1:8001";
  try {
    const u = new URL(raw);
    if (u.hostname === "localhost") {
      u.hostname = "127.0.0.1";
    }
    return u.origin;
  } catch {
    return raw;
  }
}
