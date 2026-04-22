import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserIdWithPermission } from "@/lib/auth/requireApiPermission";
import { internalServerError, jsonError, parseJsonBody } from "@/lib/api/routeValidation";
import { requireRateLimitByUser } from "@/lib/rateLimit/requireRateLimit";
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

const createMessageSchema = z.object({
  question: z.string().trim().min(1, "question must be non-empty"),
  answer: z.string().trim().min(1, "answer must be non-empty"),
  sessionId: z.string().trim().min(1, "sessionId is required"),
});

export async function GET(request: Request) {
  const auth = await requireUserIdWithPermission("chatbot_messages:read");
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;
  const limited = await requireRateLimitByUser(userId, "chatbot:messages:read", {
    limit: 90,
    windowSec: 60,
  });
  if (limited) return limited;
  const sessionId = sessionIdFromUrl(request);
  if (!sessionId) {
    return jsonError("Missing sessionId query parameter", 400);
  }
  try {
    const messages = await listChatbotMessages(userId, sessionId);
    return NextResponse.json({ messages });
  } catch (error) {
    return internalServerError(error, "Failed to load messages");
  }
}

/** Persist one user question + assistant answer after a completed chatbot job. */
export async function POST(request: Request) {
  const auth = await requireUserIdWithPermission("chatbot_messages:create");
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;
  const limited = await requireRateLimitByUser(userId, "chatbot:messages:create", {
    limit: 40,
    windowSec: 60,
  });
  if (limited) return limited;
  const parsed = await parseJsonBody(request, createMessageSchema);
  if (!parsed.ok) return parsed.response;
  const { question, answer, sessionId } = parsed.data;

  try {
    await appendChatbotExchange(userId, sessionId, question, answer);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return internalServerError(error, "Failed to save messages");
  }
}

export async function DELETE(request: Request) {
  const auth = await requireUserIdWithPermission("chatbot_messages:delete");
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;
  const limited = await requireRateLimitByUser(userId, "chatbot:messages:delete", {
    limit: 20,
    windowSec: 60,
  });
  if (limited) return limited;
  const sessionId = sessionIdFromUrl(request);
  if (!sessionId) {
    return jsonError("Missing sessionId query parameter", 400);
  }
  try {
    const deleted = await clearChatbotMessages(userId, sessionId);
    return NextResponse.json({ ok: true, deleted });
  } catch (error) {
    return internalServerError(error, "Failed to clear messages");
  }
}
