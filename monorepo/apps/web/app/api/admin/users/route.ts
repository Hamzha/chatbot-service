import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth/requireApiPermission";
import { requireRateLimitByUser } from "@/lib/rateLimit/requireRateLimit";
import { listUsersForAdmin } from "@/lib/db/userRepo";

export async function GET() {
    const gate = await requireApiPermission("users:read");
    if (gate instanceof NextResponse) return gate;
    const limited = await requireRateLimitByUser(gate.ctx.userId, "admin:users:read", {
        limit: 60,
        windowSec: 60,
    });
    if (limited) return limited;

    const users = await listUsersForAdmin();
    return NextResponse.json({ users });
}
