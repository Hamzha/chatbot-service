import { NextResponse } from "next/server";
import { getCurrentUserFromToken } from "@/lib/auth/authService";
import { getSessionCookie } from "@repo/auth/lib/cookies";
import {
    appendChatbotExchange,
    clearChatbotMessages,
    listChatbotMessages,
} from "@/lib/db/chatbotMessageRepo";

async function getAuthedUserId(): Promise<string | null> {
    const token = await getSessionCookie();
    if (!token) return null;
    const user = await getCurrentUserFromToken(token);
    return user?.id ?? null;
}

export async function GET() {
    const userId = await getAuthedUserId();
    if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    try {
        const messages = await listChatbotMessages(userId);
        return NextResponse.json({ messages });
    } catch (e) {
        return NextResponse.json({ error: "Failed to load messages", detail: String(e) }, { status: 500 });
    }
}

/** Persist one user question + assistant answer after a completed chatbot job. */
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

    const b = body as { question?: unknown; answer?: unknown };
    if (typeof b.question !== "string" || typeof b.answer !== "string") {
        return NextResponse.json({ error: "Expected { question: string, answer: string }" }, { status: 400 });
    }
    const question = b.question.trim();
    const answer = b.answer.trim();
    if (!question || !answer) {
        return NextResponse.json({ error: "question and answer must be non-empty" }, { status: 400 });
    }

    try {
        await appendChatbotExchange(userId, question, answer);
        return NextResponse.json({ ok: true });
    } catch (e) {
        return NextResponse.json({ error: "Failed to save messages", detail: String(e) }, { status: 500 });
    }
}

export async function DELETE() {
    const userId = await getAuthedUserId();
    if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    try {
        const deleted = await clearChatbotMessages(userId);
        return NextResponse.json({ ok: true, deleted });
    } catch (e) {
        return NextResponse.json({ error: "Failed to clear messages", detail: String(e) }, { status: 500 });
    }
}
