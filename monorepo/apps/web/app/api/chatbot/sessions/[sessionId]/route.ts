import { NextResponse } from "next/server";
import { requireUserIdWithPermission } from "@/lib/auth/requireApiPermission";
import { deleteMessagesForSession } from "@/lib/db/chatbotMessageRepo";
import {
  deleteChatSession,
  getChatSession,
  resolveSessionSelectedDocuments,
  updateChatSession,
} from "@/lib/db/chatSessionRepo";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const auth = await requireUserIdWithPermission("chatbot_sessions:read");
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;
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
  const auth = await requireUserIdWithPermission("chatbot_sessions:update");
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;
  const { sessionId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const b = body as { name?: unknown; documentIds?: unknown };
  const patch: { name?: string; documentIds?: string[] } = {};
  if (b.name !== undefined) {
    if (typeof b.name !== "string") {
      return NextResponse.json({ error: "name must be a string" }, { status: 400 });
    }
    patch.name = b.name;
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
  const auth = await requireUserIdWithPermission("chatbot_sessions:delete");
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;
  const { sessionId } = await params;
  await deleteMessagesForSession(userId, sessionId);
  const ok = await deleteChatSession(userId, sessionId);
  if (!ok) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
