import { NextResponse } from "next/server";
import { getCurrentUserFromToken } from "@/lib/auth/authService";
import { getSessionCookie } from "@repo/auth/lib/cookies";
import { proxyChatbotResponse } from "@/lib/chatbot/proxyUpstream";
import { deleteChatbotDocument } from "@/lib/db/chatbotDocumentRepo";

const CHATBOT_API_BASE =
    process.env.CHATBOT_API_URL ??
    process.env.NEXT_PUBLIC_CHATBOT_API_BASE_URL ??
    "http://127.0.0.1:8001";

async function getAuthedUserId(): Promise<string | null> {
    const token = await getSessionCookie();
    if (!token) return null;
    const user = await getCurrentUserFromToken(token);
    return user?.id ?? null;
}

/** Delete vectors in the chatbot service, then remove the Mongo document record. */
export async function DELETE(
    _request: Request,
    { params }: { params: Promise<{ sourceId: string }> },
) {
    const userId = await getAuthedUserId();
    if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { sourceId: raw } = await params;
    const sourceId = decodeURIComponent(raw);

    try {
        const res = await fetch(
            `${CHATBOT_API_BASE}/v1/sources/${encodeURIComponent(sourceId)}`,
            {
                method: "DELETE",
                headers: { "x-user-id": userId },
            },
        );
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
        await deleteChatbotDocument(userId, sourceId);
    } catch (e) {
        return NextResponse.json(
            { error: "Vectors removed but failed to remove document record", detail: String(e) },
            { status: 500 },
        );
    }
    return NextResponse.json({ ok: true });
}
