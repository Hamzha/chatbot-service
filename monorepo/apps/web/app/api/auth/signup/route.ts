import { NextResponse } from "next/server";
import { z } from "zod";
import { mapAuthError, signup } from "@/lib/auth/authService";
import { parseJsonBody } from "@/lib/api/routeValidation";
import { withApiLogging } from "@/lib/api/withApiLogging";
import { requireRateLimitByIp } from "@/lib/rateLimit/requireRateLimit";

const signupRequestSchema = z.object({
    name: z.string(),
    email: z.string(),
    password: z.string(),
});

async function postSignup(request: Request) {
    const limited = await requireRateLimitByIp(request, "auth:signup", { limit: 5, windowSec: 3600 });
    if (limited) return limited;
    const parsed = await parseJsonBody(request, signupRequestSchema);
    if (!parsed.ok) return parsed.response;

    try {
        const { user } = await signup(parsed.data);

        return NextResponse.json({ user }, { status: 201 });
    } catch (error) {
        const mapped = mapAuthError(error);
        return NextResponse.json({ error: mapped.message }, { status: mapped.status });
    }
}

export const POST = withApiLogging(postSignup);
