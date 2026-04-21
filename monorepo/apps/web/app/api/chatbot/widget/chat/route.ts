import { NextResponse } from "next/server";
import { validateWidgetRequest } from "@/lib/chatbot/validateWidgetRequest";
import { requireRateLimitByIp } from "@/lib/rateLimit/requireRateLimit";

export async function POST(request: Request) {
  const limited = await requireRateLimitByIp(request, "widget:chat", { limit: 30, windowSec: 60 });
  if (limited) return limited;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const result = await validateWidgetRequest(body as { botId: unknown; message: unknown });

  if (!result.valid) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  // Static response for now — will be replaced with real chatbot service call
  return NextResponse.json({
    reply: "Thanks for your message! This is a demo response. The chatbot will be fully connected soon.",
  });
}
