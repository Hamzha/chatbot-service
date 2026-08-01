import { NextResponse } from "next/server";
import { withApiLogging } from "@/lib/api/withApiLogging";
import { requireRateLimitByIp } from "@/lib/rateLimit/requireRateLimit";
import { validateEscalationRequest } from "@/lib/chatbot/validateEscalationRequest";
import {
    createEscalation,
    findOpenEscalationForSession,
} from "@/lib/db/escalationRepo";
import { findUserById } from "@/lib/db/userRepo";
import { sendEscalationEmail } from "@/lib/email/escalationEmail";

async function postEscalation(request: Request) {
    const limited = await requireRateLimitByIp(request, "widget:escalation", { limit: 3, windowSec: 900 });
    if (limited) return limited;

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const result = await validateEscalationRequest(body);
    if (!result.valid) {
        return NextResponse.json({ error: result.error }, { status: result.status });
    }

    const existing = await findOpenEscalationForSession(result.widgetSessionId);
    if (existing) {
        return NextResponse.json({
            ticketId: existing.id,
            status: existing.status,
            duplicate: true,
        });
    }

    const record = await createEscalation({
        botOwnerId: result.chatbot.userId,
        chatbotId: result.chatbot.id,
        widgetSessionId: result.widgetSessionId,
        contact: result.contact,
        reason: result.reason,
        message: result.message,
        transcriptSnapshot: result.transcript,
    });

    void (async () => {
        try {
            const owner = await findUserById(result.chatbot.userId);
            if (owner?.email) {
                await sendEscalationEmail({ to: owner.email, record });
            }
        } catch (err) {
            console.error("[widget:escalation] notification dispatch failed", err);
        }
    })();

    return NextResponse.json({
        ticketId: record.id,
        status: record.status,
        duplicate: false,
    });
}

export const POST = withApiLogging(postEscalation);
