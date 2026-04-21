import { NextResponse } from "next/server";
import { mapAuthError, resetPassword } from "@/lib/auth/authService";
import { requireRateLimitByIp } from "@/lib/rateLimit/requireRateLimit";

export async function POST(request: Request) {
    const limited = await requireRateLimitByIp(request, "auth:reset-password", { limit: 5, windowSec: 900 });
    if (limited) return limited;

    try {
        const body = (await request.json()) as { token: string; password: string };
        await resetPassword({ token: body.token, password: body.password });

        return NextResponse.json({ message: "Password reset successful. You can now log in." }, { status: 200 });
    } catch (error) {
        const mapped = mapAuthError(error);
        return NextResponse.json({ error: mapped.message }, { status: mapped.status });
    }
}
