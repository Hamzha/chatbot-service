import { NextResponse } from "next/server";
import { requireUserIdWithPermission } from "@/lib/auth/requireApiPermission";
import { requireRateLimitByUser } from "@/lib/rateLimit/requireRateLimit";
import { expandSessionRagKeys } from "@/lib/chatbot/expandSessionRagKeys";
import { formatConversationContext } from "@/lib/chatbot/formatConversationContext";
import { getChatbotApiBaseUrl } from "@/lib/chatbot/getChatbotApiBaseUrl";
import { proxyChatbotResponse } from "@/lib/chatbot/proxyUpstream";
import { listChatbotMessages } from "@/lib/db/chatbotMessageRepo";
import { getChatSession } from "@/lib/db/chatSessionRepo";

export async function POST(request: Request) {
  const auth = await requireUserIdWithPermission("chatbot_query:create");
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  const limited = await requireRateLimitByUser(userId, "chatbot:query", { limit: 30, windowSec: 60 });
  if (limited) return limited;

  const body = (await request.json()) as {
    question?: string;
    top_k?: number;
    sessionId?: string;
  };
  if (typeof body.question !== "string" || !body.question.trim()) {
    return NextResponse.json({ error: "Missing question" }, { status: 400 });
  }
  if (typeof body.sessionId !== "string" || !body.sessionId.trim()) {
    return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
  }

  const session = await getChatSession(userId, body.sessionId.trim());
  if (!session) {
    return NextResponse.json({ error: "Chat session not found" }, { status: 404 });
  }
  if (session.selectedRagKeys.length === 0) {
    return NextResponse.json({ error: "This chat has no documents selected" }, { status: 400 });
  }

  // Expand site-aggregator keys to the full page-level key list at query time so that
  // re-crawls that add pages automatically become visible to existing sessions without
  // any session-level migration.
  const expandedSourceIds = await expandSessionRagKeys(userId, session.selectedRagKeys);
  if (expandedSourceIds.length === 0) {
    return NextResponse.json(
      { error: "The documents selected for this chat no longer have indexed content" },
      { status: 400 },
    );
  }

  const priorMessages = await listChatbotMessages(userId, body.sessionId.trim(), 80);
  const conversation_context = formatConversationContext(
    priorMessages.map((m) => ({ role: m.role, content: m.content })),
  );
  const payload = {
    question: body.question.trim(),
    top_k: body.top_k ?? 4,
    source_ids: expandedSourceIds,
    ...(conversation_context ? { conversation_context } : {}),
  };
  try {
    const res = await fetch(`${getChatbotApiBaseUrl()}/v1/query`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-user-id": userId,
      },
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    return proxyChatbotResponse(res, text);
  } catch (e) {
    return NextResponse.json(
      { error: "Cannot reach chatbot service", detail: String(e) },
      { status: 502 },
    );
  }
}
