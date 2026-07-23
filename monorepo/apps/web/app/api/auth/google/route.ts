import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { withApiLogging } from "@/lib/api/withApiLogging";
import { requireRateLimitByIp } from "@/lib/rateLimit/requireRateLimit";
import {
    GOOGLE_OAUTH_STATE_COOKIE,
    buildGoogleAuthorizationUrl,
    createOAuthState,
    hashOAuthState,
    isGoogleOAuthConfigured,
} from "@/lib/auth/googleOAuth";

async function getGoogleStart(request: Request) {
    const limited = await requireRateLimitByIp(request, "auth:google-start", { limit: 20, windowSec: 900 });
    if (limited) return limited;

    if (!isGoogleOAuthConfigured()) {
        return NextResponse.redirect(new URL("/login?error=google-not-configured", request.url));
    }

    try {
        const state = createOAuthState();
        const url = buildGoogleAuthorizationUrl(state);
        const cookieStore = await cookies();
        cookieStore.set(GOOGLE_OAUTH_STATE_COOKIE, hashOAuthState(state), {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            path: "/",
            maxAge: 60 * 10,
        });
        return NextResponse.redirect(url);
    } catch (error) {
        console.error("[google-oauth] start failed:", error);
        return NextResponse.redirect(new URL("/login?error=google-start-failed", request.url));
    }
}

export const GET = withApiLogging(getGoogleStart);
