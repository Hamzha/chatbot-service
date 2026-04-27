import { NextResponse } from "next/server";
import { z } from "zod";
import { parseJsonBody } from "@/lib/api/routeValidation";
import { withApiLogging } from "@/lib/api/withApiLogging";
import { getChatSessionByWidgetId } from "@/lib/db/chatSessionRepo";
import { expandSessionRagKeys } from "@/lib/chatbot/expandSessionRagKeys";
import { getWidgetChatBackendBaseUrl, isChatbotApiEnabled } from "@/lib/chatbot/getChatbotServiceBaseUrl";
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
  event_ids?: string[];
  status?: string;
  output?: {
    answer?: string;
    sources?: string[];
  } | null;
  error?: string;
  detail?: string;
};

const SUCCESS_STATES = new Set(["Completed", "Succeeded", "Success", "Finished"]);

async function postWidgetChat(request: Request) {
  const limited = await requireRateLimitByIp(request, "widget:chat", { limit: 30, windowSec: 60 });
  if (limited) return limited;
  const parsed = await parseJsonBody(request, widgetChatSchema);
  if (!parsed.ok) return parsed.response;
  const result = await validateWidgetRequest(parsed.data);

  if (!result.valid) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const chatbot = await getChatSessionByWidgetId(result.widgetId);
  if (!chatbot) {
    return NextResponse.json({ error: "Invalid botId" }, { status: 404 });
  }

  const useChatbotApi = isChatbotApiEnabled();
  const baseUrl = getWidgetChatBackendBaseUrl();
  const sourceIds = await expandSessionRagKeys(chatbot.userId, chatbot.selectedRagKeys);
  console.info("[widget-debug] resolved sources", {
    widgetId: result.widgetId,
    sessionId: chatbot.id,
    selectedRagKeys: chatbot.selectedRagKeys,
    sourceIds,
    backend: useChatbotApi ? "chatbot-api" : "model-gateway-api",
  });
  if (sourceIds.length === 0) {
    return NextResponse.json(
      { error: "This chatbot has no indexed document content available." },
      { status: 400 },
    );
  }

  if (useChatbotApi) {
    const queryRes = await fetch(`${baseUrl}/v1/query`, {
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
    });
    const queryText = await queryRes.text();
    if (!queryText.trim()) {
      return NextResponse.json(
        { error: "Empty response from chatbot service", upstreamStatus: queryRes.status },
        { status: queryRes.status >= 400 ? queryRes.status : 502 },
      );
    }

    let queryData: UpstreamWidgetResponse;
    try {
      queryData = JSON.parse(queryText) as UpstreamWidgetResponse;
    } catch {
      return NextResponse.json(
        {
          error: "Chatbot service returned non-JSON",
          detail: queryText.slice(0, 800),
          upstreamStatus: queryRes.status,
        },
        { status: queryRes.status >= 400 ? queryRes.status : 502 },
      );
    }

    if (!queryRes.ok) {
      const status = queryRes.status >= 400 ? queryRes.status : 502;
      return NextResponse.json(
        {
          error: queryData.error || queryData.detail || "Chatbot service request failed",
          detail: queryData.detail,
          upstreamStatus: queryRes.status,
        },
        { status },
      );
    }

    const eventId = queryData.event_ids?.[0];
    if (!eventId) {
      return NextResponse.json(
        { error: "No query event ID returned from chatbot service." },
        { status: 502 },
      );
    }

    let finalJobData: UpstreamWidgetResponse | null = null;
    for (let i = 0; i < 30; i += 1) {
      const jobRes = await fetch(`${baseUrl}/v1/jobs/${encodeURIComponent(eventId)}`, {
        method: "GET",
        headers: {
          "x-user-id": chatbot.userId,
        },
      });
      const jobText = await jobRes.text();
      if (!jobText.trim()) {
        return NextResponse.json(
          { error: "Empty job response from chatbot service", upstreamStatus: jobRes.status },
          { status: jobRes.status >= 400 ? jobRes.status : 502 },
        );
      }

      let jobData: UpstreamWidgetResponse;
      try {
        jobData = JSON.parse(jobText) as UpstreamWidgetResponse;
      } catch {
        return NextResponse.json(
          {
            error: "Chatbot job status returned non-JSON",
            detail: jobText.slice(0, 800),
            upstreamStatus: jobRes.status,
          },
          { status: jobRes.status >= 400 ? jobRes.status : 502 },
        );
      }

      if (!jobRes.ok) {
        const status = jobRes.status >= 400 ? jobRes.status : 502;
        return NextResponse.json(
          {
            error: jobData.error || jobData.detail || "Chatbot job polling failed",
            detail: jobData.detail,
            upstreamStatus: jobRes.status,
          },
          { status },
        );
      }

      if (typeof jobData.status === "string" && SUCCESS_STATES.has(jobData.status)) {
        finalJobData = jobData;
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    if (!finalJobData) {
      return NextResponse.json(
        { error: "Chatbot query timed out." },
        { status: 504 },
      );
    }

    return NextResponse.json({
      reply: finalJobData.output?.answer || "Thanks for your message.",
      sources: finalJobData.output?.sources ?? [],
      backend: "chatbot-api",
    });
  }

  const upstream = await fetch(`${baseUrl}/api/chat/completions`, {
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
    backend: "model-gateway-api",
  });
}

export const POST = withApiLogging(postWidgetChat);
