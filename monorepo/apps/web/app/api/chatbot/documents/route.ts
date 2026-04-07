import { NextResponse } from "next/server";
import { getCurrentUserFromToken } from "@/lib/auth/authService";
import { getSessionCookie } from "@repo/auth/lib/cookies";
import {
    listChatbotDocuments,
    upsertChatbotDocument,
} from "@/lib/db/chatbotDocumentRepo";

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

/** When Mongo has no rows yet, copy sources from the chatbot (Chroma) into Mongo once. */
async function backfillFromChatbotIfEmpty(userId: string): Promise<void> {
    try {
        const res = await fetch(`${CHATBOT_API_BASE}/v1/sources`, {
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
    const userId = await getAuthedUserId();
    if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let records = await listChatbotDocuments(userId);
    if (records.length === 0) {
        await backfillFromChatbotIfEmpty(userId);
        records = await listChatbotDocuments(userId);
    }

    return NextResponse.json({
        sources: records.map((r) => ({ source: r.source, chunks: r.chunks })),
    });
}

export async function POST(request: Request) {
    const userId = await getAuthedUserId();
    if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const src = body as { source?: unknown; chunks?: unknown };
    if (typeof src.source !== "string" || !src.source.trim()) {
        return NextResponse.json({ error: "Missing or invalid source" }, { status: 400 });
    }
    const chunks = typeof src.chunks === "number" && Number.isFinite(src.chunks) ? Math.floor(src.chunks) : NaN;
    if (chunks < 0 || Number.isNaN(chunks)) {
        return NextResponse.json({ error: "Missing or invalid chunks" }, { status: 400 });
    }

    try {
        const record = await upsertChatbotDocument(userId, src.source.trim(), chunks);
        return NextResponse.json({
            id: record.id,
            source: record.source,
            chunks: record.chunks,
        });
    } catch (e) {
        return NextResponse.json({ error: "Failed to save document record", detail: String(e) }, { status: 500 });
    }
}
