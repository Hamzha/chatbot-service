import { NextResponse } from "next/server";
import { z } from "zod";
import { GOOGLE_SIGN_IN_MESSAGE, mapAuthError, requestPasswordReset } from "@/lib/auth/authService";
import { parseJsonBody } from "@/lib/api/routeValidation";
import { withApiLogging } from "@/lib/api/withApiLogging";
import { requireRateLimitByIp } from "@/lib/rateLimit/requireRateLimit";

const forgotPasswordRequestSchema = z.object({
    email: z.string(),
});

async function postForgotPassword(request: Request) {
    const limited = await requireRateLimitByIp(request, "auth:forgot-password", { limit: 3, windowSec: 900 });
    if (limited) return limited;
    const parsed = await parseJsonBody(request, forgotPasswordRequestSchema);
    if (!parsed.ok) return parsed.response;

    try {
        const result = await requestPasswordReset({ email: parsed.data.email });

        if (result.kind === "google_only") {
            return NextResponse.json(
                {
                    code: "GOOGLE_ACCOUNT",
                    message: GOOGLE_SIGN_IN_MESSAGE,
                },
                { status: 200 },
            );
        }

        // Always return the same response for unknown / password accounts to avoid enumeration.
        return NextResponse.json(
            { message: "If an account exists for that email, a reset link has been sent." },
            { status: 200 },
        );
    } catch (error) {
        const mapped = mapAuthError(error);
        return NextResponse.json({ error: mapped.message }, { status: mapped.status });
    }
}

export const POST = withApiLogging(postForgotPassword);
