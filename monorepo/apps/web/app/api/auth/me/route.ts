import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getCurrentUserFromToken, mapAuthError } from "@/lib/auth/authService";
import { getAuthContextForUserId } from "@/lib/auth/authorization";
import { getSessionCookie } from "@repo/auth/lib/cookies";
import { profileUpdateSchema } from "@repo/auth/validators";
import { toSafeUser, updateUserName } from "@/lib/db/userRepo";

export async function GET() {
    const token = await getSessionCookie();
    if (!token) {
        return NextResponse.json({ user: null }, { status: 401 });
    }

    const user = await getCurrentUserFromToken(token);
    if (!user) {
        return NextResponse.json({ user: null }, { status: 401 });
    }

    const ctx = await getAuthContextForUserId(user.id);
    const permissions = ctx ? [...ctx.permissions].sort() : [];
    const roles = ctx?.roles ?? [];

    return NextResponse.json({ user, permissions, roles }, { status: 200 });
}

export async function PATCH(request: Request) {
    const token = await getSessionCookie();
    if (!token) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const safeUser = await getCurrentUserFromToken(token);
    if (!safeUser) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    try {
        const parsed = profileUpdateSchema.parse(body);
        const updated = await updateUserName(safeUser.id, parsed.name);
        if (!updated) {
            return NextResponse.json({ error: "Unable to update profile." }, { status: 400 });
        }
        const ctx = await getAuthContextForUserId(updated.id);
        const permissions = ctx ? [...ctx.permissions].sort() : [];
        const roles = ctx?.roles ?? [];
        return NextResponse.json({ user: toSafeUser(updated), permissions, roles }, { status: 200 });
    } catch (error) {
        if (error instanceof ZodError) {
            const first = error.issues[0];
            return NextResponse.json({ error: first?.message ?? "Invalid input." }, { status: 400 });
        }
        const mapped = mapAuthError(error);
        return NextResponse.json({ error: mapped.message }, { status: mapped.status });
    }
}
