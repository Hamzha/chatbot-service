import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiPermission } from "@/lib/auth/requireApiPermission";
import { parseJsonBody } from "@/lib/api/routeValidation";
import { withApiLogging } from "@/lib/api/withApiLogging";
import { requireRateLimitByUser } from "@/lib/rateLimit/requireRateLimit";
import {
    deleteSubscriptionPlan,
    findSubscriptionPlanById,
    normalizePlanLimits,
    updateSubscriptionPlan,
} from "@/lib/db/subscriptionPlanRepo";

const limitValueSchema = z.union([z.number().int().nonnegative(), z.null()]);

const limitsSchema = z.object({
    scraperRuns: limitValueSchema,
    documentUploads: limitValueSchema,
    botsCreated: limitValueSchema,
    dashboardChats: limitValueSchema,
    widgetChats: limitValueSchema,
});

const patchSchema = z.object({
    name: z.string().trim().min(2).max(80).optional(),
    slug: z.string().trim().min(2).max(64).optional(),
    description: z.string().trim().max(500).optional(),
    amountCents: z.number().int().nonnegative().optional(),
    currency: z.string().trim().length(3).optional(),
    interval: z.enum(["month", "year"]).optional(),
    features: z.array(z.string().trim().min(1).max(120)).max(20).optional(),
    limits: limitsSchema.optional(),
    limitPeriod: z.enum(["lifetime", "calendar_month"]).optional(),
    active: z.boolean().optional(),
    sortOrder: z.number().int().optional(),
    highlighted: z.boolean().optional(),
});

type Ctx = { params: Promise<{ id: string }> };

async function getPlan(_request: Request, context: Ctx) {
    const gate = await requireApiPermission("plans:read");
    if (gate instanceof NextResponse) return gate;

    const { id } = await context.params;
    const plan = await findSubscriptionPlanById(id);
    if (!plan) return NextResponse.json({ error: "Plan not found." }, { status: 404 });
    return NextResponse.json({ plan });
}

async function patchPlan(request: Request, context: Ctx) {
    const gate = await requireApiPermission("plans:update");
    if (gate instanceof NextResponse) return gate;
    const limited = await requireRateLimitByUser(gate.ctx.userId, "admin:plans:update", {
        limit: 30,
        windowSec: 60,
    });
    if (limited) return limited;

    const { id } = await context.params;
    const parsed = await parseJsonBody(request, patchSchema);
    if (!parsed.ok) return parsed.response;

    try {
        const plan = await updateSubscriptionPlan(id, {
            ...parsed.data,
            limits: parsed.data.limits ? normalizePlanLimits(parsed.data.limits) : undefined,
            updatedBy: gate.ctx.userId,
        });
        if (!plan) return NextResponse.json({ error: "Plan not found." }, { status: 404 });
        return NextResponse.json({ plan });
    } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to update plan.";
        return NextResponse.json({ error: message }, { status: 400 });
    }
}

async function removePlan(_request: Request, context: Ctx) {
    const gate = await requireApiPermission("plans:update");
    if (gate instanceof NextResponse) return gate;

    const { id } = await context.params;
    const ok = await deleteSubscriptionPlan(id);
    if (!ok) return NextResponse.json({ error: "Plan not found." }, { status: 404 });
    return NextResponse.json({ ok: true });
}

export const GET = withApiLogging(getPlan);
export const PATCH = withApiLogging(patchPlan);
export const DELETE = withApiLogging(removePlan);
