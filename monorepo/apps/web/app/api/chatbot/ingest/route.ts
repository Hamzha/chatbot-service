import { NextResponse } from "next/server";
import { requireUserIdWithPermission } from "@/lib/auth/requireApiPermission";
import { withApiLogging } from "@/lib/api/withApiLogging";
import { requireRateLimitByUser } from "@/lib/rateLimit/requireRateLimit";
import { proxyChatbotResponse } from "@/lib/chatbot/proxyUpstream";
import {
  getRagServiceBaseUrl,
  isRagOnChatbotApi,
  ragIngestPdfUrl,
  ragUserHeaders,
} from "@/lib/chatbot/ragService";
import { createSyntheticIngestJob } from "@/lib/chatbot/syntheticQueryJobs";
import { createPendingChatbotDocument } from "@/lib/db/chatbotDocumentRepo";

async function postIngest(request: Request) {
  const auth = await requireUserIdWithPermission("chatbot_documents:create");
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  const limited = await requireRateLimitByUser(userId, "chatbot:ingest", { limit: 10, windowSec: 60 });
  if (limited) return limited;

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

  const baseUrl = getRagServiceBaseUrl();
  const fd = new FormData();
  fd.append("file", file);

  if (isRagOnChatbotApi()) {
    try {
      const res = await fetch(ragIngestPdfUrl(baseUrl), {
        method: "POST",
        headers: {
          ...ragUserHeaders(userId),
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

  fd.append("user_id", userId);
  fd.append("source_id", pending.ragSourceKey);
  try {
    const res = await fetch(ragIngestPdfUrl(baseUrl), { method: "POST", body: fd });
    const text = await res.text();
    if (!res.ok) {
      return proxyChatbotResponse(res, text);
    }
    let parsed: { ingested?: number; source?: string };
    try {
      parsed = JSON.parse(text) as { ingested?: number; source?: string };
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON from model gateway", detail: text.slice(0, 200) },
        { status: 502 },
      );
    }
    const eventId = createSyntheticIngestJob({
      ingested: typeof parsed.ingested === "number" ? parsed.ingested : 0,
      source: parsed.source ?? pending.ragSourceKey,
    });
    return NextResponse.json({
      event_ids: [eventId],
      document: {
        id: pending.id,
        source: pending.source,
        ragSourceKey: pending.ragSourceKey,
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: "Cannot reach model gateway service", detail: String(e) },
      { status: 502 },
    );
  }
}

export const POST = withApiLogging(postIngest);
