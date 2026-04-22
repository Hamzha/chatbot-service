import { NextRequest, NextResponse } from "next/server";
import { verifyEmailToken } from "@repo/auth/lib/tokens";
import { withApiLogging } from "@/lib/api/withApiLogging";
import { requireRateLimitByIp } from "@/lib/rateLimit/requireRateLimit";
import { verifyUserEmail } from "@/lib/db/userRepo";

async function getVerifyEmail(request: NextRequest) {
    const limited = await requireRateLimitByIp(request, "auth:verify-email", { limit: 10, windowSec: 900 });
    if (limited) return limited;

    try {
        const searchParams = request.nextUrl.searchParams;
        const token = searchParams.get("token");

        if (!token) {
            return NextResponse.json({ error: "Missing verification token" }, { status: 400 });
        }

        const payload = await verifyEmailToken(token);

        if (!payload || payload.type !== "email_verification") {
            return NextResponse.json({ error: "Invalid or expired token" }, { status: 400 });
        }

        if (!payload.userId) {
            return NextResponse.json({ error: "Invalid token payload" }, { status: 400 });
        }

        const user = await verifyUserEmail(payload.userId);

        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        return NextResponse.json(
            {
                success: true,
                message: "Email verified successfully! You can now log in.",
            },
            { status: 200 },
        );
    } catch (error) {
        const message = error instanceof Error ? error.message : "Verification failed";
        console.error("Email verification error:", error);

        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export const GET = withApiLogging(getVerifyEmail);
