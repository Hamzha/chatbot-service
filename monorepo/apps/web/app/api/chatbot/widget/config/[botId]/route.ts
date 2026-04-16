import { NextResponse } from "next/server";
import { getChatSessionById } from "@/lib/db/chatSessionRepo";

/** Public endpoint — widget fetches its color config using the botId (no auth). */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ botId: string }> },
) {
  const { botId } = await params;

  if (!botId || !botId.trim()) {
    return NextResponse.json({ error: "Missing botId" }, { status: 400 });
  }

  const chatbot = await getChatSessionById(botId.trim());
  if (!chatbot) {
    return NextResponse.json({ error: "Invalid botId" }, { status: 404 });
  }

  return NextResponse.json({
    primaryColor: chatbot.primaryColor,
  });
}
