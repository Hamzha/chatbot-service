import { NextResponse } from "next/server";
import { z } from "zod";
import { parseJsonBody } from "@/lib/api/routeValidation";
import { withApiLogging } from "@/lib/api/withApiLogging";
import { requireApiPermission } from "@/lib/auth/requireApiPermission";
import {
    endTakeover,
    getEscalation,
    startTakeover,
} from "@/lib/db/escalationRepo";
import { appendWidgetMessage } from "@/lib/db/widgetMessageRepo";
import { findUserById } from "@/lib/db/userRepo";

const bodySchema = z.object({
    action: z.enum(["start", "end"]),
});

type RouteContext = { params: Promise<{ id: string }> };

async function postTakeover(request: Request, context: RouteContext) {
    const gate = await requireApiPermission("escalations:update");
    if (gate instanceof NextResponse) return gate;

    const parsed = await parseJsonBody(request, bodySchema);
    if (!parsed.ok) return parsed.response;

    const { id } = await context.params;
    const ticket = await getEscalation(id, gate.ctx.userId);
    if (!ticket) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (parsed.data.action === "start") {
        const result = await startTakeover(id, gate.ctx.userId, gate.ctx.userId);
        if (!result.ok) {
            if (result.reason === "not_found") {
                return NextResponse.json({ error: "Not found" }, { status: 404 });
            }
            return NextResponse.json(
                { error: "Cannot take over a resolved ticket" },
                { status: 409 },
            );
        }

        const agentName = (await findUserById(gate.ctx.userId))?.name?.trim() || "An agent";
        try {
            await appendWidgetMessage({
                botId: result.record.chatbotId,
                widgetSessionId: result.record.widgetSessionId,
                role: "system",
                content: `${agentName} joined the chat.`,
                agentUserId: gate.ctx.userId,
            });
        } catch (err) {
            console.error("[escalation:takeover] system message persist failed", err);
        }
        return NextResponse.json({ escalation: result.record });
    }

    const result = await endTakeover(id, gate.ctx.userId);
    if (!result.ok) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    try {
        await appendWidgetMessage({
            botId: result.record.chatbotId,
            widgetSessionId: result.record.widgetSessionId,
            role: "system",
            content: "The agent has left the chat. You can continue with the bot.",
        });
    } catch (err) {
        console.error("[escalation:takeover] system message persist failed", err);
    }
    return NextResponse.json({ escalation: result.record });
}

export const POST = withApiLogging(postTakeover);
