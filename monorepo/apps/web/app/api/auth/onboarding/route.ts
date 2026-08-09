import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthenticatedUserId } from "@/lib/auth/requireApiPermission";
import { parseJsonBody } from "@/lib/api/routeValidation";
import { withApiLogging } from "@/lib/api/withApiLogging";
import { requireRateLimitByUser } from "@/lib/rateLimit/requireRateLimit";
import { completeUserOnboarding, toSafeUser } from "@/lib/db/userRepo";

const bodySchema = z.object({
    useCase: z.enum(["support", "sales", "faq", "other"]).nullable().optional(),
    websiteUrl: z
        .union([z.string().trim().url("websiteUrl must be a valid URL"), z.literal(""), z.null()])
        .optional()
        .transform((v) => (v === "" || v === undefined ? null : v)),
    skipped: z.boolean().optional(),
});

async function patchOnboarding(request: Request) {
    const auth = await requireAuthenticatedUserId();
    if (auth instanceof NextResponse) return auth;

    const limited = await requireRateLimitByUser(auth.userId, "auth:onboarding", {
        limit: 20,
        windowSec: 60,
    });
    if (limited) return limited;

    const parsed = await parseJsonBody(request, bodySchema);
    if (!parsed.ok) return parsed.response;

    const updated = await completeUserOnboarding(auth.userId, {
        useCase: parsed.data.useCase ?? null,
        websiteUrl: parsed.data.websiteUrl ?? null,
    });

    if (!updated) {
        return NextResponse.json({ error: "Unable to update onboarding." }, { status: 400 });
    }

    return NextResponse.json({
        user: toSafeUser(updated),
        skipped: Boolean(parsed.data.skipped),
    });
}

export const PATCH = withApiLogging(patchOnboarding);
