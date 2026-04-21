import { NextRequest, NextResponse } from "next/server";
import { requireUserIdWithPermission } from "@/lib/auth/requireApiPermission";
import { requireRateLimitByUser } from "@/lib/rateLimit/requireRateLimit";
import { createCrawlJob, listCrawlJobsForUser } from "@/lib/db/crawlJobRepo";
import { runCrawlJob } from "@/lib/scraper/crawlJobWorker";

const ALLOWED_MODES = new Set(["auto", "static", "dynamic"]);
const DEFAULT_MAX_PAGES = 10;
const DEFAULT_MAX_DEPTH = 2;

export async function GET() {
    const gate = await requireUserIdWithPermission("scraper:create");
    if (gate instanceof NextResponse) return gate;
    const { userId } = gate;

    const jobs = await listCrawlJobsForUser(userId, 20);
    return NextResponse.json({ jobs });
}

export async function POST(req: NextRequest) {
    const gate = await requireUserIdWithPermission("scraper:create");
    if (gate instanceof NextResponse) return gate;
    const { userId } = gate;

    const limited = await requireRateLimitByUser(userId, "scraper:crawl", { limit: 5, windowSec: 60 });
    if (limited) return limited;

    let body: unknown;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const input = body as {
        url?: unknown;
        mode?: unknown;
        max_pages?: unknown;
        max_depth?: unknown;
    };

    const rawUrl = typeof input.url === "string" ? input.url.trim() : "";
    if (!rawUrl) {
        return NextResponse.json({ error: "`url` is required" }, { status: 400 });
    }
    try {
        const parsed = new URL(rawUrl);
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
            return NextResponse.json(
                { error: "`url` must be http:// or https://" },
                { status: 400 },
            );
        }
    } catch {
        return NextResponse.json({ error: "`url` is not a valid URL" }, { status: 400 });
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
