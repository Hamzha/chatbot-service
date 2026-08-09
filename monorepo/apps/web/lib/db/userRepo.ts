import type {
    SafeUser,
    SubscriptionStatus,
    UserRecord,
} from "@repo/auth/types";
import mongoose, { Model, Schema, Types } from "mongoose";
import { getMongoDbUri } from "@repo/auth/lib/env";
import { connectToDatabase } from "@/lib/db/client";
import { findRolesByIds } from "@/lib/db/roleRepo";

type UserDoc = {
    _id: Types.ObjectId;
    email: string;
    name: string;
    passwordHash?: string;
    googleId?: string | null;
    image?: string | null;
    emailVerified?: Date;
    roleIds?: Types.ObjectId[];
    plan?: string;
    subscriptionStatus?: SubscriptionStatus;
    stripeCustomerId?: string | null;
    stripeSubscriptionId?: string | null;
    onboardingCompleted?: boolean;
    onboardingUseCase?: string | null;
    onboardingWebsiteUrl?: string | null;
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
            required: false,
        },
        googleId: {
            type: String,
            default: null,
            sparse: true,
            unique: true,
        },
        image: {
            type: String,
            default: null,
        },
        emailVerified: {
            type: Date,
            default: null,
        },
        roleIds: {
            type: [{ type: Schema.Types.ObjectId, ref: "Role" }],
            default: [],
        },
        plan: {
            type: String,
            default: "free",
            trim: true,
            lowercase: true,
        },
        subscriptionStatus: {
            type: String,
            enum: ["none", "pending", "active", "past_due", "canceled"],
            default: "none",
        },
        stripeCustomerId: {
            type: String,
            default: null,
            sparse: true,
            unique: true,
            index: true,
        },
        stripeSubscriptionId: {
            type: String,
            default: null,
            sparse: true,
            unique: true,
            index: true,
        },
        onboardingCompleted: {
            type: Boolean,
            default: false,
        },
        onboardingUseCase: {
            type: String,
            default: null,
            trim: true,
        },
        onboardingWebsiteUrl: {
            type: String,
            default: null,
            trim: true,
        },
    },
    {
        timestamps: true,
    },
);

const UserModel: Model<UserDoc> =
    (mongoose.models.User as Model<UserDoc> | undefined) ||
    mongoose.model<UserDoc>("User", userSchema);

function normalizePlan(plan: unknown): string {
    if (typeof plan === "string" && plan.trim()) {
        return plan.trim().toLowerCase();
    }
    return "free";
}

function normalizeSubscriptionStatus(status: unknown): SubscriptionStatus {
    if (
        status === "none" ||
        status === "pending" ||
        status === "active" ||
        status === "past_due" ||
        status === "canceled"
    ) {
        return status;
    }
    return "none";
}

function mapUserDocToRecord(user: UserDoc): UserRecord {
    return {
        emailVerified: user.emailVerified ? user.emailVerified.toISOString() : null,
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        passwordHash: user.passwordHash,
        googleId: user.googleId ?? null,
        image: user.image ?? null,
        createdAt: user.createdAt.toISOString(),
        roleIds: user.roleIds?.map((id) => id.toString()),
        plan: normalizePlan(user.plan),
        subscriptionStatus: normalizeSubscriptionStatus(user.subscriptionStatus),
        stripeCustomerId: user.stripeCustomerId ?? null,
        stripeSubscriptionId: user.stripeSubscriptionId ?? null,
        onboardingCompleted: user.onboardingCompleted !== false,
        onboardingUseCase: user.onboardingUseCase ?? null,
        onboardingWebsiteUrl: user.onboardingWebsiteUrl ?? null,
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
        plan: normalizePlan(user.plan),
        subscriptionStatus: normalizeSubscriptionStatus(user.subscriptionStatus),
        onboardingCompleted: user.onboardingCompleted !== false,
    };
}

export function isGoogleOnlyUser(user: UserRecord): boolean {
    return Boolean(user.googleId) && !user.passwordHash;
}

export async function findUserByEmail(email: string): Promise<UserRecord | null> {
    await ensureDbConnection();
    const normalized = normalizeEmail(email);
    const user = await UserModel.findOne({ email: normalized }).lean<UserDoc | null>();

    return user ? mapUserDocToRecord(user) : null;
}

export async function findUserByGoogleId(googleId: string): Promise<UserRecord | null> {
    await ensureDbConnection();
    const user = await UserModel.findOne({ googleId }).lean<UserDoc | null>();
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
                onboardingCompleted: true,
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
        onboardingCompleted: false,
    });

    return mapUserDocToRecord(created.toObject() as UserDoc);
}

export async function createGoogleUser(input: {
    email: string;
    name: string;
    googleId: string;
    image?: string;
}): Promise<UserRecord> {
    await ensureDbConnection();
    const normalized = normalizeEmail(input.email);

    const created = await UserModel.create({
        email: normalized,
        name: input.name.trim(),
        googleId: input.googleId,
        image: input.image ?? null,
        emailVerified: new Date(),
        onboardingCompleted: false,
    });

    return mapUserDocToRecord(created.toObject() as UserDoc);
}

export async function linkGoogleAccount(
    userId: string,
    input: { googleId: string; image?: string; name?: string },
): Promise<UserRecord | null> {
    if (!Types.ObjectId.isValid(userId)) return null;
    await ensureDbConnection();

    const $set: Record<string, unknown> = {
        googleId: input.googleId,
        emailVerified: new Date(),
    };
    if (input.image) $set.image = input.image;
    if (input.name?.trim()) $set.name = input.name.trim();

    const updated = await UserModel.findByIdAndUpdate(userId, { $set }, { new: true }).lean<UserDoc | null>();
    return updated ? mapUserDocToRecord(updated) : null;
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
    plan: string;
    subscriptionStatus: SubscriptionStatus;
    stripeCustomerId: string | null;
    stripeSubscriptionId: string | null;
};

export async function listUsersForAdmin(): Promise<AdminUserListRow[]> {
    await ensureDbConnection();
    const docs = await UserModel.find({})
        .select(
            "_id email name createdAt emailVerified roleIds plan subscriptionStatus stripeCustomerId stripeSubscriptionId",
        )
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
            plan: normalizePlan(d.plan),
            subscriptionStatus: normalizeSubscriptionStatus(d.subscriptionStatus),
            stripeCustomerId: d.stripeCustomerId ?? null,
            stripeSubscriptionId: d.stripeSubscriptionId ?? null,
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
        plan: normalizePlan(u.plan),
        subscriptionStatus: normalizeSubscriptionStatus(u.subscriptionStatus),
        stripeCustomerId: u.stripeCustomerId ?? null,
        stripeSubscriptionId: u.stripeSubscriptionId ?? null,
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

export async function findUserByStripeCustomerId(customerId: string): Promise<UserRecord | null> {
    if (!customerId) return null;
    await ensureDbConnection();
    const user = await UserModel.findOne({ stripeCustomerId: customerId }).lean<UserDoc | null>();
    return user ? mapUserDocToRecord(user) : null;
}

export async function findUserByStripeSubscriptionId(subscriptionId: string): Promise<UserRecord | null> {
    if (!subscriptionId) return null;
    await ensureDbConnection();
    const user = await UserModel.findOne({ stripeSubscriptionId: subscriptionId }).lean<UserDoc | null>();
    return user ? mapUserDocToRecord(user) : null;
}

export type UserBillingPatch = {
    plan?: string;
    subscriptionStatus?: SubscriptionStatus;
    stripeCustomerId?: string | null;
    stripeSubscriptionId?: string | null;
};

export async function updateUserBilling(
    userId: string,
    patch: UserBillingPatch,
): Promise<UserRecord | null> {
    if (!Types.ObjectId.isValid(userId)) return null;
    await ensureDbConnection();

    const $set: Record<string, unknown> = {};
    if (patch.plan !== undefined) $set.plan = patch.plan;
    if (patch.subscriptionStatus !== undefined) $set.subscriptionStatus = patch.subscriptionStatus;
    if (patch.stripeCustomerId !== undefined) $set.stripeCustomerId = patch.stripeCustomerId;
    if (patch.stripeSubscriptionId !== undefined) $set.stripeSubscriptionId = patch.stripeSubscriptionId;

    if (Object.keys($set).length === 0) {
        return findUserById(userId);
    }

    const updated = await UserModel.findByIdAndUpdate(userId, { $set }, { new: true }).lean<UserDoc | null>();
    return updated ? mapUserDocToRecord(updated) : null;
}

export type OnboardingPatch = {
    useCase?: string | null;
    websiteUrl?: string | null;
};

/** Mark first-run onboarding finished (or skipped). Idempotent. */
export async function completeUserOnboarding(
    userId: string,
    patch: OnboardingPatch = {},
): Promise<UserRecord | null> {
    if (!Types.ObjectId.isValid(userId)) return null;
    await ensureDbConnection();

    const $set: Record<string, unknown> = {
        onboardingCompleted: true,
    };
    if (patch.useCase !== undefined) {
        const trimmed = patch.useCase?.trim() || null;
        $set.onboardingUseCase = trimmed;
    }
    if (patch.websiteUrl !== undefined) {
        const trimmed = patch.websiteUrl?.trim() || null;
        $set.onboardingWebsiteUrl = trimmed;
    }

    const updated = await UserModel.findByIdAndUpdate(userId, { $set }, { new: true }).lean<UserDoc | null>();
    return updated ? mapUserDocToRecord(updated) : null;
}

/**
 * One-shot backfill for accounts that predate the wizard.
 * Only sets completed when the field is missing — new signups store `false`
 * explicitly and must not be overwritten by seed on later logins.
 */
export async function backfillOnboardingCompletedForExistingUsers(): Promise<number> {
    await ensureDbConnection();
    const result = await UserModel.updateMany(
        { onboardingCompleted: { $exists: false } },
        { $set: { onboardingCompleted: true } },
    );
    return result.modifiedCount;
}
