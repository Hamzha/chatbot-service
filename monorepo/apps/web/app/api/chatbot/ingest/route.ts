import { NextResponse } from "next/server";
import { getCurrentUserFromToken } from "@/lib/auth/authService";
import { getSessionCookie } from "@repo/auth/lib/cookies";
import { proxyChatbotResponse } from "@/lib/chatbot/proxyUpstream";

const CHATBOT_API_BASE =
  process.env.CHATBOT_API_URL ??
  process.env.NEXT_PUBLIC_CHATBOT_API_BASE_URL ??
  "http://127.0.0.1:8001";

async function getAuthedUserId(): Promise<string | null> {
  const token = await getSessionCookie();
  if (!token) return null;
  const user = await getCurrentUserFromToken(token);
  return user?.id ?? null;
}

export async function POST(request: Request) {
  const userId = await getAuthedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const incoming = await request.formData();
  const file = incoming.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  const fd = new FormData();
  fd.append("file", file);

  try {
    const res = await fetch(`${CHATBOT_API_BASE}/v1/ingest`, {
      method: "POST",
      headers: { "x-user-id": userId },
      body: fd,
    });
    const text = await res.text();
    return proxyChatbotResponse(res, text);
  } catch (e) {
    return NextResponse.json(
      { error: "Cannot reach chatbot service", detail: String(e) },
      { status: 502 },
    );
  }
}

