import { NextResponse } from "next/server";
import { getCurrentUserFromToken } from "@/lib/auth/authService";
import { getSessionCookie } from "@repo/auth/lib/cookies";
import { createChatSession, listChatSessions, resolveSessionSelectedDocuments } from "@/lib/db/chatSessionRepo";

async function getAuthedUserId(): Promise<string | null> {
  const token = await getSessionCookie();
  if (!token) return null;
  const user = await getCurrentUserFromToken(token);
  return user?.id ?? null;
}

export async function GET() {
  const userId = await getAuthedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const sessions = await listChatSessions(userId);
    return NextResponse.json({ sessions });
  } catch (e) {
    return NextResponse.json({ error: "Failed to list sessions", detail: String(e) }, { status: 500 });
  }
}

export async function POST(request: Request) {
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

  const b = body as { name?: unknown; documentIds?: unknown };
  const name = typeof b.name === "string" ? b.name : "";
  if (!Array.isArray(b.documentIds) || b.documentIds.length === 0) {
    return NextResponse.json({ error: "documentIds must be a non-empty array" }, { status: 400 });
  }
  const documentIds = b.documentIds.filter((id): id is string => typeof id === "string" && id.trim().length > 0);
  if (documentIds.length === 0) {
    return NextResponse.json({ error: "documentIds must contain valid string ids" }, { status: 400 });
  }

  try {
    const session = await createChatSession(userId, name, documentIds);
    const selectedDocuments = await resolveSessionSelectedDocuments(userId, session.selectedRagKeys);
    return NextResponse.json({ session, selectedDocuments });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 400 });
  }
}
