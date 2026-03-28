import { SESSION_COOKIE_NAME } from "@repo/auth/lib/cookies";
import { verifySessionToken } from "@repo/auth/lib/jwt";
import { findUserById, toSafeUser } from "@/lib/db/userRepo";
import type { NextRequest } from "next/server";
import type { SafeUser } from "@repo/auth/types";

export async function getSessionPayloadFromRequest(request: NextRequest) {
    const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
    if (!token) {
        return null;
    }

    try {
        return await verifySessionToken(token);
    } catch {
        return null;
    }
}

export async function getAuthenticatedUserFromRequest(
    request: NextRequest,
): Promise<SafeUser | null> {
    const payload = await getSessionPayloadFromRequest(request);
    if (!payload) {
        return null;
    }

    const user = await findUserById(payload.sub);
    return user ? toSafeUser(user) : null;
}
