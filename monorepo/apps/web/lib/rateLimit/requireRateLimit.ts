import { NextResponse } from "next/server";
import { consumeRateLimit } from "@/lib/rateLimit/rateLimitRepo";

export type RateLimitOptions = {
    limit: number;
    windowSec: number;
};

function getClientIp(request: Request): string {
    const xff = request.headers.get("x-forwarded-for");
    if (xff) {
        const first = xff.split(",")[0]?.trim();
        if (first) return first;
    }
    const real = request.headers.get("x-real-ip");
    if (real) return real.trim();
    return "unknown";
}

function isEnabled(): boolean {
    if (process.env.RATE_LIMIT_DISABLED === "true") return false;
    if (process.env.NODE_ENV === "production") return true;
    return process.env.RATE_LIMIT_ENABLED === "true";
}

function buildHeaders(result: { limit: number; count: number; resetAt: number }): Headers {
    const remaining = Math.max(0, result.limit - result.count);
    const retryAfterSec = Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000));
    const h = new Headers();
    h.set("X-RateLimit-Limit", String(result.limit));
    h.set("X-RateLimit-Remaining", String(remaining));
    h.set("X-RateLimit-Reset", String(Math.floor(result.resetAt / 1000)));
    h.set("Retry-After", String(retryAfterSec));
    return h;
}

export async function requireRateLimitByIp(
    request: Request,
    bucket: string,
    opts: RateLimitOptions,
): Promise<NextResponse | null> {
    if (!isEnabled()) return null;
    const ip = getClientIp(request);
    const result = await consumeRateLimit(bucket, `ip:${ip}`, opts.limit, opts.windowSec);
    if (!result.allowed) {
        return NextResponse.json(
            { error: "Too many requests" },
            { status: 429, headers: buildHeaders(result) },
        );
    }
    return null;
}

export async function requireRateLimitByUser(
    userId: string,
    bucket: string,
    opts: RateLimitOptions,
): Promise<NextResponse | null> {
    if (!isEnabled()) return null;
    const result = await consumeRateLimit(bucket, `user:${userId}`, opts.limit, opts.windowSec);
    if (!result.allowed) {
        return NextResponse.json(
            { error: "Too many requests" },
            { status: 429, headers: buildHeaders(result) },
        );
    }
    return null;
}
