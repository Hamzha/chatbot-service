import { NextResponse } from "next/server";
import { getCurrentUserFromToken } from "@/lib/auth/authService";
import { getSessionCookie } from "@repo/auth/lib/cookies";
import { getChatbotApiBaseUrl } from "@/lib/chatbot/getChatbotApiBaseUrl";
import { proxyChatbotResponse } from "@/lib/chatbot/proxyUpstream";

async function ensureAuthed(): Promise<boolean> {
  const token = await getSessionCookie();
  if (!token) return false;
  const user = await getCurrentUserFromToken(token);
  return Boolean(user?.id);
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const authed = await ensureAuthed();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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

