import { NextResponse } from "next/server";
import { getCurrentUserFromToken } from "@/lib/auth/authService";
import { getSessionCookie } from "@repo/auth/lib/cookies";
import { deleteMessagesForSession } from "@/lib/db/chatbotMessageRepo";
import {
  deleteChatSession,
  getChatSession,
  resolveSessionSelectedDocuments,
  updateChatSession,
} from "@/lib/db/chatSessionRepo";

async function getAuthedUserId(): Promise<string | null> {
  const token = await getSessionCookie();
  if (!token) return null;
  const user = await getCurrentUserFromToken(token);
  return user?.id ?? null;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const userId = await getAuthedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { sessionId } = await params;
  const session = await getChatSession(userId, sessionId);
  if (!session) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const selectedDocuments = await resolveSessionSelectedDocuments(userId, session.selectedRagKeys);
  return NextResponse.json({ session, selectedDocuments });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const userId = await getAuthedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { sessionId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const b = body as { name?: unknown; documentIds?: unknown; primaryColor?: unknown };
  const patch: { name?: string; documentIds?: string[]; primaryColor?: string } = {};
  if (b.name !== undefined) {
    if (typeof b.name !== "string") {
      return NextResponse.json({ error: "name must be a string" }, { status: 400 });
    }
    patch.name = b.name;
  }
  if (b.primaryColor !== undefined) {
    if (typeof b.primaryColor !== "string" || !/^#[0-9a-fA-F]{6}$/.test(b.primaryColor)) {
      return NextResponse.json(
        { error: "primaryColor must be a valid hex color (e.g. #0f766e)" },
        { status: 400 },
      );
    }
    patch.primaryColor = b.primaryColor;
  }
  if (b.documentIds !== undefined) {
    if (!Array.isArray(b.documentIds) || b.documentIds.length === 0) {
      return NextResponse.json({ error: "documentIds must be a non-empty array" }, { status: 400 });
    }
    const ids = b.documentIds.filter((id): id is string => typeof id === "string" && id.trim().length > 0);
    if (ids.length === 0) {
      return NextResponse.json({ error: "documentIds must contain valid string ids" }, { status: 400 });
    }
    patch.documentIds = ids;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No updates provided" }, { status: 400 });
  }

  try {
    const session = await updateChatSession(userId, sessionId, patch);
    if (!session) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const selectedDocuments = await resolveSessionSelectedDocuments(userId, session.selectedRagKeys);
    return NextResponse.json({ session, selectedDocuments });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 400 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const userId = await getAuthedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { sessionId } = await params;
  await deleteMessagesForSession(userId, sessionId);
  const ok = await deleteChatSession(userId, sessionId);
  if (!ok) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
