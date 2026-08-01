import { redirect } from "next/navigation";
import { getSessionCookie } from "@repo/auth/lib/cookies";
import { getCurrentUserFromToken } from "@/lib/auth/authService";
import { getAuthContextForUserId, hasPermission, type AuthContext } from "@/lib/auth/authorization";

export type PageAuthOk = {
    user: NonNullable<Awaited<ReturnType<typeof getCurrentUserFromToken>>>;
    ctx: AuthContext;
};

export async function requirePagePermission(permission: string): Promise<PageAuthOk> {
    const token = await getSessionCookie();
    const user = token ? await getCurrentUserFromToken(token) : null;
    if (!user) {
        redirect("/login");
    }
    const ctx = await getAuthContextForUserId(user.id);
    if (!hasPermission(ctx, permission)) {
        redirect("/dashboard");
    }
    return { user, ctx: ctx! };
}
