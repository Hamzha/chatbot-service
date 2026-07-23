import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiPermission } from "@/lib/auth/requireApiPermission";
import { parseJsonBody } from "@/lib/api/routeValidation";
import { withApiLogging } from "@/lib/api/withApiLogging";
import { requireRateLimitByUser } from "@/lib/rateLimit/requireRateLimit";
import {
    FEATURE_LIMIT_KEYS,
    FEATURE_LIMIT_LABELS,
    getFeatureLimitDefaults,
    updateFeatureLimitDefaults,
    type FeatureLimitKey,
    type FeatureLimitValues,
} from "@/lib/db/featureLimitRepo";

const limitValueSchema = z.union([z.number().int().nonnegative(), z.null()]);

const patchDefaultsSchema = z.object({
    period: z.enum(["lifetime", "calendar_month"]),
    limits: z.object({
        scraperRuns: limitValueSchema,
        documentUploads: limitValueSchema,
        botsCreated: limitValueSchema,
        dashboardChats: limitValueSchema,
        widgetChats: limitValueSchema,
    }),
});

async function getLimits() {
    const gate = await requireApiPermission("limits:read");
    if (gate instanceof NextResponse) return gate;
    const limited = await requireRateLimitByUser(gate.ctx.userId, "admin:limits:read", {
        limit: 60,
        windowSec: 60,
    });
    if (limited) return limited;

    const defaults = await getFeatureLimitDefaults();
    return NextResponse.json({
        defaults,
        labels: FEATURE_LIMIT_LABELS,
        keys: [...FEATURE_LIMIT_KEYS],
    });
}

async function putLimits(request: Request) {
    const gate = await requireApiPermission("limits:update");
    if (gate instanceof NextResponse) return gate;
    const limited = await requireRateLimitByUser(gate.ctx.userId, "admin:limits:update", {
        limit: 30,
        windowSec: 60,
    });
    if (limited) return limited;

    const parsed = await parseJsonBody(request, patchDefaultsSchema);
    if (!parsed.ok) return parsed.response;

    const limits = parsed.data.limits as FeatureLimitValues;
    for (const key of FEATURE_LIMIT_KEYS) {
        if (!(key in limits)) {
            return NextResponse.json({ error: `Missing limit key: ${key}` }, { status: 400 });
        }
    }

    const defaults = await updateFeatureLimitDefaults({
        period: parsed.data.period,
        limits,
        updatedBy: gate.ctx.userId,
    });

    return NextResponse.json({
        defaults,
        labels: FEATURE_LIMIT_LABELS,
        keys: [...FEATURE_LIMIT_KEYS],
    });
}

export const GET = withApiLogging(getLimits);
export const PUT = withApiLogging(putLimits);
