import { NextResponse } from "next/server";
import { z } from "zod";
import { login, mapAuthError } from "@/lib/auth/authService";
import { parseJsonBody } from "@/lib/api/routeValidation";
import { requireRateLimitByIp } from "@/lib/rateLimit/requireRateLimit";
import { setSessionCookie } from "@repo/auth/lib/cookies";

const loginRequestSchema = z.object({
    email: z.string(),
    password: z.string(),
});

export async function POST(request: Request) {
    const limited = await requireRateLimitByIp(request, "auth:login", { limit: 5, windowSec: 900 });
    if (limited) return limited;
    const parsed = await parseJsonBody(request, loginRequestSchema);
    if (!parsed.ok) return parsed.response;

    try {
        const { token, user } = await login(parsed.data);

        await setSessionCookie(token);

        return NextResponse.json({ user }, { status: 200 });
    } catch (error) {
        const mapped = mapAuthError(error);
        return NextResponse.json({ error: mapped.message }, { status: mapped.status });
    }
}
