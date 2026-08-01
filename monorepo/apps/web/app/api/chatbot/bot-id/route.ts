import { NextResponse } from "next/server";
import { requireUserIdWithPermission } from "@/lib/auth/requireApiPermission";
import { notFoundError } from "@/lib/api/routeValidation";
import { withApiLogging } from "@/lib/api/withApiLogging";
import { requireRateLimitByUser } from "@/lib/rateLimit/requireRateLimit";
import { listChatSessions } from "@/lib/db/chatSessionRepo";

async function getBotId() {
  const gate = await requireUserIdWithPermission("chatbot_sessions:read");
  if (gate instanceof NextResponse) return gate;
  const { userId } = gate;
  const limited = await requireRateLimitByUser(userId, "chatbot:bot-id:read", {
    limit: 30,
    windowSec: 60,
  });
  if (limited) return limited;

  const sessions = await listChatSessions(userId);
  const botId = sessions[0]?.id ?? null;
  if (!botId) {
    return notFoundError("No chatbots found");
  }

  return NextResponse.json({ botId });
}

export const GET = withApiLogging(getBotId);
