import { NextResponse } from "next/server";
import { z } from "zod";
import { mapAuthError, requestPasswordReset } from "@/lib/auth/authService";
import { parseJsonBody } from "@/lib/api/routeValidation";
import { requireRateLimitByIp } from "@/lib/rateLimit/requireRateLimit";

const forgotPasswordRequestSchema = z.object({
    email: z.string(),
});

export async function POST(request: Request) {
    const limited = await requireRateLimitByIp(request, "auth:forgot-password", { limit: 3, windowSec: 900 });
    if (limited) return limited;
    const parsed = await parseJsonBody(request, forgotPasswordRequestSchema);
    if (!parsed.ok) return parsed.response;

    try {
        await requestPasswordReset({ email: parsed.data.email });

        // Always return the same response to avoid account enumeration.
        return NextResponse.json(
            { message: "If an account exists for that email, a reset link has been sent." },
            { status: 200 },
        );
    } catch (error) {
        const mapped = mapAuthError(error);
        return NextResponse.json({ error: mapped.message }, { status: mapped.status });
    }
}
