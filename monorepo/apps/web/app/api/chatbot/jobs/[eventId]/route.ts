import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth/requireApiPermission";
import { upstreamError, validationError } from "@/lib/api/routeValidation";
import { withApiLogging } from "@/lib/api/withApiLogging";
import { getChatbotApiBaseUrl } from "@/lib/chatbot/getChatbotApiBaseUrl";
import { proxyChatbotResponse } from "@/lib/chatbot/proxyUpstream";
import { requireRateLimitByUser } from "@/lib/rateLimit/requireRateLimit";

async function getJobStatus(
  _request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const gate = await requireApiPermission("chatbot_jobs:read");
  if (gate instanceof NextResponse) return gate;
  const limited = await requireRateLimitByUser(gate.ctx.userId, "chatbot:jobs:read", {
    limit: 60,
    windowSec: 60,
  });
  if (limited) return limited;

  const { eventId } = await params;
  if (!eventId || !eventId.trim()) {
    return validationError("Missing eventId");
  }
  try {
    const res = await fetch(`${getChatbotApiBaseUrl()}/v1/jobs/${eventId.trim()}`, { method: "GET" });
    const text = await res.text();
    return proxyChatbotResponse(res, text);
  } catch (error) {
    return upstreamError(error, "Cannot reach chatbot service");
  }
}

export const GET = withApiLogging(getJobStatus);

