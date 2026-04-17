import { redirect } from "next/navigation";
import { getCurrentUserFromToken } from "@/lib/auth/authService";
import { getAuthContextForUserId, hasPermission } from "@/lib/auth/authorization";
import { getSessionCookie } from "@repo/auth/lib/cookies";
import { RolesAdminClient } from "@/components/dashboard/RolesAdminClient";

export default async function AdminRolesPage() {
    const token = await getSessionCookie();
    const user = token ? await getCurrentUserFromToken(token) : null;
    if (!user) {
        redirect("/login");
    }
    const ctx = await getAuthContextForUserId(user.id);
    if (!hasPermission(ctx, "roles:read")) {
        redirect("/dashboard");
    }

    return <RolesAdminClient />;
}
