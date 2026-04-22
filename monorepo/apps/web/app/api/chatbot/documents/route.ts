import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserIdWithPermission } from "@/lib/auth/requireApiPermission";
import { internalServerError, notFoundError, parseJsonBody, validationError } from "@/lib/api/routeValidation";
import { withApiLogging } from "@/lib/api/withApiLogging";
import { getChatbotApiBaseUrl } from "@/lib/chatbot/getChatbotApiBaseUrl";
import { requireRateLimitByUser } from "@/lib/rateLimit/requireRateLimit";
import {
    finalizeChatbotDocument,
    listChatbotDocuments,
    upsertChatbotDocument,
} from "@/lib/db/chatbotDocumentRepo";

/** When Mongo has no rows yet, copy sources from the chatbot (Chroma) into Mongo once. */
async function backfillFromChatbotIfEmpty(userId: string): Promise<void> {
    try {
        const res = await fetch(`${getChatbotApiBaseUrl()}/v1/sources`, {
            method: "GET",
            headers: { "x-user-id": userId },
        });
        const text = await res.text();
        if (!res.ok || !text.trim()) return;
        const data = JSON.parse(text) as { sources?: { source: string; chunks: number }[] };
        const sources = data.sources ?? [];
        for (const row of sources) {
            await upsertChatbotDocument(userId, row.source, row.chunks);
        }
    } catch {
        // Chatbot down or invalid JSON — leave Mongo as-is
    }
}

const finalizeDocumentSchema = z.object({
    documentId: z.string().trim().min(1, "Missing or invalid documentId"),
    chunks: z.number().finite().int().min(0, "Missing or invalid chunks"),
});

async function getDocuments() {
    const auth = await requireUserIdWithPermission("chatbot_documents:read");
    if (auth instanceof NextResponse) return auth;
    const { userId } = auth;
  const limited = await requireRateLimitByUser(userId, "chatbot:documents:read", {
      limit: 60,
      windowSec: 60,
  });
  if (limited) return limited;

  try {
      let records = await listChatbotDocuments(userId);
      if (records.length === 0) {
          await backfillFromChatbotIfEmpty(userId);
          records = await listChatbotDocuments(userId);
      }

      return NextResponse.json({
          sources: records.map((r) => ({
              id: r.id,
              source: r.source,
              ragSourceKey: r.ragSourceKey,
              chunks: r.chunks,
              kind: r.kind,
              pageCount: r.kind === "site" ? r.pages.length : 0,
          })),
      });
  } catch (error) {
      return internalServerError(error, "Failed to list documents");
  }
}

/** Finalize chunk counts after ingestion: `{ documentId, chunks }`. */
async function postDocuments(request: Request) {
    const auth = await requireUserIdWithPermission("chatbot_documents:update");
    if (auth instanceof NextResponse) return auth;
    const { userId } = auth;
    const limited = await requireRateLimitByUser(userId, "chatbot:documents:update", {
        limit: 30,
        windowSec: 60,
    });
    if (limited) return limited;
    const parsed = await parseJsonBody(request, finalizeDocumentSchema);
    if (!parsed.ok) return parsed.response;
    const { documentId, chunks } = parsed.data;

    try {
        const record = await finalizeChatbotDocument(userId, documentId, chunks);
        if (!record) {
            return notFoundError("Document not found");
        }
        return NextResponse.json({
            id: record.id,
            source: record.source,
            ragSourceKey: record.ragSourceKey,
            chunks: record.chunks,
        });
    } catch (error) {
        return internalServerError(error, "Failed to save document record");
    }
}

export const GET = withApiLogging(getDocuments);
export const POST = withApiLogging(postDocuments);
