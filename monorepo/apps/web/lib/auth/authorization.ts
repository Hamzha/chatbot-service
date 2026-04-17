import { findRolesByIds } from "@/lib/db/roleRepo";
import { findUserById } from "@/lib/db/userRepo";

export type AuthContext = {
    userId: string;
    permissions: Set<string>;
    roles: { id: string; slug: string; name: string; enabled: boolean }[];
};

export async function getAuthContextForUserId(userId: string): Promise<AuthContext | null> {
    const user = await findUserById(userId);
    if (!user) return null;
    const roleIds = user.roleIds ?? [];
    const roles = await findRolesByIds(roleIds);
    const permissions = new Set<string>();
    for (const r of roles) {
        if (r.enabled === false) continue;
        for (const c of r.permissionCodes) {
            permissions.add(c);
        }
    }
    return {
        userId,
        permissions,
        roles: roles.map((r) => ({ id: r.id, slug: r.slug, name: r.name, enabled: r.enabled })),
    };
}

export function hasPermission(ctx: AuthContext | null, code: string): boolean {
    if (!ctx) return false;
    return ctx.permissions.has(code);
}
