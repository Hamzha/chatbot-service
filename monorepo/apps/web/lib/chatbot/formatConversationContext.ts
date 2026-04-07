/** Max chars sent to the chatbot API as prior conversation (rough token budget). */
export const MAX_CONVERSATION_CONTEXT_CHARS = 16_000;

export function formatConversationContext(
    messages: { role: string; content: string }[],
): string {
    if (messages.length === 0) return "";
    const lines = messages.map((m) => {
        const label = m.role === "user" ? "User" : "Assistant";
        return `${label}: ${m.content.trim()}`;
    });
    let text = lines.join("\n\n");
    if (text.length > MAX_CONVERSATION_CONTEXT_CHARS) {
        text = text.slice(text.length - MAX_CONVERSATION_CONTEXT_CHARS);
    }
    return text;
}
