import { NextRequest, NextResponse } from "next/server";
import { requireUserIdWithPermission } from "@/lib/auth/requireApiPermission";

const SCRAPER_API_URL = process.env.SCRAPER_API_URL || "http://localhost:8000";
const CHATBOT_API_URL = process.env.CHATBOT_API_URL || "http://localhost:8000";

async function sendToChatbotService(
  scrapedData: any,
  sourceId: string
): Promise<void> {
  try {
    // Send the text content to the chatbot service for vector DB ingestion
    await fetch(`${CHATBOT_API_URL}/api/v1/ingest-text`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text_content: scrapedData.text_content || "",
        source_id: sourceId,
        title: scrapedData.title || sourceId,
        url: scrapedData.url || "",
      }),
    }).catch((err) => {
      // Log but don't fail the request if chatbot service is unavailable
      console.error("Failed to send to chatbot service:", err);
    });
  } catch (err) {
    console.error("Error sending to chatbot service:", err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const gate = await requireUserIdWithPermission("scraper:create");
    if (gate instanceof NextResponse) return gate;

    const body = await req.json();

    const res = await fetch(`${SCRAPER_API_URL}/api/v1/crawl`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json();

    // If crawling was successful, send all pages to chatbot service asynchronously
    if (data.success && data.data && Array.isArray(data.data)) {
      const baseUrl = body.url || "crawled_content";
      // Send each page to chatbot service
      data.data.forEach((page: any, index: number) => {
        const sourceId = `${baseUrl}#page-${index}`;
        sendToChatbotService(page, sourceId);
      });
    }

    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: String(err) },
      { status: 502 }
    );
  }
}
