import { NextResponse } from "next/server";
import { requireUserIdWithPermission } from "@/lib/auth/requireApiPermission";
import { notFoundError, validationError } from "@/lib/api/routeValidation";
import { requireRateLimitByUser } from "@/lib/rateLimit/requireRateLimit";
import { getCrawlJob } from "@/lib/db/crawlJobRepo";

export async function GET(
    _req: Request,
    ctx: { params: Promise<{ jobId: string }> },
) {
    const gate = await requireUserIdWithPermission("scraper:create");
    if (gate instanceof NextResponse) return gate;
    const { userId } = gate;
    const limited = await requireRateLimitByUser(userId, "scraper:crawl:job:read", {
        limit: 60,
        windowSec: 60,
    });
    if (limited) return limited;

    const { jobId } = await ctx.params;
    if (!jobId || typeof jobId !== "string") {
        return validationError("Missing jobId");
    }

    const job = await getCrawlJob(userId, jobId);
    if (!job) {
        return notFoundError("Job not found");
    }
    return NextResponse.json({ job });
}
