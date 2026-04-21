import { redirect } from "next/navigation";
import { getCurrentUserFromToken } from "@/lib/auth/authService";
import { getAuthContextForUserId } from "@/lib/auth/authorization";
import { getSessionCookie } from "@repo/auth/lib/cookies";
import { AppShell } from "@/components/shell/AppShell";

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const token = await getSessionCookie();
    const user = token ? await getCurrentUserFromToken(token) : null;

    if (!user) {
        redirect("/login");
    }

    const ctx = await getAuthContextForUserId(user.id);
    const permissions = ctx ? [...ctx.permissions] : [];

    return (
        <AppShell
            userName={user.name}
            userEmail={user.email}
            permissions={permissions}
        >
            {children}
        </AppShell>
    );
}
