import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUserIdWithPermission } from "@/lib/auth/requireApiPermission";
import { parseJsonBody, upstreamError } from "@/lib/api/routeValidation";
import { withApiLogging } from "@/lib/api/withApiLogging";
import { requireRateLimitByUser } from "@/lib/rateLimit/requireRateLimit";
import { registerScrapedDocument } from "@/lib/scraper/registerScrapedDocument";

const SCRAPER_API_URL = process.env.SCRAPER_API_URL || "http://localhost:8000";
const scrapeRequestSchema = z.object({
    url: z.string().trim().url("url must be a valid URL"),
    mode: z.string().optional(),
    max_pages: z.unknown().optional(),
    max_depth: z.unknown().optional(),
});

async function postScrape(req: NextRequest) {
    try {
        const gate = await requireUserIdWithPermission("scraper:create");
        if (gate instanceof NextResponse) return gate;
        const { userId } = gate;

        const limited = await requireRateLimitByUser(userId, "scraper:scrape", { limit: 20, windowSec: 60 });
        if (limited) return limited;

        const parsed = await parseJsonBody(req, scrapeRequestSchema);
        if (!parsed.ok) return parsed.response;
        const body = parsed.data;

        const res = await fetch(`${SCRAPER_API_URL}/api/v1/scrape`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });

        const data = (await res.json()) as {
            success?: boolean;
            data?: { text_content?: string; title?: string; url?: string };
        };

        let ingestion: { ingested: number; displaySource: string; ragSourceKey: string } | null =
            null;

        if (data.success && data.data) {
            const row = data.data;
            const pageUrl = body.url.trim() || row.url?.trim() || "scraped_content";
            ingestion = await registerScrapedDocument(userId, {
                url: pageUrl,
                title: row.title ?? undefined,
                textContent: row.text_content ?? "",
            });
        }

        return NextResponse.json(
            { ...data, ingestion: ingestion ?? undefined },
            { status: res.status },
        );
    } catch (error) {
        return upstreamError(error, "Cannot reach scraper service");
    }
}

export const POST = withApiLogging(postScrape);
