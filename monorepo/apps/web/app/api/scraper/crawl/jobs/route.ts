import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUserIdWithPermission } from "@/lib/auth/requireApiPermission";
import { parseJsonBody, validationError } from "@/lib/api/routeValidation";
import { withApiLogging } from "@/lib/api/withApiLogging";
import { requireRateLimitByUser } from "@/lib/rateLimit/requireRateLimit";
import { createCrawlJob, listCrawlJobsForUser } from "@/lib/db/crawlJobRepo";
import { runCrawlJob } from "@/lib/scraper/crawlJobWorker";

const ALLOWED_MODES = new Set(["auto", "static", "dynamic"]);
const DEFAULT_MAX_PAGES = 10;
const DEFAULT_MAX_DEPTH = 2;
const createCrawlJobSchema = z.object({
    url: z.string().trim().min(1, "`url` is required"),
    mode: z.string().optional(),
    max_pages: z.unknown().optional(),
    max_depth: z.unknown().optional(),
});

async function getCrawlJobs() {
    const gate = await requireUserIdWithPermission("scraper:create");
    if (gate instanceof NextResponse) return gate;
    const { userId } = gate;
    const limited = await requireRateLimitByUser(userId, "scraper:crawl:list", { limit: 30, windowSec: 60 });
    if (limited) return limited;

    const jobs = await listCrawlJobsForUser(userId, 20);
    return NextResponse.json({ jobs });
}

async function postCrawlJob(req: NextRequest) {
    const gate = await requireUserIdWithPermission("scraper:create");
    if (gate instanceof NextResponse) return gate;
    const { userId } = gate;

    const limited = await requireRateLimitByUser(userId, "scraper:crawl", { limit: 5, windowSec: 60 });
    if (limited) return limited;

    const parsed = await parseJsonBody(req, createCrawlJobSchema);
    if (!parsed.ok) return parsed.response;
    const input = parsed.data;

    const rawUrl = input.url.trim();
    try {
        const parsed = new URL(rawUrl);
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
            return validationError("`url` must be http:// or https://");
        }
    } catch {
        return validationError("`url` is not a valid URL");
    }

    const mode =
        typeof input.mode === "string" && ALLOWED_MODES.has(input.mode)
            ? (input.mode as string)
            : "auto";

    const maxPages = normalizeBoundedInt(input.max_pages, DEFAULT_MAX_PAGES, 1, 200);
    const maxDepth = normalizeBoundedInt(input.max_depth, DEFAULT_MAX_DEPTH, 1, 10);

    const job = await createCrawlJob(userId, {
        startUrl: rawUrl,
        mode,
        maxPages,
        maxDepth,
    });

    // Fire-and-forget: the worker persists all progress to Mongo. The UI polls GET /:jobId.
    void runCrawlJob({
        jobId: job.id,
        userId,
        startUrl: job.startUrl,
        mode: job.mode,
        maxPages: job.maxPages,
        maxDepth: job.maxDepth,
    });

    return NextResponse.json({ job }, { status: 202 });
}

export function normalizeBoundedInt(
    raw: unknown,
    fallback: number,
    min: number,
    max: number,
): number {
    const n = typeof raw === "number" ? raw : Number(raw);
    if (!Number.isFinite(n)) return fallback;
    const rounded = Math.floor(n);
    if (rounded < min) return min;
    if (rounded > max) return max;
    return rounded;
}

export const GET = withApiLogging(getCrawlJobs);
export const POST = withApiLogging(postCrawlJob);
