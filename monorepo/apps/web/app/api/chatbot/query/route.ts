import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserIdWithPermission } from "@/lib/auth/requireApiPermission";
import { jsonError, parseJsonBody, upstreamError, validationError } from "@/lib/api/routeValidation";
import { withApiLogging } from "@/lib/api/withApiLogging";
import { requireRateLimitByUser } from "@/lib/rateLimit/requireRateLimit";
import { expandSessionRagKeys } from "@/lib/chatbot/expandSessionRagKeys";
import { formatConversationContext } from "@/lib/chatbot/formatConversationContext";
import {
  getChatbotApiBaseUrl,
  getModelGatewayApiBaseUrl,
  isChatbotApiEnabled,
} from "@/lib/chatbot/getChatbotServiceBaseUrl";
import { proxyChatbotResponse } from "@/lib/chatbot/proxyUpstream";
import { createSyntheticQueryJob } from "@/lib/chatbot/syntheticQueryJobs";
import { listChatbotMessages } from "@/lib/db/chatbotMessageRepo";
import { getChatSession } from "@/lib/db/chatSessionRepo";

const querySchema = z.object({
  question: z.string().trim().min(1, "Missing question"),
  top_k: z.number().int().min(1).max(20).optional(),
  sessionId: z.string().trim().min(1, "Missing sessionId"),
});

async function postQuery(request: Request) {
  const auth = await requireUserIdWithPermission("chatbot_query:create");
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  const limited = await requireRateLimitByUser(userId, "chatbot:query", { limit: 30, windowSec: 60 });
  if (limited) return limited;

  const parsed = await parseJsonBody(request, querySchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  const session = await getChatSession(userId, body.sessionId);
  if (!session) {
    return jsonError("Chat session not found", 404);
  }
  if (session.selectedRagKeys.length === 0) {
    return validationError("This chat has no documents selected");
  }

  // Expand site-aggregator keys to the full page-level key list at query time so that
  // re-crawls that add pages automatically become visible to existing sessions without
  // any session-level migration.
  const expandedSourceIds = await expandSessionRagKeys(userId, session.selectedRagKeys);
  if (expandedSourceIds.length === 0) {
    return validationError("The documents selected for this chat no longer have indexed content");
  }

  const priorMessages = await listChatbotMessages(userId, body.sessionId, 80);
  const conversation_context = formatConversationContext(
    priorMessages.map((m) => ({ role: m.role, content: m.content })),
  );
  const payload = {
    question: body.question.trim(),
    top_k: body.top_k ?? 4,
    source_ids: expandedSourceIds,
    ...(conversation_context ? { conversation_context } : {}),
  };

  if (!isChatbotApiEnabled()) {
    try {
      const res = await fetch(`${getModelGatewayApiBaseUrl()}/api/chat/completions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: payload.question }],
          user_id: userId,
          top_k: payload.top_k,
          source_ids: payload.source_ids,
          conversation_context: payload.conversation_context,
        }),
      });
      const text = await res.text();
      if (!res.ok) {
        return proxyChatbotResponse(res, text);
      }

      let parsed: { output_text?: string; sources?: string[] };
      try {
        parsed = JSON.parse(text) as { output_text?: string; sources?: string[] };
      } catch {
        return NextResponse.json(
          {
            error: "Model gateway returned non-JSON",
            detail: text.slice(0, 800),
            upstreamStatus: res.status,
          },
          { status: 502 },
        );
      }

      const answer = (parsed.output_text ?? "").trim();
      const sources = Array.isArray(parsed.sources) ? parsed.sources : [];
      const eventId = createSyntheticQueryJob({ answer, sources });
      return NextResponse.json({ event_ids: [eventId] });
    } catch (error) {
      return upstreamError(error, "Cannot reach model gateway service");
    }
  }

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
  } catch (error) {
    return upstreamError(error, "Cannot reach chatbot service");
  }
}

export const POST = withApiLogging(postQuery);
