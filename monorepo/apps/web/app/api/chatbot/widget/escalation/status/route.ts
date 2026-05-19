import { NextResponse } from "next/server";
import { withApiLogging } from "@/lib/api/withApiLogging";
import { getChatSessionById } from "@/lib/db/chatSessionRepo";
import { findOpenEscalationForSession } from "@/lib/db/escalationRepo";

async function getStatus(request: Request) {
    const url = new URL(request.url);
    const botId = url.searchParams.get("botId")?.trim() ?? "";
    const widgetSessionId = url.searchParams.get("widgetSessionId")?.trim() ?? "";

    if (!botId) {
        return NextResponse.json({ error: "Missing botId" }, { status: 400 });
    }
    if (!widgetSessionId || widgetSessionId.length > 128) {
        return NextResponse.json({ error: "Missing or invalid widgetSessionId" }, { status: 400 });
    }
    const chatbot = await getChatSessionById(botId);
    if (!chatbot) {
        return NextResponse.json({ error: "Invalid botId" }, { status: 404 });
    }

    const open = await findOpenEscalationForSession(widgetSessionId);
    if (!open || open.chatbotId !== chatbot.id) {
        return NextResponse.json({
            hasOpenEscalation: false,
            hasEmail: false,
            reason: null,
        });
    }

    return NextResponse.json({
        hasOpenEscalation: true,
        hasEmail: Boolean(open.contact.email),
        reason: open.reason,
    });
}

export const GET = withApiLogging(getStatus);
