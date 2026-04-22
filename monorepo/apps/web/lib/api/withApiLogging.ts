import { randomUUID } from "node:crypto";
import { SESSION_COOKIE_NAME } from "@repo/auth/lib/cookies";
import { verifySessionToken } from "@repo/auth/lib/jwt";
import { findUserById } from "@/lib/db/userRepo";
import { createApiRequestLog } from "@/lib/db/apiRequestLogRepo";

type AnyHandler = (...args: any[]) => Promise<Response> | Response;

function readCookieValue(cookieHeader: string | null, key: string): string | null {
    if (!cookieHeader) return null;
    const parts = cookieHeader.split(";").map((p) => p.trim());
    for (const part of parts) {
        const [k, ...rest] = part.split("=");
        if (k === key) return decodeURIComponent(rest.join("="));
    }
    return null;
}

async function resolveActorFromRequest(request: Request): Promise<{ userId: string | null; userEmail: string | null }> {
    try {
        const cookieHeader = request.headers.get("cookie");
        const token = readCookieValue(cookieHeader, SESSION_COOKIE_NAME);
        if (!token) return { userId: null, userEmail: null };
        const payload = await verifySessionToken(token);
        const user = await findUserById(payload.sub);
        return { userId: user?.id ?? payload.sub, userEmail: user?.email ?? null };
    } catch {
        return { userId: null, userEmail: null };
    }
}

function sanitizeErrorMessage(error: unknown): string | null {
    if (!error) return null;
    if (error instanceof Error) return error.message.slice(0, 500);
    return String(error).slice(0, 500);
}

function getIp(request: Request): string | null {
    const xff = request.headers.get("x-forwarded-for");
    if (xff) return xff.split(",")[0]?.trim() || null;
    return request.headers.get("x-real-ip");
}

export function withApiLogging<TRequest extends Request, TContext>(
    handler: (request: TRequest, context: TContext) => Promise<Response> | Response,
): (request: TRequest, context: TContext) => Promise<Response>;
export function withApiLogging<TRequest extends Request>(
    handler: (request: TRequest) => Promise<Response> | Response,
): (request: TRequest) => Promise<Response>;
export function withApiLogging(handler: AnyHandler): AnyHandler {
    return async (...args: unknown[]) => {
        const request = args[0];
        const context = args[1];
        if (!(request instanceof Request)) {
            return handler(...args);
        }
        const started = Date.now();
        const requestId = request.headers.get("x-request-id") ?? randomUUID();
        const method = request.method.toUpperCase();
        const route = new URL(request.url).pathname;
        const userAgent = request.headers.get("user-agent");
        const ip = getIp(request);
        const actor = await resolveActorFromRequest(request);

        try {
            const response = await handler(request, context);
            try {
                await createApiRequestLog({
                    requestId,
                    method,
                    route,
                    status: response.status,
                    durationMs: Date.now() - started,
                    userId: actor.userId,
                    userEmail: actor.userEmail,
                    ip,
                    userAgent,
                });
            } catch {
                // Logging must not break the request lifecycle.
            }
            return response;
        } catch (error) {
            try {
                await createApiRequestLog({
                    requestId,
                    method,
                    route,
                    status: 500,
                    durationMs: Date.now() - started,
                    userId: actor.userId,
                    userEmail: actor.userEmail,
                    ip,
                    userAgent,
                    errorMessage: sanitizeErrorMessage(error),
                });
            } catch {
                // Logging must not break the request lifecycle.
            }
            throw error;
        }
    };
}
