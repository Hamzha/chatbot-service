import { NextResponse } from "next/server";
import { z } from "zod";
import { mapAuthError, resetPassword } from "@/lib/auth/authService";
import { parseJsonBody } from "@/lib/api/routeValidation";
import { withApiLogging } from "@/lib/api/withApiLogging";
import { requireRateLimitByIp } from "@/lib/rateLimit/requireRateLimit";

const resetPasswordRequestSchema = z.object({
    token: z.string(),
    password: z.string(),
});

async function postResetPassword(request: Request) {
    const limited = await requireRateLimitByIp(request, "auth:reset-password", { limit: 5, windowSec: 900 });
    if (limited) return limited;
    const parsed = await parseJsonBody(request, resetPasswordRequestSchema);
    if (!parsed.ok) return parsed.response;

    try {
        await resetPassword(parsed.data);

        return NextResponse.json({ message: "Password reset successful. You can now log in." }, { status: 200 });
    } catch (error) {
        const mapped = mapAuthError(error);
        return NextResponse.json({ error: mapped.message }, { status: mapped.status });
    }
}

export const POST = withApiLogging(postResetPassword);
