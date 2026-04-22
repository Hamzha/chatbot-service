import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserIdWithPermission } from "@/lib/auth/requireApiPermission";
import {
  errorMessage,
  internalServerError,
  parseJsonBody,
  validationError,
} from "@/lib/api/routeValidation";
import { withApiLogging } from "@/lib/api/withApiLogging";
import { requireRateLimitByUser } from "@/lib/rateLimit/requireRateLimit";
import { createChatSession, listChatSessions, resolveSessionSelectedDocuments } from "@/lib/db/chatSessionRepo";

const createSessionSchema = z.object({
  name: z.string().optional().default(""),
  documentIds: z
    .array(z.string().trim().min(1, "documentIds must contain valid string ids"))
    .min(1, "documentIds must be a non-empty array"),
});

async function getSessions() {
  const auth = await requireUserIdWithPermission("chatbot_sessions:read");
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;
  const limited = await requireRateLimitByUser(userId, "chatbot:sessions:read", {
    limit: 60,
    windowSec: 60,
  });
  if (limited) return limited;
  try {
    const sessions = await listChatSessions(userId);
    return NextResponse.json({ sessions });
  } catch (error) {
    return internalServerError(error, "Failed to list sessions");
  }
}

async function postSessions(request: Request) {
  const auth = await requireUserIdWithPermission("chatbot_sessions:create");
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;
  const limited = await requireRateLimitByUser(userId, "chatbot:sessions:create", {
    limit: 20,
    windowSec: 60,
  });
  if (limited) return limited;
  const parsed = await parseJsonBody(request, createSessionSchema);
  if (!parsed.ok) return parsed.response;
  const { name, documentIds } = parsed.data;

  try {
    const session = await createChatSession(userId, name, documentIds);
    const selectedDocuments = await resolveSessionSelectedDocuments(userId, session.selectedRagKeys);
    return NextResponse.json({ session, selectedDocuments });
  } catch (error) {
    return validationError(errorMessage(error, "Failed to create session"));
  }
}

export const GET = withApiLogging(getSessions);
export const POST = withApiLogging(postSessions);
