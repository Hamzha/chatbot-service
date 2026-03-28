import { NextRequest, NextResponse } from "next/server";
import { verifyEmailToken } from "@repo/auth/lib/tokens";
import { verifyUserEmail } from "@/lib/db/userRepo";

/**
 * Email verification route
 * GET /api/auth/verify-email?token=...
 */
export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const token = searchParams.get("token");

        if (!token) {
            return NextResponse.json({ error: "Missing verification token" }, { status: 400 });
        }

        // Verify the token
        const payload = await verifyEmailToken(token);

        if (!payload || payload.type !== "email_verification") {
            return NextResponse.json({ error: "Invalid or expired token" }, { status: 400 });
        }

        if (!payload.userId) {
            return NextResponse.json({ error: "Invalid token payload" }, { status: 400 });
        }

        // Mark email as verified in database
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
