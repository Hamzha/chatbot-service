import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserIdWithPermission } from "@/lib/auth/requireApiPermission";
import { notFoundError, parseJsonBody, validationError } from "@/lib/api/routeValidation";
import { withApiLogging } from "@/lib/api/withApiLogging";
import { requireRateLimitByUser } from "@/lib/rateLimit/requireRateLimit";
import { getChatSession, updateChatSession } from "@/lib/db/chatSessionRepo";

const HEX_COLOR_REGEX = /^#[0-9a-fA-F]{6}$/;

const putWidgetConfigSchema = z.object({
  sessionId: z.string().trim().min(1, "sessionId is required"),
  primaryColor: z
    .string()
    .regex(HEX_COLOR_REGEX, "primaryColor must be a valid hex color (e.g. #0f766e)"),
});

async function getWidgetConfig(request: Request) {
  const gate = await requireUserIdWithPermission("chatbot_sessions:read");
  if (gate instanceof NextResponse) return gate;
  const { userId } = gate;
  const limited = await requireRateLimitByUser(userId, "chatbot:widget:config:read", {
    limit: 60,
    windowSec: 60,
  });
  if (limited) return limited;

  const sessionId = new URL(request.url).searchParams.get("sessionId")?.trim();
  if (!sessionId) {
    return validationError("sessionId is required");
  }

  const session = await getChatSession(userId, sessionId);
  if (!session) {
    return notFoundError();
  }

  return NextResponse.json({
    primaryColor: session.primaryColor,
  });
}

async function putWidgetConfig(request: Request) {
  const gate = await requireUserIdWithPermission("chatbot_sessions:update");
  if (gate instanceof NextResponse) return gate;
  const { userId } = gate;
  const limited = await requireRateLimitByUser(userId, "chatbot:widget:config:update", {
    limit: 30,
    windowSec: 60,
  });
  if (limited) return limited;
  const parsed = await parseJsonBody(request, putWidgetConfigSchema);
  if (!parsed.ok) return parsed.response;

  const session = await updateChatSession(userId, parsed.data.sessionId, {
    primaryColor: parsed.data.primaryColor,
  });
  if (!session) {
    return notFoundError();
  }

  return NextResponse.json({
    primaryColor: session.primaryColor,
  });
}

export const GET = withApiLogging(getWidgetConfig);
export const PUT = withApiLogging(putWidgetConfig);
