import { NextResponse } from "next/server";
import { requireUserIdWithPermission } from "@/lib/auth/requireApiPermission";
import { getChatbotApiBaseUrl } from "@/lib/chatbot/getChatbotApiBaseUrl";
import { proxyChatbotResponse } from "@/lib/chatbot/proxyUpstream";
import { deleteChatbotDocumentById, getChatbotDocument } from "@/lib/db/chatbotDocumentRepo";

/** Delete vectors in the chatbot service, then remove the Mongo document record. */
export async function DELETE(
    _request: Request,
    { params }: { params: Promise<{ documentId: string }> },
) {
    const auth = await requireUserIdWithPermission("chatbot_documents:delete");
    if (auth instanceof NextResponse) return auth;
    const { userId } = auth;

    const { documentId } = await params;
    if (!documentId) {
        return NextResponse.json({ error: "Missing document id" }, { status: 400 });
    }

    const existing = await getChatbotDocument(userId, documentId);
    if (!existing) {
        return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    const ragKey = existing.ragSourceKey;

    try {
        const res = await fetch(`${getChatbotApiBaseUrl()}/v1/sources/${encodeURIComponent(ragKey)}`, {
            method: "DELETE",
            headers: { "x-user-id": userId },
        });
        const text = await res.text();
        if (!res.ok) {
            return proxyChatbotResponse(res, text);
        }
    } catch (e) {
        return NextResponse.json(
            { error: "Cannot reach chatbot service", detail: String(e) },
            { status: 502 },
        );
    }

    try {
        await deleteChatbotDocumentById(userId, documentId);
    } catch (e) {
        return NextResponse.json(
            { error: "Vectors removed but failed to remove document record", detail: String(e) },
            { status: 500 },
        );
    }
    return NextResponse.json({ ok: true });
}
