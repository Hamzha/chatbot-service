import { NextResponse } from "next/server";
import { getCurrentUserFromToken } from "@/lib/auth/authService";
import { getSessionCookie } from "@repo/auth/lib/cookies";
import { listChatSessions } from "@/lib/db/chatSessionRepo";

export async function GET() {
  const token = await getSessionCookie();
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await getCurrentUserFromToken(token);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sessions = await listChatSessions(user.id);
  const botId = sessions[0]?.id ?? null;
  if (!botId) {
    return NextResponse.json({ error: "No chatbots found" }, { status: 404 });
  }

  return NextResponse.json({ botId });
}
