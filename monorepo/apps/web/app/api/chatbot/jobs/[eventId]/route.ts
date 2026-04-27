import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth/requireApiPermission";
import { upstreamError, validationError } from "@/lib/api/routeValidation";
import { withApiLogging } from "@/lib/api/withApiLogging";
import { getChatbotApiBaseUrl } from "@/lib/chatbot/getChatbotApiBaseUrl";
import { proxyChatbotResponse } from "@/lib/chatbot/proxyUpstream";
import { getSyntheticQueryJob, isSyntheticQueryJobId } from "@/lib/chatbot/syntheticQueryJobs";
import { getSyntheticIngestJob, isSyntheticIngestJobId } from "@/lib/chatbot/syntheticIngestJobs";
import { requireRateLimitByUser } from "@/lib/rateLimit/requireRateLimit";

async function getJobStatus(
  _request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const gate = await requireApiPermission("chatbot_jobs:read");
  if (gate instanceof NextResponse) return gate;
  const limited = await requireRateLimitByUser(gate.ctx.userId, "chatbot:jobs:read", {
    limit: 60,
    windowSec: 60,
  });
  if (limited) return limited;

  const { eventId } = await params;
  if (!eventId || !eventId.trim()) {
    return validationError("Missing eventId");
  }
  const normalizedEventId = eventId.trim();

  if (isSyntheticQueryJobId(normalizedEventId)) {
    const job = getSyntheticQueryJob(normalizedEventId);
    if (!job) {
      return NextResponse.json({ error: "Job not found or expired" }, { status: 404 });
    }
    return NextResponse.json({
      status: "Success",
      output: {
        answer: job.answer,
        sources: job.sources,
      },
    });
  }

  if (isSyntheticIngestJobId(normalizedEventId)) {
    const job = getSyntheticIngestJob(normalizedEventId);
    if (!job) {
      return NextResponse.json({ error: "Job not found or expired" }, { status: 404 });
    }
    return NextResponse.json({
      status: "Success",
      output: {
        ingested: job.ingested,
        source: job.source,
      },
    });
  }

  try {
    const res = await fetch(`${getChatbotApiBaseUrl()}/v1/jobs/${normalizedEventId}`, { method: "GET" });
    const text = await res.text();
    return proxyChatbotResponse(res, text);
  } catch (error) {
    return upstreamError(error, "Cannot reach chatbot service");
  }
}

export const GET = withApiLogging(getJobStatus);

