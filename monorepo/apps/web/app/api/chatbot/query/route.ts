import { NextResponse } from "next/server";
import { getCurrentUserFromToken } from "@/lib/auth/authService";
import { getSessionCookie } from "@repo/auth/lib/cookies";
import { formatConversationContext } from "@/lib/chatbot/formatConversationContext";
import { proxyChatbotResponse } from "@/lib/chatbot/proxyUpstream";
import { listChatbotMessages } from "@/lib/db/chatbotMessageRepo";

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

export async function POST(request: Request) {
  const userId = await getAuthedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as { question?: string; top_k?: number };
  if (typeof body.question !== "string" || !body.question.trim()) {
    return NextResponse.json({ error: "Missing question" }, { status: 400 });
  }
  const priorMessages = await listChatbotMessages(userId, 80);
  const conversation_context = formatConversationContext(
    priorMessages.map((m) => ({ role: m.role, content: m.content })),
  );
  const payload = {
    question: body.question.trim(),
    top_k: body.top_k ?? 4,
    ...(conversation_context ? { conversation_context } : {}),
  };
  try {
    const res = await fetch(`${CHATBOT_API_BASE}/v1/query`, {
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

