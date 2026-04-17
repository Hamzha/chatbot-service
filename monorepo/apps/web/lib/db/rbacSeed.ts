import mongoose, { Model, Types } from "mongoose";
import { getMongoDbUri } from "@repo/auth/lib/env";
import { connectToDatabase } from "@/lib/db/client";
import { syncPermissionCatalog } from "@/lib/db/permissionRepo";
import {
    defaultAdminCodes,
    defaultClientCodes,
    defaultMediatorCodes,
    findRoleBySlug,
    upsertSystemRole,
    addRoleSlugsToUser,
} from "@/lib/db/roleRepo";
import { ensureDemoUsers } from "@/lib/db/demoUsers";
import { findUserByEmail } from "@/lib/db/userRepo";

let seedPromise: Promise<void> | null = null;

async function migrateUsersWithoutRoles(): Promise<void> {
    const UserModel = mongoose.models.User as mongoose.Model<{ roleIds?: Types.ObjectId[] }> | undefined;
    if (!UserModel) return;
    const client = await findRoleBySlug("client");
    if (!client) return;
    const clientOid = new Types.ObjectId(client.id);
    await UserModel.updateMany(
        { $or: [{ roleIds: { $exists: false } }, { roleIds: { $size: 0 } }] },
        { $set: { roleIds: [clientOid] } },
    );
}

async function bootstrapAdminFromEnv(): Promise<void> {
    const email = process.env.ADMIN_BOOTSTRAP_EMAIL?.trim().toLowerCase();
    if (!email) return;
    const user = await findUserByEmail(email);
    if (!user) return;
    await addRoleSlugsToUser(user.id, ["admin"]);
}

async function runSeed(): Promise<void> {
    await connectToDatabase(getMongoDbUri());
    await syncPermissionCatalog();
    await upsertSystemRole("admin", "Administrator", "Full access", defaultAdminCodes());
    await upsertSystemRole("client", "Client", "Standard product access", defaultClientCodes());
    await upsertSystemRole("mediator", "Mediator", "Limited operational access", defaultMediatorCodes());
    const RoleModel = mongoose.models.Role as Model<{ enabled?: boolean }> | undefined;
    if (RoleModel) {
        await RoleModel.updateMany({ enabled: { $exists: false } }, { $set: { enabled: true } });
    }
    await migrateUsersWithoutRoles();
    await bootstrapAdminFromEnv();
    await ensureDemoUsers();
}

/** Idempotent: sync catalog, seed system roles, backfill user roles, env admin grant. */
export function ensureRbacSeeded(): Promise<void> {
    if (!seedPromise) {
        seedPromise = runSeed().catch((err) => {
            seedPromise = null;
            throw err;
        });
    }
    return seedPromise;
}
