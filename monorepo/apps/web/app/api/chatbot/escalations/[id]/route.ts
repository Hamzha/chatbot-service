import { NextResponse } from "next/server";
import { z } from "zod";
import { withApiLogging } from "@/lib/api/withApiLogging";
import { requireApiPermission } from "@/lib/auth/requireApiPermission";
import { parseJsonBody } from "@/lib/api/routeValidation";
import {
    getEscalation,
    updateEscalation,
    type EscalationStatus,
} from "@/lib/db/escalationRepo";

const patchSchema = z.object({
    status: z.enum(["open", "in_progress", "resolved"]).optional(),
    notes: z.string().max(4000).optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

async function getOne(request: Request, context: RouteContext) {
    const gate = await requireApiPermission("escalations:read");
    if (gate instanceof NextResponse) return gate;

    const { id } = await context.params;
    const record = await getEscalation(id, gate.ctx.userId);
    if (!record) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ escalation: record });
}

async function patchOne(request: Request, context: RouteContext) {
    const gate = await requireApiPermission("escalations:update");
    if (gate instanceof NextResponse) return gate;

    const parsed = await parseJsonBody(request, patchSchema);
    if (!parsed.ok) return parsed.response;

    const { id } = await context.params;
    const result = await updateEscalation(id, gate.ctx.userId, {
        status: parsed.data.status as EscalationStatus | undefined,
        notes: parsed.data.notes,
    });

    if (!result.ok) {
        if (result.reason === "not_found") {
            return NextResponse.json({ error: "Not found" }, { status: 404 });
        }
        return NextResponse.json(
            { error: "Invalid status transition" },
            { status: 409 },
        );
    }

    return NextResponse.json({ escalation: result.record });
}

export const GET = withApiLogging(getOne);
export const PATCH = withApiLogging(patchOne);
