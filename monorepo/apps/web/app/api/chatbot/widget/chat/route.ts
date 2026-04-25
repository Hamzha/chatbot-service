import { NextResponse } from "next/server";
import { z } from "zod";
import { parseJsonBody } from "@/lib/api/routeValidation";
import { withApiLogging } from "@/lib/api/withApiLogging";
import { getChatSessionById } from "@/lib/db/chatSessionRepo";
import { getWidgetChatBackendBaseUrl } from "@/lib/chatbot/getChatbotServiceBaseUrl";
import { validateWidgetRequest } from "@/lib/chatbot/validateWidgetRequest";
import { requireRateLimitByIp } from "@/lib/rateLimit/requireRateLimit";

const widgetChatSchema = z.object({
  botId: z.unknown(),
  message: z.unknown(),
});

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

  const useChatbotApi = (process.env.USE_CHATBOT_API || process.env.NEXT_PUBLIC_USE_CHATBOT_API || "")
    .trim()
    .toLowerCase()
    .match(/^(1|true|yes|on)$/) !== null;
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

  return NextResponse.json({
    reply: data.reply || data.answer || data.output_text || "Thanks for your message.",
    sources: data.sources ?? [],
    num_contexts: data.num_contexts ?? 0,
    backend: useChatbotApi ? "chatbot-api" : "model-gateway-api",
  });
}

export const POST = withApiLogging(postWidgetChat);
