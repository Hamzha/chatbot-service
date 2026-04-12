import { NextResponse } from "next/server";
import { getCurrentUserFromToken } from "@/lib/auth/authService";
import { getSessionCookie } from "@repo/auth/lib/cookies";
import { getChatbotApiBaseUrl } from "@/lib/chatbot/getChatbotApiBaseUrl";
import { proxyChatbotResponse } from "@/lib/chatbot/proxyUpstream";
import { createPendingChatbotDocument } from "@/lib/db/chatbotDocumentRepo";

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

  let pending;
  try {
    pending = await createPendingChatbotDocument(userId, file.name || "document.pdf");
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 400 });
  }

  const fd = new FormData();
  fd.append("file", file);

  try {
    const res = await fetch(`${getChatbotApiBaseUrl()}/v1/ingest`, {
      method: "POST",
      headers: {
        "x-user-id": userId,
        "x-rag-source-id": pending.ragSourceKey,
      },
      body: fd,
    });
    const text = await res.text();
    if (!res.ok) {
      return proxyChatbotResponse(res, text);
    }
    let parsed: { event_ids?: string[] };
    try {
      parsed = JSON.parse(text) as { event_ids?: string[] };
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON from chatbot service", detail: text.slice(0, 200) },
        { status: 502 },
      );
    }
    return NextResponse.json({
      event_ids: parsed.event_ids,
      document: {
        id: pending.id,
        source: pending.source,
        ragSourceKey: pending.ragSourceKey,
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: "Cannot reach chatbot service", detail: String(e) },
      { status: 502 },
    );
  }
}
