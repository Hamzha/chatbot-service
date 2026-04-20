import { NextResponse } from "next/server";
import { requireUserIdWithPermission } from "@/lib/auth/requireApiPermission";
import { getChatbotApiBaseUrl } from "@/lib/chatbot/getChatbotApiBaseUrl";
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

export async function GET() {
    const auth = await requireUserIdWithPermission("chatbot_documents:read");
    if (auth instanceof NextResponse) return auth;
    const { userId } = auth;

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
}

/** Finalize chunk counts after ingestion: `{ documentId, chunks }`. */
export async function POST(request: Request) {
    const auth = await requireUserIdWithPermission("chatbot_documents:update");
    if (auth instanceof NextResponse) return auth;
    const { userId } = auth;

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const b = body as { documentId?: unknown; chunks?: unknown };
    if (typeof b.documentId !== "string" || !b.documentId.trim()) {
        return NextResponse.json({ error: "Missing or invalid documentId" }, { status: 400 });
    }
    const chunks = typeof b.chunks === "number" && Number.isFinite(b.chunks) ? Math.floor(b.chunks) : NaN;
    if (chunks < 0 || Number.isNaN(chunks)) {
        return NextResponse.json({ error: "Missing or invalid chunks" }, { status: 400 });
    }

    try {
        const record = await finalizeChatbotDocument(userId, b.documentId.trim(), chunks);
        if (!record) {
            return NextResponse.json({ error: "Document not found" }, { status: 404 });
        }
        return NextResponse.json({
            id: record.id,
            source: record.source,
            ragSourceKey: record.ragSourceKey,
            chunks: record.chunks,
        });
    } catch (e) {
        return NextResponse.json({ error: "Failed to save document record", detail: String(e) }, { status: 500 });
    }
}
