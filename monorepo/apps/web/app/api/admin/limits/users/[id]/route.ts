import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { requireApiPermission } from "@/lib/auth/requireApiPermission";
import { notFoundError, parseJsonBody, validationError } from "@/lib/api/routeValidation";
import { withApiLogging } from "@/lib/api/withApiLogging";
import { requireRateLimitByUser } from "@/lib/rateLimit/requireRateLimit";
import { findUserById } from "@/lib/db/userRepo";
import {
    clearUserFeatureLimitOverride,
    getUserFeatureLimitOverride,
    resolveEffectiveFeatureLimits,
    upsertUserFeatureLimitOverride,
} from "@/lib/db/featureLimitRepo";
import { getAllQuotaSnapshots } from "@/lib/limits/requireFeatureQuota";

const limitValueSchema = z.union([z.number().int().nonnegative(), z.null()]);

const patchOverrideSchema = z.object({
    clear: z.boolean().optional(),
    limits: z
        .object({
            scraperRuns: limitValueSchema.optional(),
            documentUploads: limitValueSchema.optional(),
            botsCreated: limitValueSchema.optional(),
            dashboardChats: limitValueSchema.optional(),
            widgetChats: limitValueSchema.optional(),
        })
        .optional(),
});

async function getUserLimits(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    const gate = await requireApiPermission("limits:read");
    if (gate instanceof NextResponse) return gate;
    const limited = await requireRateLimitByUser(gate.ctx.userId, "admin:user-limits:read", {
        limit: 60,
        windowSec: 60,
    });
    if (limited) return limited;

    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) return validationError("Invalid user id");
    const user = await findUserById(id);
    if (!user) return notFoundError();

    const effective = await resolveEffectiveFeatureLimits(id);
    const usage = await getAllQuotaSnapshots(id);
    return NextResponse.json({
        userId: id,
        override: effective.override,
        effective: { period: effective.period, limits: effective.limits },
        usage,
    });
}

async function putUserLimits(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const gate = await requireApiPermission("limits:update");
    if (gate instanceof NextResponse) return gate;
    const limited = await requireRateLimitByUser(gate.ctx.userId, "admin:user-limits:update", {
        limit: 30,
        windowSec: 60,
    });
    if (limited) return limited;

    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) return validationError("Invalid user id");
    const user = await findUserById(id);
    if (!user) return notFoundError();

    const parsed = await parseJsonBody(request, patchOverrideSchema);
    if (!parsed.ok) return parsed.response;

    if (parsed.data.clear) {
        await clearUserFeatureLimitOverride(id);
    } else if (parsed.data.limits) {
        await upsertUserFeatureLimitOverride({
            userId: id,
            limits: parsed.data.limits,
            updatedBy: gate.ctx.userId,
        });
    } else {
        return validationError("Provide limits or clear: true");
    }

    const effective = await resolveEffectiveFeatureLimits(id);
    const usage = await getAllQuotaSnapshots(id);
    return NextResponse.json({
        userId: id,
        override: effective.override,
        effective: { period: effective.period, limits: effective.limits },
        usage,
    });
}

export const GET = withApiLogging(getUserLimits);
export const PUT = withApiLogging(putUserLimits);
