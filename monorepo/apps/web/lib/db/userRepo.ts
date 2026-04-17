import type { SafeUser, UserRecord } from "@repo/auth/types";
import mongoose, { Model, Schema, Types } from "mongoose";
import { getMongoDbUri } from "@repo/auth/lib/env";
import { connectToDatabase } from "@/lib/db/client";
import { findRolesByIds } from "@/lib/db/roleRepo";

type UserDoc = {
    _id: Types.ObjectId;
    email: string;
    name: string;
    passwordHash: string;
    emailVerified?: Date;
    roleIds?: Types.ObjectId[];
    createdAt: Date;
    updatedAt: Date;
};

const userSchema = new Schema<UserDoc>(
    {
        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
        },
        name: {
            type: String,
            required: true,
            trim: true,
        },
        passwordHash: {
            type: String,
            required: true,
        },
        emailVerified: {
            type: Date,
            default: null,
        },
        roleIds: {
            type: [{ type: Schema.Types.ObjectId, ref: "Role" }],
            default: [],
        },
    },
    {
        timestamps: true,
    },
);

const UserModel: Model<UserDoc> =
    (mongoose.models.User as Model<UserDoc> | undefined) ||
    mongoose.model<UserDoc>("User", userSchema);

function mapUserDocToRecord(user: UserDoc): UserRecord {
    return {
        emailVerified: user.emailVerified ? user.emailVerified.toISOString() : null,
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        passwordHash: user.passwordHash,
        createdAt: user.createdAt.toISOString(),
        roleIds: user.roleIds?.map((id) => id.toString()),
    };
}

async function ensureDbConnection(): Promise<void> {
    await connectToDatabase(getMongoDbUri());
}

function normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
}

export function toSafeUser(user: UserRecord): SafeUser {
    return {
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt,
    };
}

export async function findUserByEmail(email: string): Promise<UserRecord | null> {
    await ensureDbConnection();
    const normalized = normalizeEmail(email);
    const user = await UserModel.findOne({ email: normalized }).lean<UserDoc | null>();

    return user ? mapUserDocToRecord(user) : null;
}

export async function findUserById(id: string): Promise<UserRecord | null> {
    if (!Types.ObjectId.isValid(id)) {
        return null;
    }

    await ensureDbConnection();
    const user = await UserModel.findById(id).lean<UserDoc | null>();

    return user ? mapUserDocToRecord(user) : null;
}

/** Create or update user by email; always marks email as verified (for demo / tooling). */
export async function upsertVerifiedUserByEmail(input: {
    email: string;
    name: string;
    passwordHash: string;
}): Promise<UserRecord> {
    await ensureDbConnection();
    const normalized = normalizeEmail(input.email);
    const now = new Date();
    const doc = await UserModel.findOneAndUpdate(
        { email: normalized },
        {
            $set: {
                email: normalized,
                name: input.name.trim(),
                passwordHash: input.passwordHash,
                emailVerified: now,
            },
        },
        { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
    ).lean<UserDoc | null>();

    if (!doc) {
        throw new Error("Failed to upsert user.");
    }
    return mapUserDocToRecord(doc);
}

export async function createUser(input: {
    email: string;
    name: string;
    passwordHash: string;
}): Promise<UserRecord> {
    await ensureDbConnection();
    const normalized = normalizeEmail(input.email);

    const created = await UserModel.create({
        email: normalized,
        name: input.name.trim(),
        passwordHash: input.passwordHash,
    });

    return mapUserDocToRecord(created.toObject() as UserDoc);
}

export async function verifyUserEmail(userId: string): Promise<UserRecord | null> {
    await ensureDbConnection();

    if (!Types.ObjectId.isValid(userId)) {
        return null;
    }

    const updated = await UserModel.findByIdAndUpdate(
        userId,
        { emailVerified: new Date() },
        { new: true },
    ).lean<UserDoc>();

    return updated ? mapUserDocToRecord(updated) : null;
}

export async function countUsers(): Promise<number> {
    await ensureDbConnection();
    return UserModel.countDocuments({});
}

export type AdminUserListRow = {
    id: string;
    email: string;
    name: string;
    createdAt: string;
    emailVerified: boolean;
    roleIds: string[];
    roles: { id: string; slug: string; name: string; enabled: boolean }[];
};

export async function listUsersForAdmin(): Promise<AdminUserListRow[]> {
    await ensureDbConnection();
    const docs = await UserModel.find({})
        .select("_id email name createdAt emailVerified roleIds")
        .sort({ createdAt: -1 })
        .lean<UserDoc[]>();

    const allRoleIds = new Set<string>();
    for (const d of docs) {
        for (const rid of d.roleIds ?? []) {
            allRoleIds.add(rid.toString());
        }
    }
    const roleRecords = await findRolesByIds([...allRoleIds]);
    const roleMap = new Map(roleRecords.map((r) => [r.id, r]));

    return docs.map((d) => {
        const roleIds = (d.roleIds ?? []).map((id) => id.toString());
        const roles = roleIds.map((rid) => {
            const r = roleMap.get(rid);
            if (r) return { id: r.id, slug: r.slug, name: r.name, enabled: r.enabled };
            return { id: rid, slug: "unknown", name: "Unknown role", enabled: false };
        });
        return {
            id: d._id.toString(),
            email: d.email,
            name: d.name,
            createdAt: d.createdAt.toISOString(),
            emailVerified: Boolean(d.emailVerified),
            roleIds,
            roles,
        };
    });
}

export async function getAdminUserRow(userId: string): Promise<AdminUserListRow | null> {
    const u = await findUserById(userId);
    if (!u) return null;
    const roleIds = u.roleIds ?? [];
    const roles = await findRolesByIds(roleIds);
    return {
        id: u.id,
        email: u.email,
        name: u.name,
        createdAt: u.createdAt,
        emailVerified: u.emailVerified !== null,
        roleIds,
        roles: roles.map((r) => ({ id: r.id, slug: r.slug, name: r.name, enabled: r.enabled })),
    };
}

export async function updateUserRoleIds(userId: string, roleIds: string[]): Promise<UserRecord | null> {
    if (!Types.ObjectId.isValid(userId)) return null;
    await ensureDbConnection();
    const oids = roleIds.filter((id) => Types.ObjectId.isValid(id)).map((id) => new Types.ObjectId(id));
    const updated = await UserModel.findByIdAndUpdate(userId, { $set: { roleIds: oids } }, { new: true }).lean<UserDoc | null>();
    return updated ? mapUserDocToRecord(updated) : null;
}

export async function updateUserName(userId: string, name: string): Promise<UserRecord | null> {
    if (!Types.ObjectId.isValid(userId)) return null;
    await ensureDbConnection();
    const trimmed = name.trim();
    if (trimmed.length < 2) return null;
    const updated = await UserModel.findByIdAndUpdate(userId, { name: trimmed }, { new: true }).lean<UserDoc | null>();
    return updated ? mapUserDocToRecord(updated) : null;
}

export async function updateUserPassword(userId: string, passwordHash: string): Promise<UserRecord | null> {
    await ensureDbConnection();

    if (!Types.ObjectId.isValid(userId)) {
        return null;
    }

    const updated = await UserModel.findByIdAndUpdate(
        userId,
        { passwordHash },
        { new: true },
    ).lean<UserDoc>();

    return updated ? mapUserDocToRecord(updated) : null;
}
