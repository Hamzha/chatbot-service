import { NextResponse } from "next/server";
import { requireUserIdWithPermission } from "@/lib/auth/requireApiPermission";
import { upstreamError, validationError } from "@/lib/api/routeValidation";
import { withApiLogging } from "@/lib/api/withApiLogging";
import { getChatbotApiBaseUrl } from "@/lib/chatbot/getChatbotApiBaseUrl";
import { proxyChatbotResponse } from "@/lib/chatbot/proxyUpstream";
import { requireRateLimitByUser } from "@/lib/rateLimit/requireRateLimit";

async function deleteSource(
  _request: Request,
  { params }: { params: Promise<{ sourceId: string }> }
) {
  const auth = await requireUserIdWithPermission("chatbot_sources:delete");
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;
  const limited = await requireRateLimitByUser(userId, "chatbot:sources:delete", {
    limit: 20,
    windowSec: 60,
  });
  if (limited) return limited;

  const { sourceId } = await params;
  if (!sourceId || !sourceId.trim()) {
    return validationError("Missing sourceId");
  }
  try {
    const res = await fetch(`${getChatbotApiBaseUrl()}/v1/sources/${encodeURIComponent(sourceId.trim())}`, {
      method: "DELETE",
      headers: { "x-user-id": userId },
    });
    const text = await res.text();
    return proxyChatbotResponse(res, text);
  } catch (error) {
    return upstreamError(error, "Cannot reach chatbot service");
  }
}

export const DELETE = withApiLogging(deleteSource);

