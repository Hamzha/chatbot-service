import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUserFromToken } from "@/lib/auth/authService";
import { getAuthContextForUserId } from "@/lib/auth/authorization";
import { getSessionCookie } from "@repo/auth/lib/cookies";
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
        <div className="mx-auto max-w-2xl space-y-8">
            <header>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-700">Account</p>
                <h1 className="mt-1 text-3xl font-semibold text-slate-900">My profile</h1>
                <p className="mt-2 text-sm text-slate-600">
                    Your sign-in identity and roles. Update your display name here; use the password reset flow to change your password.
                </p>
            </header>

            <ProfileClient
                initialUser={user}
                initialRoles={roles}
                initialPermissions={permissions}
            />

            <p className="text-center text-sm text-slate-500">
                <Link href="/dashboard" className="font-medium text-brand-700 hover:text-brand-900">
                    Back to overview
                </Link>
            </p>
        </div>
    );
}
