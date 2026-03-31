import { NextRequest, NextResponse } from "next/server";

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
    const body = await req.json();

    const res = await fetch(`${SCRAPER_API_URL}/api/v1/scrape`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json();

    // If scraping was successful, send to chatbot service asynchronously
    if (data.success && data.data) {
      const sourceId = body.url || "scraped_content";
      // Fire and forget - don't wait for the response
      sendToChatbotService(data.data, sourceId);
    }

    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: String(err) },
      { status: 502 }
    );
  }
}
