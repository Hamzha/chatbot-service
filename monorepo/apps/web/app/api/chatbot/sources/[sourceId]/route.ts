import { NextResponse } from "next/server";
import { requireUserIdWithPermission } from "@/lib/auth/requireApiPermission";
import { getChatbotApiBaseUrl } from "@/lib/chatbot/getChatbotApiBaseUrl";
import { proxyChatbotResponse } from "@/lib/chatbot/proxyUpstream";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ sourceId: string }> }
) {
  const auth = await requireUserIdWithPermission("chatbot_sources:delete");
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  const { sourceId } = await params;
  try {
    const res = await fetch(`${getChatbotApiBaseUrl()}/v1/sources/${encodeURIComponent(sourceId)}`, {
      method: "DELETE",
      headers: { "x-user-id": userId },
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

