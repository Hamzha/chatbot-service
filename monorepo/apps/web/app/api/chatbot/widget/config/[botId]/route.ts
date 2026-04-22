import { NextResponse } from "next/server";
import { notFoundError, validationError } from "@/lib/api/routeValidation";
import { withApiLogging } from "@/lib/api/withApiLogging";
import { requireRateLimitByIp } from "@/lib/rateLimit/requireRateLimit";
import { getChatSessionById } from "@/lib/db/chatSessionRepo";

/** Public endpoint — widget fetches its color config using the botId (no auth). */
async function getPublicWidgetConfig(
  _request: Request,
  { params }: { params: Promise<{ botId: string }> },
) {
  const limited = await requireRateLimitByIp(_request, "chatbot:widget:config:public", {
    limit: 120,
    windowSec: 60,
  });
  if (limited) return limited;
  const { botId } = await params;

  if (!botId || !botId.trim()) {
    return validationError("Missing botId");
  }

  const chatbot = await getChatSessionById(botId.trim());
  if (!chatbot) {
    return notFoundError("Invalid botId");
  }

  return NextResponse.json({
    primaryColor: chatbot.primaryColor,
  });
}

export const GET = withApiLogging(getPublicWidgetConfig);
