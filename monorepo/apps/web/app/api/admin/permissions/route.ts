import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth/requireApiPermission";
import { internalServerError } from "@/lib/api/routeValidation";
import { withApiLogging } from "@/lib/api/withApiLogging";
import { requireRateLimitByUser } from "@/lib/rateLimit/requireRateLimit";
import { listPermissions } from "@/lib/db/permissionRepo";

async function getPermissions() {
    const gate = await requireApiPermission("roles:read");
    if (gate instanceof NextResponse) return gate;
    const limited = await requireRateLimitByUser(gate.ctx.userId, "admin:permissions:read", {
        limit: 60,
        windowSec: 60,
    });
    if (limited) return limited;

    try {
        const permissions = await listPermissions();
        return NextResponse.json({ permissions });
    } catch (error) {
        return internalServerError(error, "Failed to list permissions");
    }
}

export const GET = withApiLogging(getPermissions);
