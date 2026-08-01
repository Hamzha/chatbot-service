import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth/requireApiPermission";
import { withApiLogging } from "@/lib/api/withApiLogging";
import { requireRateLimitByUser } from "@/lib/rateLimit/requireRateLimit";
import { syncSubscriptionPlanToStripe } from "@/lib/billing/syncPlanToStripe";

type Ctx = { params: Promise<{ id: string }> };

async function syncPlan(_request: Request, context: Ctx) {
    const gate = await requireApiPermission("plans:update");
    if (gate instanceof NextResponse) return gate;
    const limited = await requireRateLimitByUser(gate.ctx.userId, "admin:plans:sync", {
        limit: 20,
        windowSec: 60,
    });
    if (limited) return limited;

    const { id } = await context.params;
    try {
        const plan = await syncSubscriptionPlanToStripe(id);
        return NextResponse.json({ plan });
    } catch (err) {
        const message = err instanceof Error ? err.message : "Sync failed.";
        return NextResponse.json({ error: message }, { status: 400 });
    }
}

export const POST = withApiLogging(syncPlan);
