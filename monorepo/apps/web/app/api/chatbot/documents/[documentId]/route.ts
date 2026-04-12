import { NextResponse } from "next/server";
import { getCurrentUserFromToken } from "@/lib/auth/authService";
import { getSessionCookie } from "@repo/auth/lib/cookies";
import { getChatbotApiBaseUrl } from "@/lib/chatbot/getChatbotApiBaseUrl";
import { proxyChatbotResponse } from "@/lib/chatbot/proxyUpstream";
import { deleteChatbotDocumentById, getChatbotDocument } from "@/lib/db/chatbotDocumentRepo";

async function getAuthedUserId(): Promise<string | null> {
    const token = await getSessionCookie();
    if (!token) return null;
    const user = await getCurrentUserFromToken(token);
    return user?.id ?? null;
}

/** Delete vectors in the chatbot service, then remove the Mongo document record. */
export async function DELETE(
    _request: Request,
    { params }: { params: Promise<{ documentId: string }> },
) {
    const userId = await getAuthedUserId();
    if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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
