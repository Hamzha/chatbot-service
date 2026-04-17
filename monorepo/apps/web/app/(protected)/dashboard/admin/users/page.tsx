import { redirect } from "next/navigation";
import { getCurrentUserFromToken } from "@/lib/auth/authService";
import { getAuthContextForUserId, hasPermission } from "@/lib/auth/authorization";
import { getSessionCookie } from "@repo/auth/lib/cookies";
import { UsersAdminClient } from "@/components/dashboard/UsersAdminClient";

export default async function AdminUsersPage() {
    const token = await getSessionCookie();
    const user = token ? await getCurrentUserFromToken(token) : null;
    if (!user) {
        redirect("/login");
    }
    const ctx = await getAuthContextForUserId(user.id);
    if (!hasPermission(ctx, "users:read")) {
        redirect("/dashboard");
    }

    return <UsersAdminClient />;
}
