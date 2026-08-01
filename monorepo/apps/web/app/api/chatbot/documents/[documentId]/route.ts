import { NextResponse } from "next/server";
import { requireUserIdWithPermission } from "@/lib/auth/requireApiPermission";
import { internalServerError, notFoundError, upstreamError, validationError } from "@/lib/api/routeValidation";
import { withApiLogging } from "@/lib/api/withApiLogging";
import {
    getRagServiceBaseUrl,
    ragDeleteSourceRequestUrl,
    ragListSourcesRequestUrl,
    ragUserHeaders,
} from "@/lib/chatbot/ragService";
import { requireRateLimitByUser } from "@/lib/rateLimit/requireRateLimit";
import {
    deleteChatbotDocumentById,
    deleteChatbotDocumentsByRagSourceKeys,
    getChatbotDocument,
} from "@/lib/db/chatbotDocumentRepo";

type VectorDeletionFailure = { key: string; status: number; detail: string };

function isHttpVectorSourceId(source: string): boolean {
    return /^https?:\/\//i.test(source.trim());
}

function httpSourcesSameOrigin(a: string, b: string): boolean {
    try {
        return new URL(a.trim()).origin === new URL(b.trim()).origin;
    } catch {
        return false;
    }
}

/** If `pages[]` is stale/empty, discover every same-origin URL source still in Chroma for this user. */
async function augmentSiteKeysFromChroma(
    baseUrl: string,
    userId: string,
    siteOriginKey: string,
    keys: Set<string>,
): Promise<void> {
    const origin = siteOriginKey.trim();
    if (!origin || !isHttpVectorSourceId(origin)) return;
    try {
        const res = await fetch(ragListSourcesRequestUrl(baseUrl, userId), {
            method: "GET",
            headers: ragUserHeaders(userId),
        });
        const text = await res.text();
        if (!res.ok || !text.trim()) return;
        const data = JSON.parse(text) as { sources?: { source: string }[] };
        for (const row of data.sources ?? []) {
            const sid = typeof row.source === "string" ? row.source.trim() : "";
            if (!sid || !isHttpVectorSourceId(sid)) continue;
            if (httpSourcesSameOrigin(sid, origin)) keys.add(sid);
        }
    } catch {
        // ignore — fall back to Mongo-derived keys only
    }
}

async function deleteChromaSource(
    baseUrl: string,
    userId: string,
    key: string,
): Promise<VectorDeletionFailure | null> {
    const res = await fetch(ragDeleteSourceRequestUrl(baseUrl, userId, key), {
        method: "DELETE",
        headers: ragUserHeaders(userId),
    });
    if (res.ok) return null;
    const detail = await res.text().catch(() => "");
    return { key, status: res.status, detail: detail.slice(0, 500) };
}

/** Delete vectors in the chatbot service, then remove the Mongo document record. */
async function deleteDocumentById(
    _request: Request,
    { params }: { params: Promise<{ documentId: string }> },
) {
    const auth = await requireUserIdWithPermission("chatbot_documents:delete");
    if (auth instanceof NextResponse) return auth;
    const { userId } = auth;
    const limited = await requireRateLimitByUser(userId, "chatbot:documents:delete", {
        limit: 20,
        windowSec: 60,
    });
    if (limited) return limited;

    const { documentId } = await params;
    if (!documentId) {
        return validationError("Missing document id");
    }

    const existing = await getChatbotDocument(userId, documentId);
    if (!existing) {
        return notFoundError("Document not found");
    }

    // Chroma `source` ids: per-page URLs for `kind: "site"`, plus the site-level origin key
    // (vectors are never stored under that origin today, but DELETE tolerates 404).
    // Legacy crawls sometimes created one Mongo row per page with `ragSourceKey` = page URL;
    // we remove those rows after vectors via `deleteChatbotDocumentsByRagSourceKeys` below.
    let keysToDelete: string[] =
        existing.kind === "site"
            ? [
                  ...new Set(
                      [
                          ...existing.pages.map((p) => p.key.trim()).filter((k) => k.length > 0),
                          existing.ragSourceKey.trim(),
                      ].filter((k) => k.length > 0),
                  ),
              ]
            : [existing.ragSourceKey.trim()].filter((k) => k.length > 0);

    const baseUrl = getRagServiceBaseUrl();
    if (existing.kind === "site") {
        const merged = new Set(keysToDelete.filter((k) => k.length > 0));
        await augmentSiteKeysFromChroma(baseUrl, userId, existing.ragSourceKey, merged);
        keysToDelete = [...merged];
    }

    if (keysToDelete.length === 0) {
        return validationError("Document has no vector source keys to delete");
    }
    const failures: VectorDeletionFailure[] = [];
    try {
        for (const key of keysToDelete) {
            const failure = await deleteChromaSource(baseUrl, userId, key);
            // A 404 from the vector store just means "already gone" — treat as success so
            // retrying a partial delete can drive the Mongo row to deletion.
            if (failure && failure.status !== 404) {
                failures.push(failure);
            }
        }
    } catch (error) {
        return upstreamError(error, "Cannot reach RAG service");
    }

    if (failures.length > 0) {
        return upstreamError(
            failures.map((f) => `${f.key}:${f.status}`).join(", "),
            `Failed to remove vectors for one or more pages (${failures.length})`,
        );
    }

    try {
        await deleteChatbotDocumentsByRagSourceKeys(userId, keysToDelete);
        await deleteChatbotDocumentById(userId, documentId);
    } catch (error) {
        return internalServerError(error, "Vectors removed but failed to remove document record");
    }
    return NextResponse.json({ ok: true, deletedPages: keysToDelete.length });
}

export const DELETE = withApiLogging(deleteDocumentById);
