import { hashPassword } from "@repo/auth/lib/password";
import { assignRoleSlugsToUser } from "@/lib/db/roleRepo";
import { upsertVerifiedUserByEmail } from "@/lib/db/userRepo";

/** Defaults used when `ALLOW_DEMO_LOGIN=true` and `DEMO_*` env vars are omitted (local dev only). */
export const DEFAULT_DEMO_ADMIN_EMAIL = "admin@test.local";
export const DEFAULT_DEMO_USER_EMAIL = "user@test.local";
export const DEFAULT_DEMO_ADMIN_PASSWORD = "AdminTest123!";
export const DEFAULT_DEMO_USER_PASSWORD = "UserTest123!";

function isDemoLoginAllowed(): boolean {
    return process.env.ALLOW_DEMO_LOGIN === "true";
}

/** Resolved emails/passwords for seed + demo-login. Null only when demo login is off. */
export function getResolvedDemoCredentials(): {
    adminEmail: string;
    adminPassword: string;
    userEmail: string;
    userPassword: string;
} | null {
    if (!isDemoLoginAllowed()) return null;
    const adminEmail = (process.env.DEMO_ADMIN_EMAIL?.trim() || DEFAULT_DEMO_ADMIN_EMAIL).toLowerCase();
    const userEmail = (process.env.DEMO_USER_EMAIL?.trim() || DEFAULT_DEMO_USER_EMAIL).toLowerCase();
    const adminPassword = process.env.DEMO_ADMIN_PASSWORD || DEFAULT_DEMO_ADMIN_PASSWORD;
    const userPassword = process.env.DEMO_USER_PASSWORD || DEFAULT_DEMO_USER_PASSWORD;
    if (adminEmail === userEmail) {
        console.warn("[demo] Admin and test user emails must differ; check DEMO_* env.");
        return null;
    }
    return { adminEmail, adminPassword, userEmail, userPassword };
}

export function getDemoLoginEnv(): { enabled: boolean } {
    return { enabled: getResolvedDemoCredentials() !== null };
}

/**
 * Upsert demo admin (full admin role / all permissions) + test user (`user` role), both email-verified.
 * Runs when `ALLOW_DEMO_LOGIN=true` (uses defaults or `DEMO_*` overrides).
 */
export async function ensureDemoUsers(): Promise<void> {
    const c = getResolvedDemoCredentials();
    if (!c) return;

    const adminHash = await hashPassword(c.adminPassword);
    const userHash = await hashPassword(c.userPassword);

    const adminRecord = await upsertVerifiedUserByEmail({
        email: c.adminEmail,
        name: "Demo Admin",
        passwordHash: adminHash,
    });
    await assignRoleSlugsToUser(adminRecord.id, ["admin"]);

    const normalRecord = await upsertVerifiedUserByEmail({
        email: c.userEmail,
        name: "Demo User",
        passwordHash: userHash,
    });
    await assignRoleSlugsToUser(normalRecord.id, ["user"]);
}
