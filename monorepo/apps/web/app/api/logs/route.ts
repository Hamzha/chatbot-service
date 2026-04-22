import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiPermission } from "@/lib/auth/requireApiPermission";
import { validationError } from "@/lib/api/routeValidation";
import { withApiLogging } from "@/lib/api/withApiLogging";
import { listApiRequestLogs } from "@/lib/db/apiRequestLogRepo";
import { requireRateLimitByUser } from "@/lib/rateLimit/requireRateLimit";

const logsQuerySchema = z.object({
    method: z.string().optional(),
    route: z.string().optional(),
    status: z.coerce.number().int().min(100).max(599).optional(),
    success: z
        .enum(["true", "false"])
        .transform((v) => v === "true")
        .optional(),
    userId: z.string().optional(),
    userEmail: z.string().email().optional(),
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
    limit: z.coerce.number().int().min(1).max(500).optional(),
    offset: z.coerce.number().int().min(0).optional(),
});

async function getLogs(request: Request) {
    const gate = await requireApiPermission("users:read");
    if (gate instanceof NextResponse) return gate;
    const limited = await requireRateLimitByUser(gate.ctx.userId, "admin:logs:read", {
        limit: 30,
        windowSec: 60,
    });
    if (limited) return limited;

    const raw = Object.fromEntries(new URL(request.url).searchParams.entries());
    const parsed = logsQuerySchema.safeParse(raw);
    if (!parsed.success) {
        return validationError(parsed.error.issues[0]?.message ?? "Invalid query params");
    }
    const data = parsed.data;
    const result = await listApiRequestLogs(data);
    return NextResponse.json(result);
}

export const GET = withApiLogging(getLogs);
