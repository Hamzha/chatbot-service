import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserIdWithPermission } from "@/lib/auth/requireApiPermission";
import { notFoundError, parseJsonBody, validationError } from "@/lib/api/routeValidation";
import { requireRateLimitByUser } from "@/lib/rateLimit/requireRateLimit";
import { deleteMessagesForSession } from "@/lib/db/chatbotMessageRepo";
import {
  deleteChatSession,
  getChatSession,
  resolveSessionSelectedDocuments,
  updateChatSession,
} from "@/lib/db/chatSessionRepo";

const updateSessionSchema = z
  .object({
    name: z.string().optional(),
    documentIds: z.array(z.string().trim().min(1, "documentIds must contain valid string ids")).min(1, "documentIds must be a non-empty array").optional(),
    primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "primaryColor must be a valid hex color (e.g. #0f766e)").optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "No updates provided" });

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const auth = await requireUserIdWithPermission("chatbot_sessions:read");
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;
  const limited = await requireRateLimitByUser(userId, "chatbot:sessions:item:read", {
    limit: 90,
    windowSec: 60,
  });
  if (limited) return limited;
  const { sessionId } = await params;
  const session = await getChatSession(userId, sessionId);
  if (!session) {
    return notFoundError();
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
  const limited = await requireRateLimitByUser(userId, "chatbot:sessions:item:update", {
    limit: 30,
    windowSec: 60,
  });
  if (limited) return limited;
  const { sessionId } = await params;
  const parsed = await parseJsonBody(request, updateSessionSchema);
  if (!parsed.ok) return parsed.response;
  const patch = parsed.data;

  try {
    const session = await updateChatSession(userId, sessionId, patch);
    if (!session) {
      return notFoundError();
    }
    const selectedDocuments = await resolveSessionSelectedDocuments(userId, session.selectedRagKeys);
    return NextResponse.json({ session, selectedDocuments });
  } catch {
    return validationError("Failed to update session");
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const auth = await requireUserIdWithPermission("chatbot_sessions:delete");
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;
  const limited = await requireRateLimitByUser(userId, "chatbot:sessions:item:delete", {
    limit: 20,
    windowSec: 60,
  });
  if (limited) return limited;
  const { sessionId } = await params;
  await deleteMessagesForSession(userId, sessionId);
  const ok = await deleteChatSession(userId, sessionId);
  if (!ok) {
    return notFoundError();
  }
  return NextResponse.json({ ok: true });
}
