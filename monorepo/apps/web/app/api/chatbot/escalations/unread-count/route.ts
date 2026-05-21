import { NextResponse } from "next/server";
import { withApiLogging } from "@/lib/api/withApiLogging";
import { requireApiPermission } from "@/lib/auth/requireApiPermission";
import { countOpenEscalationsForOwner } from "@/lib/db/escalationRepo";

async function getUnreadCount() {
    const gate = await requireApiPermission("escalations:read");
    if (gate instanceof NextResponse) return gate;
    const count = await countOpenEscalationsForOwner(gate.ctx.userId);
    return NextResponse.json({ count });
}

export const GET = withApiLogging(getUnreadCount);
