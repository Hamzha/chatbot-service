import { NextResponse } from "next/server";
import { requireUserIdWithPermission } from "@/lib/auth/requireApiPermission";
import { upstreamError } from "@/lib/api/routeValidation";
import { getChatbotApiBaseUrl } from "@/lib/chatbot/getChatbotApiBaseUrl";
import { proxyChatbotResponse } from "@/lib/chatbot/proxyUpstream";
import { requireRateLimitByUser } from "@/lib/rateLimit/requireRateLimit";

export async function GET() {
  const auth = await requireUserIdWithPermission("chatbot_sources:read");
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;
  const limited = await requireRateLimitByUser(userId, "chatbot:sources:read", {
    limit: 60,
    windowSec: 60,
  });
  if (limited) return limited;

  try {
    const res = await fetch(`${getChatbotApiBaseUrl()}/v1/sources`, {
      method: "GET",
      headers: { "x-user-id": userId },
    });
    const text = await res.text();
    return proxyChatbotResponse(res, text);
  } catch (error) {
    return upstreamError(error, "Cannot reach chatbot service");
  }
}

