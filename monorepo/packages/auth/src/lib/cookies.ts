import { cookies } from "next/headers";
import { getJwtTtlSeconds } from "./env";

export const SESSION_COOKIE_NAME = "auth_token";

function getCookieOptions(maxAge?: number) {
    return {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax" as const,
        path: "/",
        maxAge,
    };
}

export async function setSessionCookie(token: string): Promise<void> {
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE_NAME, token, getCookieOptions(getJwtTtlSeconds()));
}

export async function clearSessionCookie(): Promise<void> {
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE_NAME, "", getCookieOptions(0));
}

export async function getSessionCookie(): Promise<string | undefined> {
    const cookieStore = await cookies();
    return cookieStore.get(SESSION_COOKIE_NAME)?.value;
}
