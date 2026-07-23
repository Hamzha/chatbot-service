import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { setSessionCookie } from "@repo/auth/lib/cookies";
import { withApiLogging } from "@/lib/api/withApiLogging";
import { requireRateLimitByIp } from "@/lib/rateLimit/requireRateLimit";
import { loginOrSignupWithGoogle } from "@/lib/auth/authService";
import {
    GOOGLE_OAUTH_STATE_COOKIE,
    exchangeGoogleCode,
    fetchGoogleUserProfile,
    hashOAuthState,
    isGoogleOAuthConfigured,
} from "@/lib/auth/googleOAuth";

function redirectLoginError(request: Request, code: string) {
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(code)}`, request.url));
}

async function getGoogleCallback(request: Request) {
    const limited = await requireRateLimitByIp(request, "auth:google-callback", { limit: 30, windowSec: 900 });
    if (limited) return limited;

    if (!isGoogleOAuthConfigured()) {
        return redirectLoginError(request, "google-not-configured");
    }

    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const oauthError = url.searchParams.get("error");

    if (oauthError) {
        return redirectLoginError(request, oauthError === "access_denied" ? "google-denied" : "google-failed");
    }

    if (!code || !state) {
        return redirectLoginError(request, "google-invalid");
    }

    const cookieStore = await cookies();
    const storedHash = cookieStore.get(GOOGLE_OAUTH_STATE_COOKIE)?.value;
    cookieStore.set(GOOGLE_OAUTH_STATE_COOKIE, "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 0,
    });

    if (!storedHash || storedHash !== hashOAuthState(state)) {
        return redirectLoginError(request, "google-state");
    }

    try {
        const { accessToken } = await exchangeGoogleCode(code);
        const profile = await fetchGoogleUserProfile(accessToken);
        const { token } = await loginOrSignupWithGoogle(profile);
        await setSessionCookie(token);
        return NextResponse.redirect(new URL("/dashboard", request.url));
    } catch (error) {
        console.error("[google-oauth] callback failed:", error);
        return redirectLoginError(request, "google-failed");
    }
}

export const GET = withApiLogging(getGoogleCallback);
