import { NextRequest, NextResponse } from "next/server";
import { requireUserIdWithPermission } from "@/lib/auth/requireApiPermission";
import { registerScrapedDocument } from "@/lib/scraper/registerScrapedDocument";

const SCRAPER_API_URL = process.env.SCRAPER_API_URL || "http://localhost:8000";

export async function POST(req: NextRequest) {
    try {
        const gate = await requireUserIdWithPermission("scraper:create");
        if (gate instanceof NextResponse) return gate;
        const { userId } = gate;

        const body = await req.json();

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
            const pageUrl =
                (typeof body.url === "string" && body.url.trim()) ||
                row.url?.trim() ||
                "scraped_content";
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
    } catch (err) {
        return NextResponse.json({ success: false, error: String(err) }, { status: 502 });
    }
}
