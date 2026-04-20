import { NextResponse } from "next/server";
import { requireUserIdWithPermission } from "@/lib/auth/requireApiPermission";
import { getCrawlJob } from "@/lib/db/crawlJobRepo";

export async function GET(
    _req: Request,
    ctx: { params: Promise<{ jobId: string }> },
) {
    const gate = await requireUserIdWithPermission("scraper:create");
    if (gate instanceof NextResponse) return gate;
    const { userId } = gate;

    const { jobId } = await ctx.params;
    if (!jobId || typeof jobId !== "string") {
        return NextResponse.json({ error: "Missing jobId" }, { status: 400 });
    }

    const job = await getCrawlJob(userId, jobId);
    if (!job) {
        return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }
    return NextResponse.json({ job });
}
