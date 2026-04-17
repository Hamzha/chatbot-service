import { NextResponse } from "next/server";
import { getSessionCookie } from "@repo/auth/lib/cookies";
import { verifySessionToken } from "@repo/auth/lib/jwt";
import { getAuthContextForUserId, type AuthContext } from "@/lib/auth/authorization";

export type ApiAuthOk = { ctx: AuthContext };

export async function requireApiPermission(
    permission: string,
): Promise<ApiAuthOk | NextResponse> {
    const token = await getSessionCookie();
    if (!token) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    let userId: string;
    try {
        const payload = await verifySessionToken(token);
        userId = payload.sub;
    } catch {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const ctx = await getAuthContextForUserId(userId);
    if (!ctx) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!ctx.permissions.has(permission)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return { ctx };
}

export async function requireUserIdWithPermission(
    permission: string,
): Promise<{ userId: string } | NextResponse> {
    const r = await requireApiPermission(permission);
    if (r instanceof NextResponse) return r;
    return { userId: r.ctx.userId };
}
