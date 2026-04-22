import { NextResponse } from "next/server";
import { requireUserIdWithPermission } from "@/lib/auth/requireApiPermission";
import { internalServerError, notFoundError, upstreamError, validationError } from "@/lib/api/routeValidation";
import { getChatbotApiBaseUrl } from "@/lib/chatbot/getChatbotApiBaseUrl";
import { requireRateLimitByUser } from "@/lib/rateLimit/requireRateLimit";
import { deleteChatbotDocumentById, getChatbotDocument } from "@/lib/db/chatbotDocumentRepo";

type VectorDeletionFailure = { key: string; status: number; detail: string };

async function deleteChromaSource(
    baseUrl: string,
    userId: string,
    key: string,
): Promise<VectorDeletionFailure | null> {
    const res = await fetch(`${baseUrl}/v1/sources/${encodeURIComponent(key)}`, {
        method: "DELETE",
        headers: { "x-user-id": userId },
    });
    if (res.ok) return null;
    const detail = await res.text().catch(() => "");
    return { key, status: res.status, detail: detail.slice(0, 500) };
}

/** Delete vectors in the chatbot service, then remove the Mongo document record. */
export async function DELETE(
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

    // For a site aggregator row, purge every per-page Chroma source; for a regular upload,
    // just purge the single key. If ANY page delete fails with a non-404 error we abort so
    // the Mongo row (and the user's reference to the vectors) stays consistent.
    const keysToDelete: string[] =
        existing.kind === "site" && existing.pages.length > 0
            ? [...new Set(existing.pages.map((p) => p.key).filter((k) => k.length > 0))]
            : [existing.ragSourceKey];

    const baseUrl = getChatbotApiBaseUrl();
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
        return upstreamError(error, "Cannot reach chatbot service");
    }

    if (failures.length > 0) {
        return upstreamError(
            failures.map((f) => `${f.key}:${f.status}`).join(", "),
            `Failed to remove vectors for one or more pages (${failures.length})`,
        );
    }

    try {
        await deleteChatbotDocumentById(userId, documentId);
    } catch (error) {
        return internalServerError(error, "Vectors removed but failed to remove document record");
    }
    return NextResponse.json({ ok: true, deletedPages: keysToDelete.length });
}
