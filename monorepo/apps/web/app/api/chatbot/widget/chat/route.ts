import { NextResponse } from "next/server";
import { z } from "zod";
import { parseJsonBody } from "@/lib/api/routeValidation";
import { validateWidgetRequest } from "@/lib/chatbot/validateWidgetRequest";
import { requireRateLimitByIp } from "@/lib/rateLimit/requireRateLimit";

const widgetChatSchema = z.object({
  botId: z.unknown(),
  message: z.unknown(),
});

export async function POST(request: Request) {
  const limited = await requireRateLimitByIp(request, "widget:chat", { limit: 30, windowSec: 60 });
  if (limited) return limited;
  const parsed = await parseJsonBody(request, widgetChatSchema);
  if (!parsed.ok) return parsed.response;
  const result = await validateWidgetRequest(parsed.data);

  if (!result.valid) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  // Static response for now — will be replaced with real chatbot service call
  return NextResponse.json({
    reply: "Thanks for your message! This is a demo response. The chatbot will be fully connected soon.",
  });
}
