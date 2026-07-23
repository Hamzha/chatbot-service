import { NextResponse } from "next/server";
import { z } from "zod";
import { parseJsonBody } from "@/lib/api/routeValidation";
import { withApiLogging } from "@/lib/api/withApiLogging";
import { getChatSessionById } from "@/lib/db/chatSessionRepo";
import { getWidgetChatBackendBaseUrl, isChatbotApiEnabled } from "@/lib/chatbot/getChatbotServiceBaseUrl";
import { validateWidgetRequest } from "@/lib/chatbot/validateWidgetRequest";
import { requireRateLimitByIp } from "@/lib/rateLimit/requireRateLimit";
import { requireFeatureQuota } from "@/lib/limits/requireFeatureQuota";
import { appendWidgetMessage } from "@/lib/db/widgetMessageRepo";
import { findActiveTakeoverForSession } from "@/lib/db/escalationRepo";
import { maybeAutoEscalate } from "@/lib/chatbot/autoEscalation";

const widgetChatSchema = z.object({
  botId: z.unknown(),
  message: z.unknown(),
  widgetSessionId: z.unknown().optional(),
});

function normalizeWidgetSessionId(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 128) return null;
  return trimmed;
}

const LIVE_HOLDING_REPLY =
  "An agent is reviewing your message and will reply here shortly.";

type UpstreamWidgetResponse = {
  reply?: string;
  answer?: string;
  output_text?: string;
  sources?: string[];
  num_contexts?: number;
  error?: string;
  detail?: string;
};

async function postWidgetChat(request: Request) {
  const limited = await requireRateLimitByIp(request, "widget:chat", { limit: 30, windowSec: 60 });
  if (limited) return limited;
  const parsed = await parseJsonBody(request, widgetChatSchema);
  if (!parsed.ok) return parsed.response;
  const result = await validateWidgetRequest(parsed.data);

  if (!result.valid) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const chatbot = await getChatSessionById(result.botId);
  if (!chatbot) {
    return NextResponse.json({ error: "Invalid botId" }, { status: 404 });
  }

  const widgetQuota = await requireFeatureQuota(chatbot.userId, "widgetChats");
  if (widgetQuota) return widgetQuota;

  const widgetSessionId = normalizeWidgetSessionId(parsed.data.widgetSessionId);

  if (widgetSessionId) {
    const activeTakeover = await findActiveTakeoverForSession(widgetSessionId);
    if (activeTakeover) {
      try {
        await appendWidgetMessage({
          botId: result.botId,
          widgetSessionId,
          role: "user",
          content: result.message,
        });
      } catch (err) {
        console.error("[widget:chat] failed to persist user message during takeover", err);
      }
      return NextResponse.json({
        reply: LIVE_HOLDING_REPLY,
        sources: [],
        num_contexts: 0,
        backend: "live-agent",
        live: true,
      });
    }
  }

  const useChatbotApi = isChatbotApiEnabled();
  const baseUrl = getWidgetChatBackendBaseUrl();
  const sourceIds = chatbot.selectedRagKeys.filter((sourceId) => sourceId.trim().length > 0);

  const upstream = useChatbotApi
    ? await fetch(`${baseUrl}/v1/query/sync`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-user-id": chatbot.userId,
      },
      body: JSON.stringify({
        question: result.message,
        top_k: 4,
        source_ids: sourceIds,
      }),
    })
    : await fetch(`${baseUrl}/api/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: result.message }],
        user_id: chatbot.userId,
        top_k: 4,
        source_ids: sourceIds,
      }),
    });

  const text = await upstream.text();
  if (!text.trim()) {
    return NextResponse.json(
      { error: "Empty response from chatbot service", upstreamStatus: upstream.status },
      { status: upstream.status >= 400 ? upstream.status : 502 },
    );
  }

  let data: UpstreamWidgetResponse;
  try {
    data = JSON.parse(text) as UpstreamWidgetResponse;
  } catch {
    return NextResponse.json(
      {
        error: "Chatbot service returned non-JSON",
        detail: text.slice(0, 800),
        upstreamStatus: upstream.status,
      },
      { status: upstream.status >= 400 ? upstream.status : 502 },
    );
  }

  if (!upstream.ok) {
    const status = upstream.status >= 400 ? upstream.status : 502;
    return NextResponse.json(
      {
        error: data.error || data.detail || "Chatbot service request failed",
        detail: data.detail,
        upstreamStatus: upstream.status,
      },
      { status },
    );
  }

  const replyText = data.reply || data.answer || data.output_text || "Thanks for your message.";
  const numContexts = typeof data.num_contexts === "number" ? data.num_contexts : 0;

  if (widgetSessionId) {
    try {
      await appendWidgetMessage({
        botId: result.botId,
        widgetSessionId,
        role: "user",
        content: result.message,
      });
      await appendWidgetMessage({
        botId: result.botId,
        widgetSessionId,
        role: "bot",
        content: replyText,
        metadata: { numContexts },
      });
    } catch (err) {
      console.error("[widget:chat] failed to persist exchange", err);
    }

    void maybeAutoEscalate({
      chatbot: {
        id: chatbot.id,
        userId: chatbot.userId,
        autoEscalationEnabled: chatbot.autoEscalationEnabled,
      },
      widgetSessionId,
      currentBotMessageNumContexts: numContexts,
    }).catch((err) => {
      console.error("[widget:chat] auto-escalation check failed", err);
    });
  }

  return NextResponse.json({
    reply: replyText,
    sources: data.sources ?? [],
    num_contexts: numContexts,
    backend: useChatbotApi ? "chatbot-api" : "model-gateway-api",
  });
}

export const POST = withApiLogging(postWidgetChat);
