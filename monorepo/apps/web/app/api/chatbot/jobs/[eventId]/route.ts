import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth/requireApiPermission";
import { getChatbotApiBaseUrl } from "@/lib/chatbot/getChatbotApiBaseUrl";
import { proxyChatbotResponse } from "@/lib/chatbot/proxyUpstream";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const gate = await requireApiPermission("chatbot_jobs:read");
  if (gate instanceof NextResponse) return gate;

  const { eventId } = await params;
  try {
    const res = await fetch(`${getChatbotApiBaseUrl()}/v1/jobs/${eventId}`, { method: "GET" });
    const text = await res.text();
    return proxyChatbotResponse(res, text);
  } catch (e) {
    return NextResponse.json(
      {
        error: "Cannot reach chatbot service",
        detail: String(e),
        baseUrl: getChatbotApiBaseUrl(),
        hint: "Start chatbot-api (port 8001, e.g. turbo run dev). Use http://127.0.0.1:8001 in CHATBOT_API_URL if localhost fails on Windows.",
      },
      { status: 502 },
    );
  }
}

