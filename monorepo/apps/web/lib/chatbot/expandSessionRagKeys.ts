import {
    effectiveQuerySourceIds,
    findChatbotDocumentsByRagKeys,
    type ChatbotDocumentRecord,
} from "@/lib/db/chatbotDocumentRepo";

/**
 * Pure expansion logic (dependency-free so it's trivially unit-testable).
 * Given a session's stored `selectedRagKeys` and the library rows keyed by those keys,
 * returns the deduped list of Chroma `source_ids` to send to `/v1/query`.
 *
 * - For `kind: "site"` library rows, the key is replaced by every `pages[].key`.
 * - For `kind: "upload"` rows (or any row not found in the library), the key is passed through
 *   unchanged so legacy sessions and PDF uploads keep working.
 */
export function expandRagKeysWithLibrary(
    storedKeys: string[],
    libraryRows: Pick<ChatbotDocumentRecord, "ragSourceKey" | "kind" | "pages">[],
): string[] {
    const byKey = new Map<string, Pick<ChatbotDocumentRecord, "ragSourceKey" | "kind" | "pages">>();
    for (const row of libraryRows) {
        byKey.set(row.ragSourceKey, row);
    }
    const out: string[] = [];
    const seen = new Set<string>();
    for (const stored of storedKeys) {
        const row = byKey.get(stored);
        const expanded = row
            ? effectiveQuerySourceIds({
                  ragSourceKey: row.ragSourceKey,
                  kind: row.kind,
                  pages: row.pages,
              } as ChatbotDocumentRecord)
            : [stored];
        for (const k of expanded) {
            if (!seen.has(k)) {
                seen.add(k);
                out.push(k);
            }
        }
    }
    return out;
}

/**
 * DB-backed expansion used by the chat query route. Looks up each stored rag key in the user's
 * library, then expands site aggregators to their current `pages[].key` list.
 */
export async function expandSessionRagKeys(
    userId: string,
    storedKeys: string[],
): Promise<string[]> {
    const trimmed = storedKeys.map((k) => k.trim()).filter((k) => k.length > 0);
    if (trimmed.length === 0) return [];
    const rows = await findChatbotDocumentsByRagKeys(userId, trimmed);
    return expandRagKeysWithLibrary(trimmed, rows);
}
