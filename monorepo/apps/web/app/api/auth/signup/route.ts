import { NextResponse } from "next/server";
import { mapAuthError, signup } from "@/lib/auth/authService";
import { requireRateLimitByIp } from "@/lib/rateLimit/requireRateLimit";
import type { SignupInput } from "@repo/auth/types";

export async function POST(request: Request) {
    const limited = await requireRateLimitByIp(request, "auth:signup", { limit: 5, windowSec: 3600 });
    if (limited) return limited;

    try {
        const body = (await request.json()) as SignupInput;
        const { user } = await signup(body);

        return NextResponse.json({ user }, { status: 201 });
    } catch (error) {
        const mapped = mapAuthError(error);
        return NextResponse.json({ error: mapped.message }, { status: mapped.status });
    }
}
