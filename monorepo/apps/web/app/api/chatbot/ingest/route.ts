import { NextResponse } from "next/server";
import { requireUserIdWithPermission } from "@/lib/auth/requireApiPermission";
import { withApiLogging } from "@/lib/api/withApiLogging";
import { requireRateLimitByUser } from "@/lib/rateLimit/requireRateLimit";
import {
  getChatbotApiBaseUrl,
  getModelGatewayApiBaseUrl,
  isChatbotApiEnabled,
} from "@/lib/chatbot/getChatbotServiceBaseUrl";
import { proxyChatbotResponse } from "@/lib/chatbot/proxyUpstream";
import { createPendingChatbotDocument } from "@/lib/db/chatbotDocumentRepo";
import { createSyntheticIngestJob } from "@/lib/chatbot/syntheticIngestJobs";

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

  const fd = new FormData();
  fd.append("file", file);

  try {
    const useChatbotApi = isChatbotApiEnabled();
    const res = useChatbotApi
      ? await fetch(`${getChatbotApiBaseUrl()}/v1/ingest`, {
        method: "POST",
        headers: {
          "x-user-id": userId,
          "x-rag-source-id": pending.ragSourceKey,
        },
        body: fd,
      })
      : await fetch(`${getModelGatewayApiBaseUrl()}/api/rag/ingest`, {
        method: "POST",
        body: (() => {
          const modelGatewayForm = new FormData();
          modelGatewayForm.append("file", file);
          modelGatewayForm.append("user_id", userId);
          modelGatewayForm.append("source_id", pending.ragSourceKey);
          return modelGatewayForm;
        })(),
      });

    const text = await res.text();
    if (!res.ok) {
      return proxyChatbotResponse(res, text);
    }

    try {
      if (useChatbotApi) {
        const parsed = JSON.parse(text) as { event_ids?: string[] };
        return NextResponse.json({
          event_ids: parsed.event_ids,
          document: {
            id: pending.id,
            source: pending.source,
            ragSourceKey: pending.ragSourceKey,
          },
        });
      }

      const parsed = JSON.parse(text) as { ingested?: number; source?: string };
      const syntheticEventId = createSyntheticIngestJob({
        ingested: typeof parsed.ingested === "number" ? parsed.ingested : 0,
        source: parsed.source || pending.ragSourceKey,
      });
      return NextResponse.json({
        event_ids: [syntheticEventId],
        document: {
          id: pending.id,
          source: pending.source,
          ragSourceKey: pending.ragSourceKey,
        },
      });
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON from chatbot service", detail: text.slice(0, 200) },
        { status: 502 },
      );
    }
  } catch (e) {
    return NextResponse.json(
      { error: "Cannot reach chatbot service", detail: String(e) },
      { status: 502 },
    );
  }
}

export const POST = withApiLogging(postIngest);
