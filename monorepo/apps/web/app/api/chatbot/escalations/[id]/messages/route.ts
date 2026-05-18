import { NextResponse } from "next/server";
import { z } from "zod";
import { parseJsonBody } from "@/lib/api/routeValidation";
import { withApiLogging } from "@/lib/api/withApiLogging";
import { requireApiPermission } from "@/lib/auth/requireApiPermission";
import { getEscalation } from "@/lib/db/escalationRepo";
import {
    appendWidgetMessage,
    listWidgetMessagesForSession,
} from "@/lib/db/widgetMessageRepo";

const postSchema = z.object({
    content: z.string().min(1).max(8000),
});

type RouteContext = { params: Promise<{ id: string }> };

async function getMessages(request: Request, context: RouteContext) {
    const gate = await requireApiPermission("escalations:read");
    if (gate instanceof NextResponse) return gate;

    const { id } = await context.params;
    const ticket = await getEscalation(id, gate.ctx.userId);
    if (!ticket) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const url = new URL(request.url);
    const limitRaw = url.searchParams.get("limit");
    const limit = limitRaw ? Math.min(Math.max(parseInt(limitRaw, 10) || 80, 1), 200) : 80;

    const messages = await listWidgetMessagesForSession(ticket.widgetSessionId, limit);
    return NextResponse.json({ messages, escalation: ticket });
}

async function postMessage(request: Request, context: RouteContext) {
    const gate = await requireApiPermission("escalations:update");
    if (gate instanceof NextResponse) return gate;

    const parsed = await parseJsonBody(request, postSchema);
    if (!parsed.ok) return parsed.response;

    const { id } = await context.params;
    const ticket = await getEscalation(id, gate.ctx.userId);
    if (!ticket) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (!ticket.liveTakeover.active) {
        return NextResponse.json(
            { error: "Start takeover before sending messages" },
            { status: 409 },
        );
    }

    const message = await appendWidgetMessage({
        botId: ticket.chatbotId,
        widgetSessionId: ticket.widgetSessionId,
        role: "agent",
        content: parsed.data.content,
        agentUserId: gate.ctx.userId,
    });

    return NextResponse.json({ message });
}

export const GET = withApiLogging(getMessages);
export const POST = withApiLogging(postMessage);
