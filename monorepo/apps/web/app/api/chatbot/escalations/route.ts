import { NextResponse } from "next/server";
import { withApiLogging } from "@/lib/api/withApiLogging";
import { requireApiPermission } from "@/lib/auth/requireApiPermission";
import {
    listEscalationsForOwner,
    type EscalationStatus,
} from "@/lib/db/escalationRepo";

function parseStatus(raw: string | null): EscalationStatus | "all" | undefined {
    if (!raw) return undefined;
    if (raw === "all" || raw === "open" || raw === "in_progress" || raw === "resolved") {
        return raw;
    }
    return undefined;
}

async function getEscalations(request: Request) {
    const gate = await requireApiPermission("escalations:read");
    if (gate instanceof NextResponse) return gate;

    const url = new URL(request.url);
    const status = parseStatus(url.searchParams.get("status"));
    const limitRaw = url.searchParams.get("limit");
    const cursor = url.searchParams.get("cursor");
    const limit = limitRaw ? Math.min(Math.max(parseInt(limitRaw, 10) || 25, 1), 100) : 25;

    const result = await listEscalationsForOwner(gate.ctx.userId, {
        status,
        limit,
        cursor,
    });

    return NextResponse.json(result);
}

export const GET = withApiLogging(getEscalations);
