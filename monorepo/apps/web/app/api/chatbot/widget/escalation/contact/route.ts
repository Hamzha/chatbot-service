import { NextResponse } from "next/server";
import { z } from "zod";
import { parseJsonBody } from "@/lib/api/routeValidation";
import { withApiLogging } from "@/lib/api/withApiLogging";
import { requireRateLimitByIp } from "@/lib/rateLimit/requireRateLimit";
import { getChatSessionById } from "@/lib/db/chatSessionRepo";
import {
    findOpenEscalationForSession,
    setContactForOpenSessionEscalation,
} from "@/lib/db/escalationRepo";
import { appendWidgetMessage } from "@/lib/db/widgetMessageRepo";
import { findUserById } from "@/lib/db/userRepo";
import { sendEscalationEmail } from "@/lib/email/escalationEmail";
import { AUTO_ESCALATION_THANKS_PROMPT } from "@/lib/chatbot/escalationConstants";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const contactSchema = z.object({
    botId: z.string().min(1),
    widgetSessionId: z.string().min(1).max(128),
    email: z.string().email().max(254),
    name: z.string().max(100).optional(),
});

async function postContact(request: Request) {
    const limited = await requireRateLimitByIp(request, "widget:escalation-contact", {
        limit: 6,
        windowSec: 900,
    });
    if (limited) return limited;

    const parsed = await parseJsonBody(request, contactSchema);
    if (!parsed.ok) return parsed.response;

    const { botId, widgetSessionId, email, name } = parsed.data;
    if (!EMAIL_REGEX.test(email)) {
        return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
    }

    const chatbot = await getChatSessionById(botId.trim());
    if (!chatbot) {
        return NextResponse.json({ error: "Invalid botId" }, { status: 404 });
    }

    const open = await findOpenEscalationForSession(widgetSessionId);
    if (!open) {
        return NextResponse.json({ error: "No open escalation for this session" }, { status: 404 });
    }
    if (open.chatbotId !== chatbot.id) {
        return NextResponse.json({ error: "Session mismatch" }, { status: 403 });
    }

    const wasEmpty = !open.contact.email;

    const updated = await setContactForOpenSessionEscalation(widgetSessionId, {
        email,
        name: typeof name === "string" ? name : undefined,
    });

    if (!updated.ok) {
        return NextResponse.json({ error: "Could not update contact" }, { status: 404 });
    }

    try {
        await appendWidgetMessage({
            botId: chatbot.id,
            widgetSessionId,
            role: "system",
            content: AUTO_ESCALATION_THANKS_PROMPT,
        });
    } catch (err) {
        console.error("[widget:escalation-contact] failed to append confirmation", err);
    }

    if (wasEmpty) {
        void (async () => {
            try {
                const owner = await findUserById(chatbot.userId);
                if (owner?.email) {
                    await sendEscalationEmail({ to: owner.email, record: updated.record });
                }
            } catch (err) {
                console.error("[widget:escalation-contact] email dispatch failed", err);
            }
        })();
    }

    return NextResponse.json({ ok: true, ticketId: updated.record.id });
}

export const POST = withApiLogging(postContact);
