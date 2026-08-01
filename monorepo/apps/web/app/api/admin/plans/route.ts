import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiPermission } from "@/lib/auth/requireApiPermission";
import { parseJsonBody } from "@/lib/api/routeValidation";
import { withApiLogging } from "@/lib/api/withApiLogging";
import { requireRateLimitByUser } from "@/lib/rateLimit/requireRateLimit";
import {
    FEATURE_LIMIT_KEYS,
    FEATURE_LIMIT_LABELS,
} from "@/lib/limits/featureLimitTypes";
import {
    createSubscriptionPlan,
    listSubscriptionPlans,
    normalizePlanLimits,
} from "@/lib/db/subscriptionPlanRepo";

const limitValueSchema = z.union([z.number().int().nonnegative(), z.null()]);

const limitsSchema = z.object({
    scraperRuns: limitValueSchema,
    documentUploads: limitValueSchema,
    botsCreated: limitValueSchema,
    dashboardChats: limitValueSchema,
    widgetChats: limitValueSchema,
});

const createSchema = z.object({
    name: z.string().trim().min(2).max(80),
    slug: z.string().trim().min(2).max(64).optional(),
    description: z.string().trim().max(500).optional(),
    amountCents: z.number().int().nonnegative(),
    currency: z.string().trim().length(3).optional(),
    interval: z.enum(["month", "year"]).optional(),
    features: z.array(z.string().trim().min(1).max(120)).max(20).optional(),
    limits: limitsSchema,
    limitPeriod: z.enum(["lifetime", "calendar_month"]).optional(),
    active: z.boolean().optional(),
    sortOrder: z.number().int().optional(),
    highlighted: z.boolean().optional(),
});

async function getPlans() {
    const gate = await requireApiPermission("plans:read");
    if (gate instanceof NextResponse) return gate;
    const limited = await requireRateLimitByUser(gate.ctx.userId, "admin:plans:read", {
        limit: 60,
        windowSec: 60,
    });
    if (limited) return limited;

    const plans = await listSubscriptionPlans();
    return NextResponse.json({
        plans,
        labels: FEATURE_LIMIT_LABELS,
        keys: [...FEATURE_LIMIT_KEYS],
    });
}

async function postPlan(request: Request) {
    const gate = await requireApiPermission("plans:update");
    if (gate instanceof NextResponse) return gate;
    const limited = await requireRateLimitByUser(gate.ctx.userId, "admin:plans:create", {
        limit: 30,
        windowSec: 60,
    });
    if (limited) return limited;

    const parsed = await parseJsonBody(request, createSchema);
    if (!parsed.ok) return parsed.response;

    try {
        const plan = await createSubscriptionPlan({
            ...parsed.data,
            limits: normalizePlanLimits(parsed.data.limits),
            updatedBy: gate.ctx.userId,
        });
        return NextResponse.json({ plan }, { status: 201 });
    } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to create plan.";
        return NextResponse.json({ error: message }, { status: 400 });
    }
}

export const GET = withApiLogging(getPlans);
export const POST = withApiLogging(postPlan);
