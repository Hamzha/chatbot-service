import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUserFromToken } from "@/lib/auth/authService";
import { getAuthContextForUserId } from "@/lib/auth/authorization";
import { getSessionCookie } from "@repo/auth/lib/cookies";
import { PageContainer } from "@/components/shell/PageContainer";
import { PageHeader } from "@/components/shell/PageHeader";
import { ProfileClient } from "@/components/dashboard/ProfileClient";

export default async function ProfilePage() {
    const token = await getSessionCookie();
    const user = token ? await getCurrentUserFromToken(token) : null;
    if (!user) {
        redirect("/login");
    }
    const ctx = await getAuthContextForUserId(user.id);
    const roles = ctx?.roles ?? [];
    const permissions = ctx ? [...ctx.permissions].sort() : [];

    return (
        <PageContainer size="md">
            <PageHeader
                variant="plain"
                eyebrow="Account"
                title="My profile"
                subtitle="Your sign-in identity and roles. Update your display name here; use the password reset flow to change your password."
            />

            <ProfileClient
                initialUser={user}
                initialRoles={roles}
                initialPermissions={permissions}
            />

            <p className="pt-2 text-center text-sm text-slate-700">
                <Link
                    href="/dashboard"
                    className="font-semibold text-brand-700 underline-offset-2 hover:text-brand-900 hover:underline"
                >
                    ← Back to overview
                </Link>
            </p>
        </PageContainer>
    );
}
