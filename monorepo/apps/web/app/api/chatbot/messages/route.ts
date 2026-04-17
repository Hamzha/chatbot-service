import { NextResponse } from "next/server";
import { requireUserIdWithPermission } from "@/lib/auth/requireApiPermission";
import {
  appendChatbotExchange,
  clearChatbotMessages,
  listChatbotMessages,
} from "@/lib/db/chatbotMessageRepo";

function sessionIdFromUrl(request: Request): string | null {
  const url = new URL(request.url);
  const sid = url.searchParams.get("sessionId");
  return sid && sid.trim() ? sid.trim() : null;
}

export async function GET(request: Request) {
  const auth = await requireUserIdWithPermission("chatbot_messages:read");
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;
  const sessionId = sessionIdFromUrl(request);
  if (!sessionId) {
    return NextResponse.json({ error: "Missing sessionId query parameter" }, { status: 400 });
  }
  try {
    const messages = await listChatbotMessages(userId, sessionId);
    return NextResponse.json({ messages });
  } catch (e) {
    return NextResponse.json({ error: "Failed to load messages", detail: String(e) }, { status: 500 });
  }
}

/** Persist one user question + assistant answer after a completed chatbot job. */
export async function POST(request: Request) {
  const auth = await requireUserIdWithPermission("chatbot_messages:create");
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const b = body as { question?: unknown; answer?: unknown; sessionId?: unknown };
  if (typeof b.question !== "string" || typeof b.answer !== "string") {
    return NextResponse.json({ error: "Expected { question, answer, sessionId }" }, { status: 400 });
  }
  if (typeof b.sessionId !== "string" || !b.sessionId.trim()) {
    return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
  }
  const question = b.question.trim();
  const answer = b.answer.trim();
  if (!question || !answer) {
    return NextResponse.json({ error: "question and answer must be non-empty" }, { status: 400 });
  }

  try {
    await appendChatbotExchange(userId, b.sessionId.trim(), question, answer);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: "Failed to save messages", detail: String(e) }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const auth = await requireUserIdWithPermission("chatbot_messages:delete");
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;
  const sessionId = sessionIdFromUrl(request);
  if (!sessionId) {
    return NextResponse.json({ error: "Missing sessionId query parameter" }, { status: 400 });
  }
  try {
    const deleted = await clearChatbotMessages(userId, sessionId);
    return NextResponse.json({ ok: true, deleted });
  } catch (e) {
    return NextResponse.json({ error: "Failed to clear messages", detail: String(e) }, { status: 500 });
  }
}
