import { createHash, randomBytes } from "crypto";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";

export const GOOGLE_OAUTH_STATE_COOKIE = "google_oauth_state";

export type GoogleUserProfile = {
    googleId: string;
    email: string;
    name: string;
    emailVerified: boolean;
    picture?: string;
};

function requireEnv(name: string): string {
    const value = process.env[name]?.trim();
    if (!value) {
        throw new Error(`${name} is not configured.`);
    }
    return value;
}

export function isGoogleOAuthConfigured(): boolean {
    return Boolean(process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim());
}

export function getGoogleRedirectUri(): string {
    const explicit = process.env.GOOGLE_REDIRECT_URI?.trim();
    if (explicit) return explicit;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");
    if (!appUrl) {
        throw new Error("GOOGLE_REDIRECT_URI or NEXT_PUBLIC_APP_URL must be set for Google OAuth.");
    }
    return `${appUrl}/api/auth/google/callback`;
}

export function createOAuthState(): string {
    return randomBytes(24).toString("hex");
}

export function hashOAuthState(state: string): string {
    return createHash("sha256").update(state).digest("hex");
}

export function buildGoogleAuthorizationUrl(state: string): string {
    const clientId = requireEnv("GOOGLE_CLIENT_ID");
    const redirectUri = getGoogleRedirectUri();
    const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: "openid email profile",
        state,
        access_type: "online",
        prompt: "select_account",
    });
    return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

export async function exchangeGoogleCode(code: string): Promise<{ accessToken: string }> {
    const clientId = requireEnv("GOOGLE_CLIENT_ID");
    const clientSecret = requireEnv("GOOGLE_CLIENT_SECRET");
    const redirectUri = getGoogleRedirectUri();

    const res = await fetch(GOOGLE_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            code,
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: redirectUri,
            grant_type: "authorization_code",
        }),
    });

    const data = (await res.json()) as { access_token?: string; error?: string; error_description?: string };
    if (!res.ok || !data.access_token) {
        throw new Error(data.error_description || data.error || "Failed to exchange Google authorization code.");
    }
    return { accessToken: data.access_token };
}

export async function fetchGoogleUserProfile(accessToken: string): Promise<GoogleUserProfile> {
    const res = await fetch(GOOGLE_USERINFO_URL, {
        headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = (await res.json()) as {
        sub?: string;
        email?: string;
        email_verified?: boolean;
        name?: string;
        picture?: string;
        error?: string;
    };

    if (!res.ok || !data.sub || !data.email) {
        throw new Error(data.error || "Failed to load Google user profile.");
    }

    return {
        googleId: data.sub,
        email: data.email.trim().toLowerCase(),
        name: (data.name || data.email.split("@")[0] || "Google User").trim(),
        emailVerified: Boolean(data.email_verified),
        picture: data.picture,
    };
}
