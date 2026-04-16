import { NextResponse } from "next/server";
import { getCurrentUserFromToken } from "@/lib/auth/authService";
import { getSessionCookie } from "@repo/auth/lib/cookies";
import { getChatSession, updateChatSession } from "@/lib/db/chatSessionRepo";

const HEX_COLOR_REGEX = /^#[0-9a-fA-F]{6}$/;

async function getAuthedUserId(): Promise<string | null> {
  const token = await getSessionCookie();
  if (!token) return null;
  const user = await getCurrentUserFromToken(token);
  return user?.id ?? null;
}

export async function GET(request: Request) {
  const userId = await getAuthedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sessionId = new URL(request.url).searchParams.get("sessionId")?.trim();
  if (!sessionId) {
    return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
  }

  const session = await getChatSession(userId, sessionId);
  if (!session) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    primaryColor: session.primaryColor,
  });
}

export async function PUT(request: Request) {
  const userId = await getAuthedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const b = body as { sessionId?: unknown; primaryColor?: unknown };

  if (typeof b.sessionId !== "string" || !b.sessionId.trim()) {
    return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
  }

  if (typeof b.primaryColor !== "string" || !HEX_COLOR_REGEX.test(b.primaryColor)) {
    return NextResponse.json(
      { error: "primaryColor must be a valid hex color (e.g. #0f766e)" },
      { status: 400 },
    );
  }

  const session = await updateChatSession(userId, b.sessionId.trim(), { primaryColor: b.primaryColor });
  if (!session) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    primaryColor: session.primaryColor,
  });
}
