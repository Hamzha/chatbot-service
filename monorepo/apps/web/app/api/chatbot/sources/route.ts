import { NextResponse } from "next/server";
import { requireUserIdWithPermission } from "@/lib/auth/requireApiPermission";
import { upstreamError } from "@/lib/api/routeValidation";
import { withApiLogging } from "@/lib/api/withApiLogging";
import {
  getRagServiceBaseUrl,
  ragListSourcesRequestUrl,
  ragUserHeaders,
} from "@/lib/chatbot/ragService";
import { proxyChatbotResponse } from "@/lib/chatbot/proxyUpstream";
import { requireRateLimitByUser } from "@/lib/rateLimit/requireRateLimit";

async function getSources() {
  const auth = await requireUserIdWithPermission("chatbot_sources:read");
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;
  const limited = await requireRateLimitByUser(userId, "chatbot:sources:read", {
    limit: 60,
    windowSec: 60,
  });
  if (limited) return limited;

  try {
    const baseUrl = getRagServiceBaseUrl();
    const res = await fetch(ragListSourcesRequestUrl(baseUrl, userId), {
      method: "GET",
      headers: ragUserHeaders(userId),
    });
    const text = await res.text();
    return proxyChatbotResponse(res, text);
  } catch (error) {
    return upstreamError(error, "Cannot reach RAG service");
  }
}

export const GET = withApiLogging(getSources);

