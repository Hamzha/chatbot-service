import { getMongoDbUri } from "@repo/auth/lib/env";
import mongoose, { Model, Schema, Types } from "mongoose";
import { connectToDatabase } from "@/lib/db/client";
import { allCatalogCodes, isValidPermissionCode } from "@/lib/auth/permissionCatalog";
import { findPermissionCodesByIds, findPermissionIdsByCodes } from "@/lib/db/permissionRepo";

export type RoleRecord = {
    id: string;
    name: string;
    slug: string;
    description: string;
    isSystem: boolean;
    /** When false, the role is kept for audit/history but grants no permissions. System roles cannot be disabled. */
    enabled: boolean;
    permissionCodes: string[];
};

type RoleDoc = {
    _id: Types.ObjectId;
    name: string;
    slug: string;
    description: string;
    isSystem: boolean;
    enabled?: boolean;
    permissionIds: Types.ObjectId[];
};

const roleSchema = new Schema<RoleDoc>(
    {
        name: { type: String, required: true, trim: true },
        slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
        description: { type: String, default: "", trim: true },
        isSystem: { type: Boolean, default: false },
        enabled: { type: Boolean, default: true },
        permissionIds: [{ type: Schema.Types.ObjectId, ref: "Permission" }],
    },
    { timestamps: true },
);

const RoleModel: Model<RoleDoc> =
    (mongoose.models.Role as Model<RoleDoc> | undefined) || mongoose.model<RoleDoc>("Role", roleSchema);

async function ensureDbConnection(): Promise<void> {
    await connectToDatabase(getMongoDbUri());
}

async function roleToRecord(doc: RoleDoc): Promise<RoleRecord> {
    const permissionCodes = await findPermissionCodesByIds(doc.permissionIds ?? []);
    return {
        id: doc._id.toString(),
        name: doc.name,
        slug: doc.slug,
        description: doc.description ?? "",
        isSystem: Boolean(doc.isSystem),
        enabled: doc.enabled !== false,
        permissionCodes,
    };
}

export async function listRoles(): Promise<RoleRecord[]> {
    await ensureDbConnection();
    const docs = await RoleModel.find({}).sort({ slug: 1 }).lean<RoleDoc[]>();
    return Promise.all(docs.map((d) => roleToRecord(d as RoleDoc)));
}

export async function findRoleBySlug(slug: string): Promise<RoleRecord | null> {
    await ensureDbConnection();
    const doc = await RoleModel.findOne({ slug: slug.toLowerCase() }).lean<RoleDoc | null>();
    if (!doc) return null;
    return roleToRecord(doc as RoleDoc);
}

export async function findRoleById(id: string): Promise<RoleRecord | null> {
    await ensureDbConnection();
    if (!Types.ObjectId.isValid(id)) return null;
    const doc = await RoleModel.findById(id).lean<RoleDoc | null>();
    if (!doc) return null;
    return roleToRecord(doc as RoleDoc);
}

export async function findRolesByIds(ids: string[]): Promise<RoleRecord[]> {
    if (ids.length === 0) return [];
    await ensureDbConnection();
    const oids = ids.filter((id) => Types.ObjectId.isValid(id)).map((id) => new Types.ObjectId(id));
    const docs = await RoleModel.find({ _id: { $in: oids } }).lean<RoleDoc[]>();
    return Promise.all(docs.map((d) => roleToRecord(d as RoleDoc)));
}

export async function createRole(input: {
    name: string;
    slug: string;
    description?: string;
    permissionCodes: string[];
}): Promise<RoleRecord> {
    await ensureDbConnection();
    const slug = input.slug.toLowerCase().trim();
    for (const c of input.permissionCodes) {
        if (!isValidPermissionCode(c)) {
            throw new Error(`Invalid permission code: ${c}`);
        }
    }
    const permissionIds = await findPermissionIdsByCodes(input.permissionCodes);
    const doc = await RoleModel.create({
        name: input.name.trim(),
        slug,
        description: (input.description ?? "").trim(),
        isSystem: false,
        enabled: true,
        permissionIds,
    });
    return roleToRecord(doc.toObject() as RoleDoc);
}

export async function updateRole(
    id: string,
    patch: { name?: string; description?: string; permissionCodes?: string[]; enabled?: boolean },
): Promise<RoleRecord | null> {
    await ensureDbConnection();
    if (!Types.ObjectId.isValid(id)) return null;
    const existing = await RoleModel.findById(id).lean<RoleDoc | null>();
    if (!existing) return null;

    const $set: Partial<RoleDoc> = {};
    if (patch.name !== undefined) $set.name = patch.name.trim();
    if (patch.description !== undefined) $set.description = patch.description.trim();
    if (patch.permissionCodes !== undefined) {
        for (const c of patch.permissionCodes) {
            if (!isValidPermissionCode(c)) throw new Error(`Invalid permission code: ${c}`);
        }
        $set.permissionIds = await findPermissionIdsByCodes(patch.permissionCodes);
    }
    if (patch.enabled !== undefined) {
        if (existing.isSystem && patch.enabled === false) {
            throw new Error("System roles cannot be disabled.");
        }
        $set.enabled = Boolean(patch.enabled);
    }
    if (Object.keys($set).length > 0) {
        await RoleModel.updateOne({ _id: new Types.ObjectId(id) }, { $set });
    }
    const doc = await RoleModel.findById(id).lean<RoleDoc | null>();
    if (!doc) return null;
    return roleToRecord(doc as RoleDoc);
}

/** Remove a role id from every user (for admin delete flow). */
export async function detachRoleFromAllUsers(roleId: string): Promise<number> {
    if (!Types.ObjectId.isValid(roleId)) return 0;
    await ensureDbConnection();
    const UserModel = mongoose.models.User as Model<{ roleIds?: Types.ObjectId[] }> | undefined;
    if (!UserModel) return 0;
    const oid = new Types.ObjectId(roleId);
    const res = await UserModel.updateMany({ roleIds: oid }, { $pull: { roleIds: oid } });
    return typeof res.modifiedCount === "number" ? res.modifiedCount : 0;
}

export async function deleteRoleById(
    id: string,
    options?: { detachUsers?: boolean },
): Promise<{ ok: boolean; reason?: string }> {
    await ensureDbConnection();
    if (!Types.ObjectId.isValid(id)) return { ok: false, reason: "invalid_id" };
    const doc = await RoleModel.findById(id).lean<RoleDoc | null>();
    if (!doc) return { ok: false, reason: "not_found" };
    if (doc.isSystem) return { ok: false, reason: "system_role" };

    const UserModel = mongoose.models.User as Model<{ roleIds?: Types.ObjectId[] }> | undefined;
    const oid = new Types.ObjectId(id);
    if (UserModel) {
        const inUse = await UserModel.countDocuments({ roleIds: oid });
        if (inUse > 0 && !options?.detachUsers) {
            return { ok: false, reason: "role_in_use" };
        }
        if (inUse > 0 && options?.detachUsers) {
            await detachRoleFromAllUsers(id);
        }
    }
    await RoleModel.deleteOne({ _id: oid });
    return { ok: true };
}

/** Default permission sets for seeded roles (subset of catalog). */
export function defaultAdminCodes(): string[] {
    return allCatalogCodes();
}

export function defaultClientCodes(): string[] {
    return [
        "dashboard:read",
        "chatbot_documents:create",
        "chatbot_documents:read",
        "chatbot_documents:update",
        "chatbot_documents:delete",
        "chatbot_sessions:create",
        "chatbot_sessions:read",
        "chatbot_sessions:update",
        "chatbot_sessions:delete",
        "chatbot_messages:create",
        "chatbot_messages:read",
        "chatbot_messages:update",
        "chatbot_messages:delete",
        "chatbot_query:create",
        "chatbot_jobs:read",
        "chatbot_sources:read",
        "chatbot_sources:delete",
        "scraper:create",
        "scraper:read",
        "scraper:update",
        "scraper:delete",
    ].filter(isValidPermissionCode);
}

export function defaultMediatorCodes(): string[] {
    return [
        "dashboard:read",
        "chatbot_documents:read",
        "chatbot_documents:update",
        "chatbot_sessions:create",
        "chatbot_sessions:read",
        "chatbot_sessions:update",
        "chatbot_messages:read",
        "chatbot_messages:create",
        "chatbot_query:create",
        "chatbot_jobs:read",
        "chatbot_sources:read",
    ].filter(isValidPermissionCode);
}

export async function upsertSystemRole(
    slug: string,
    name: string,
    description: string,
    permissionCodes: string[],
): Promise<void> {
    await ensureDbConnection();
    const permissionIds = await findPermissionIdsByCodes(permissionCodes);
    await RoleModel.updateOne(
        { slug: slug.toLowerCase() },
        {
            $set: {
                name,
                slug: slug.toLowerCase(),
                description,
                isSystem: true,
                enabled: true,
                permissionIds,
            },
        },
        { upsert: true },
    );
}

export async function assignRoleSlugsToUser(userId: string, slugs: string[]): Promise<void> {
    await ensureDbConnection();
    const normalized = slugs.map((s) => s.toLowerCase());
    const roles = await RoleModel.find({ slug: { $in: normalized } }).lean<RoleDoc[]>();
    const roleIds = roles.map((r) => r._id);
    const UserModel = mongoose.models.User as Model<{ roleIds?: Types.ObjectId[] }>;
    if (!UserModel) throw new Error("User model not registered");
    await UserModel.updateOne({ _id: new Types.ObjectId(userId) }, { $set: { roleIds } });
}

export async function addRoleSlugsToUser(userId: string, slugs: string[]): Promise<void> {
    await ensureDbConnection();
    const normalized = slugs.map((s) => s.toLowerCase());
    const roles = await RoleModel.find({ slug: { $in: normalized } }).lean<RoleDoc[]>();
    const newIds = roles.map((r) => r._id);
    const UserModel = mongoose.models.User as Model<{ roleIds?: Types.ObjectId[] }>;
    if (!UserModel) throw new Error("User model not registered");
    await UserModel.updateOne({ _id: new Types.ObjectId(userId) }, { $addToSet: { roleIds: { $each: newIds } } });
}
