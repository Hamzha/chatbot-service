"use client";

import type { SafeUser } from "@repo/auth/types";
import { AccountDetailsCard } from "@/components/dashboard/profile/AccountDetailsCard";
import { DisplayNameForm } from "@/components/dashboard/profile/DisplayNameForm";
import { PasswordResetCard } from "@/components/dashboard/profile/PasswordResetCard";
import { PermissionsCard } from "@/components/dashboard/profile/PermissionsCard";
import { RolesCard } from "@/components/dashboard/profile/RolesCard";

type RoleChip = { id: string; slug: string; name: string; enabled?: boolean };

export function ProfileClient({
    initialUser,
    initialRoles,
    initialPermissions,
}: {
    initialUser: SafeUser;
    initialRoles: RoleChip[];
    initialPermissions: string[];
}) {
    return (
        <div className="space-y-5 sm:space-y-6">
            <AccountDetailsCard user={initialUser} />
            <RolesCard roles={initialRoles} />
            <PermissionsCard permissions={initialPermissions} />
            <DisplayNameForm initialUser={initialUser} />
            <PasswordResetCard />
        </div>
    );
}
