import { getMongoDbUri } from "@repo/auth/lib/env";
import mongoose, { Model, Schema, Types } from "mongoose";
import { connectToDatabase } from "@/lib/db/client";
import { findUserById } from "@/lib/db/userRepo";
import { hasActivePaidAccess, resolvePlanLimitsBySlug } from "@/lib/billing/plans";
import {
    DEFAULT_FEATURE_LIMITS,
    FEATURE_LIMIT_KEYS,
    type FeatureLimitKey,
    type FeatureLimitPeriod,
    type FeatureLimitValues,
} from "@/lib/limits/featureLimitTypes";

export {
    DEFAULT_FEATURE_LIMITS,
    FEATURE_LIMIT_KEYS,
    FEATURE_LIMIT_LABELS,
    type FeatureLimitKey,
    type FeatureLimitPeriod,
    type FeatureLimitValues,
} from "@/lib/limits/featureLimitTypes";

export type FeatureLimitDefaultsRecord = {
    id: string;
    period: FeatureLimitPeriod;
    limits: FeatureLimitValues;
    updatedAt: string;
    updatedBy: string | null;
};

export type UserFeatureLimitOverrideRecord = {
    userId: string;
    limits: Partial<FeatureLimitValues>;
    updatedAt: string;
    updatedBy: string | null;
};

const GLOBAL_ID = "global";

type DefaultsDoc = {
    _id: string;
    period: FeatureLimitPeriod;
    limits: FeatureLimitValues;
    updatedAt: Date;
    updatedBy?: Types.ObjectId | null;
};

type OverrideDoc = {
    _id: Types.ObjectId;
    userId: Types.ObjectId;
    limits: Partial<FeatureLimitValues>;
    updatedAt: Date;
    updatedBy?: Types.ObjectId | null;
};

const limitValueSchema = {
    type: Number,
    default: null,
    /** Allow null (unlimited) or non-negative integers. */
    validate: {
        validator: (v: unknown) => v === null || (typeof v === "number" && Number.isFinite(v) && v >= 0),
        message: "Limit must be null or a non-negative number",
    },
};

const limitsShape = {
    scraperRuns: limitValueSchema,
    documentUploads: limitValueSchema,
    botsCreated: limitValueSchema,
    dashboardChats: limitValueSchema,
    widgetChats: limitValueSchema,
};

const defaultsSchema = new Schema<DefaultsDoc>(
    {
        _id: { type: String, required: true },
        period: { type: String, enum: ["lifetime", "calendar_month"], required: true },
        limits: { type: new Schema(limitsShape, { _id: false }), required: true },
        updatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    },
    { timestamps: { createdAt: false, updatedAt: true }, _id: false },
);

const overrideSchema = new Schema<OverrideDoc>(
    {
        userId: { type: Schema.Types.ObjectId, required: true, unique: true, ref: "User", index: true },
        limits: { type: new Schema(limitsShape, { _id: false, strict: false }), required: true },
        updatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    },
    { timestamps: { createdAt: false, updatedAt: true } },
);

const FeatureLimitDefaultsModel: Model<DefaultsDoc> =
    (mongoose.models.FeatureLimitDefaults as Model<DefaultsDoc> | undefined) ||
    mongoose.model<DefaultsDoc>("FeatureLimitDefaults", defaultsSchema);

const UserFeatureLimitOverrideModel: Model<OverrideDoc> =
    (mongoose.models.UserFeatureLimitOverride as Model<OverrideDoc> | undefined) ||
    mongoose.model<OverrideDoc>("UserFeatureLimitOverride", overrideSchema);

async function ensureDbConnection(): Promise<void> {
    await connectToDatabase(getMongoDbUri());
}

function normalizeLimitValue(raw: unknown): number | null {
    if (raw === null || raw === undefined || raw === "") return null;
    const n = typeof raw === "number" ? raw : Number(raw);
    if (!Number.isFinite(n) || n < 0) return null;
    return Math.floor(n);
}

export function normalizeFeatureLimits(partial: Partial<Record<string, unknown>> | null | undefined): FeatureLimitValues {
    const out = { ...DEFAULT_FEATURE_LIMITS };
    if (!partial) return out;
    for (const key of FEATURE_LIMIT_KEYS) {
        if (key in partial) {
            out[key] = normalizeLimitValue(partial[key]);
        }
    }
    return out;
}

export function normalizePartialFeatureLimits(
    partial: Partial<Record<string, unknown>> | null | undefined,
): Partial<FeatureLimitValues> {
    const out: Partial<FeatureLimitValues> = {};
    if (!partial) return out;
    for (const key of FEATURE_LIMIT_KEYS) {
        if (key in partial) {
            out[key] = normalizeLimitValue(partial[key]);
        }
    }
    return out;
}

function mapDefaults(doc: DefaultsDoc): FeatureLimitDefaultsRecord {
    return {
        id: doc._id,
        period: doc.period,
        limits: normalizeFeatureLimits(doc.limits),
        updatedAt: doc.updatedAt.toISOString(),
        updatedBy: doc.updatedBy ? doc.updatedBy.toString() : null,
    };
}

function mapOverride(doc: OverrideDoc): UserFeatureLimitOverrideRecord {
    return {
        userId: doc.userId.toString(),
        limits: normalizePartialFeatureLimits(doc.limits as Partial<Record<string, unknown>>),
        updatedAt: doc.updatedAt.toISOString(),
        updatedBy: doc.updatedBy ? doc.updatedBy.toString() : null,
    };
}

export async function getFeatureLimitDefaults(): Promise<FeatureLimitDefaultsRecord> {
    await ensureDbConnection();
    let doc = await FeatureLimitDefaultsModel.findById(GLOBAL_ID).lean<DefaultsDoc | null>();
    if (!doc) {
        await FeatureLimitDefaultsModel.updateOne(
            { _id: GLOBAL_ID },
            {
                $setOnInsert: {
                    _id: GLOBAL_ID,
                    period: "lifetime",
                    limits: DEFAULT_FEATURE_LIMITS,
                    updatedBy: null,
                },
            },
            { upsert: true },
        );
        doc = await FeatureLimitDefaultsModel.findById(GLOBAL_ID).lean<DefaultsDoc | null>();
    }
    if (!doc) {
        return {
            id: GLOBAL_ID,
            period: "lifetime",
            limits: { ...DEFAULT_FEATURE_LIMITS },
            updatedAt: new Date().toISOString(),
            updatedBy: null,
        };
    }
    return mapDefaults(doc);
}

export async function updateFeatureLimitDefaults(input: {
    period: FeatureLimitPeriod;
    limits: FeatureLimitValues;
    updatedBy: string;
}): Promise<FeatureLimitDefaultsRecord> {
    await ensureDbConnection();
    const updatedBy =
        Types.ObjectId.isValid(input.updatedBy) ? new Types.ObjectId(input.updatedBy) : null;
    const doc = await FeatureLimitDefaultsModel.findByIdAndUpdate(
        GLOBAL_ID,
        {
            $set: {
                period: input.period,
                limits: normalizeFeatureLimits(input.limits),
                updatedBy,
            },
        },
        { new: true, upsert: true, setDefaultsOnInsert: true },
    ).lean<DefaultsDoc | null>();
    if (!doc) throw new Error("Failed to update feature limit defaults.");
    return mapDefaults(doc);
}

export async function getUserFeatureLimitOverride(
    userId: string,
): Promise<UserFeatureLimitOverrideRecord | null> {
    if (!Types.ObjectId.isValid(userId)) return null;
    await ensureDbConnection();
    const doc = await UserFeatureLimitOverrideModel.findOne({
        userId: new Types.ObjectId(userId),
    }).lean<OverrideDoc | null>();
    return doc ? mapOverride(doc) : null;
}

export async function upsertUserFeatureLimitOverride(input: {
    userId: string;
    limits: Partial<FeatureLimitValues>;
    updatedBy: string;
}): Promise<UserFeatureLimitOverrideRecord> {
    if (!Types.ObjectId.isValid(input.userId)) {
        throw new Error("Invalid user id.");
    }
    await ensureDbConnection();
    const updatedBy =
        Types.ObjectId.isValid(input.updatedBy) ? new Types.ObjectId(input.updatedBy) : null;
    const doc = await UserFeatureLimitOverrideModel.findOneAndUpdate(
        { userId: new Types.ObjectId(input.userId) },
        {
            $set: {
                limits: normalizePartialFeatureLimits(input.limits),
                updatedBy,
            },
        },
        { new: true, upsert: true, setDefaultsOnInsert: true },
    ).lean<OverrideDoc | null>();
    if (!doc) throw new Error("Failed to upsert user feature limits.");
    return mapOverride(doc);
}

export async function clearUserFeatureLimitOverride(userId: string): Promise<boolean> {
    if (!Types.ObjectId.isValid(userId)) return false;
    await ensureDbConnection();
    const res = await UserFeatureLimitOverrideModel.deleteOne({ userId: new Types.ObjectId(userId) });
    return res.deletedCount > 0;
}

export async function resolveEffectiveFeatureLimits(userId: string): Promise<{
    period: FeatureLimitPeriod;
    limits: FeatureLimitValues;
    override: UserFeatureLimitOverrideRecord | null;
    plan: string;
    subscriptionStatus: string;
}> {
    const [defaults, override, user] = await Promise.all([
        getFeatureLimitDefaults(),
        getUserFeatureLimitOverride(userId),
        findUserById(userId),
    ]);

    const plan = user?.plan ?? "free";
    const subscriptionStatus = user?.subscriptionStatus ?? "none";

    let period = defaults.period;
    let limits = { ...defaults.limits };

    if (hasActivePaidAccess(plan, subscriptionStatus)) {
        const paid = await resolvePlanLimitsBySlug(plan);
        if (paid) {
            limits = { ...paid.limits };
            period = paid.period;
        }
    }

    if (override) {
        for (const key of FEATURE_LIMIT_KEYS) {
            if (key in override.limits) {
                limits[key] = override.limits[key] ?? null;
            }
        }
    }
    return { period, limits, override, plan, subscriptionStatus };
}
