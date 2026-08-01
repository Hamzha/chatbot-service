import { getMongoDbUri } from "@repo/auth/lib/env";
import mongoose, { Model, Schema, Types } from "mongoose";
import { connectToDatabase } from "@/lib/db/client";
import {
    DEFAULT_FEATURE_LIMITS,
    FEATURE_LIMIT_KEYS,
    type FeatureLimitKey,
    type FeatureLimitPeriod,
    type FeatureLimitValues,
} from "@/lib/limits/featureLimitTypes";

export type PlanSyncStatus = "draft" | "synced" | "error";
export type PlanInterval = "month" | "year";

export type SubscriptionPlanRecord = {
    id: string;
    name: string;
    slug: string;
    description: string;
    amountCents: number;
    currency: string;
    interval: PlanInterval;
    features: string[];
    limits: FeatureLimitValues;
    limitPeriod: FeatureLimitPeriod;
    active: boolean;
    sortOrder: number;
    highlighted: boolean;
    stripeProductId: string | null;
    stripePriceId: string | null;
    syncStatus: PlanSyncStatus;
    lastSyncError: string | null;
    lastSyncedAt: string | null;
    createdAt: string;
    updatedAt: string;
    updatedBy: string | null;
};

type PlanDoc = {
    _id: Types.ObjectId;
    name: string;
    slug: string;
    description?: string;
    amountCents: number;
    currency: string;
    interval: PlanInterval;
    features: string[];
    limits: FeatureLimitValues;
    limitPeriod: FeatureLimitPeriod;
    active: boolean;
    sortOrder: number;
    highlighted: boolean;
    stripeProductId?: string | null;
    stripePriceId?: string | null;
    syncStatus: PlanSyncStatus;
    lastSyncError?: string | null;
    lastSyncedAt?: Date | null;
    updatedBy?: Types.ObjectId | null;
    createdAt: Date;
    updatedAt: Date;
};

const limitValueSchema = {
    type: Number,
    default: null,
    validate: {
        validator: (v: unknown) =>
            v === null || (typeof v === "number" && Number.isFinite(v) && v >= 0),
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

const planSchema = new Schema<PlanDoc>(
    {
        name: { type: String, required: true, trim: true },
        slug: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
            index: true,
        },
        description: { type: String, default: "", trim: true },
        amountCents: { type: Number, required: true, min: 0 },
        currency: { type: String, required: true, default: "usd", lowercase: true, trim: true },
        interval: { type: String, enum: ["month", "year"], required: true, default: "month" },
        features: { type: [String], default: [] },
        limits: { type: new Schema(limitsShape, { _id: false }), required: true },
        limitPeriod: {
            type: String,
            enum: ["lifetime", "calendar_month"],
            required: true,
            default: "calendar_month",
        },
        active: { type: Boolean, default: true, index: true },
        sortOrder: { type: Number, default: 0 },
        highlighted: { type: Boolean, default: false },
        stripeProductId: { type: String, default: undefined, sparse: true, index: true },
        stripePriceId: { type: String, default: undefined, sparse: true, index: true },
        syncStatus: {
            type: String,
            enum: ["draft", "synced", "error"],
            default: "draft",
            index: true,
        },
        lastSyncError: { type: String, default: null },
        lastSyncedAt: { type: Date, default: null },
        updatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    },
    { timestamps: true },
);

const SubscriptionPlanModel: Model<PlanDoc> =
    (mongoose.models.SubscriptionPlan as Model<PlanDoc> | undefined) ||
    mongoose.model<PlanDoc>("SubscriptionPlan", planSchema);

async function ensureDb(): Promise<void> {
    await connectToDatabase(getMongoDbUri());
}

function normalizeLimitValue(raw: unknown): number | null {
    if (raw === null || raw === undefined || raw === "") return null;
    const n = typeof raw === "number" ? raw : Number(raw);
    if (!Number.isFinite(n) || n < 0) return null;
    return Math.floor(n);
}

export function normalizePlanLimits(
    partial: Partial<Record<string, unknown>> | null | undefined,
): FeatureLimitValues {
    const out = { ...DEFAULT_FEATURE_LIMITS };
    if (!partial) return out;
    for (const key of FEATURE_LIMIT_KEYS) {
        if (key in partial) {
            out[key] = normalizeLimitValue(partial[key]);
        }
    }
    return out;
}

function slugify(input: string): string {
    return input
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 64);
}

function mapPlan(doc: PlanDoc): SubscriptionPlanRecord {
    return {
        id: doc._id.toString(),
        name: doc.name,
        slug: doc.slug,
        description: doc.description ?? "",
        amountCents: doc.amountCents,
        currency: doc.currency,
        interval: doc.interval,
        features: doc.features ?? [],
        limits: normalizePlanLimits(doc.limits as Partial<Record<string, unknown>>),
        limitPeriod: doc.limitPeriod,
        active: Boolean(doc.active),
        sortOrder: doc.sortOrder ?? 0,
        highlighted: Boolean(doc.highlighted),
        stripeProductId: doc.stripeProductId ?? null,
        stripePriceId: doc.stripePriceId ?? null,
        syncStatus: doc.syncStatus,
        lastSyncError: doc.lastSyncError ?? null,
        lastSyncedAt: doc.lastSyncedAt ? doc.lastSyncedAt.toISOString() : null,
        createdAt: doc.createdAt.toISOString(),
        updatedAt: doc.updatedAt.toISOString(),
        updatedBy: doc.updatedBy ? doc.updatedBy.toString() : null,
    };
}

export type CreateSubscriptionPlanInput = {
    name: string;
    slug?: string;
    description?: string;
    amountCents: number;
    currency?: string;
    interval?: PlanInterval;
    features?: string[];
    limits: FeatureLimitValues;
    limitPeriod?: FeatureLimitPeriod;
    active?: boolean;
    sortOrder?: number;
    highlighted?: boolean;
    updatedBy: string;
};

export type UpdateSubscriptionPlanInput = Partial<
    Omit<CreateSubscriptionPlanInput, "updatedBy">
> & { updatedBy: string };

export async function listSubscriptionPlans(): Promise<SubscriptionPlanRecord[]> {
    await ensureDb();
    const docs = await SubscriptionPlanModel.find({})
        .sort({ sortOrder: 1, createdAt: 1 })
        .lean<PlanDoc[]>();
    return docs.map(mapPlan);
}

/** Active plans that have a Stripe price — safe to show on public Pricing. */
export async function listPublicSubscriptionPlans(): Promise<SubscriptionPlanRecord[]> {
    await ensureDb();
    const docs = await SubscriptionPlanModel.find({
        active: true,
        syncStatus: "synced",
        stripePriceId: { $ne: null },
    })
        .sort({ sortOrder: 1, createdAt: 1 })
        .lean<PlanDoc[]>();
    return docs.map(mapPlan);
}

export async function findSubscriptionPlanById(id: string): Promise<SubscriptionPlanRecord | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    await ensureDb();
    const doc = await SubscriptionPlanModel.findById(id).lean<PlanDoc | null>();
    return doc ? mapPlan(doc) : null;
}

export async function findSubscriptionPlanBySlug(slug: string): Promise<SubscriptionPlanRecord | null> {
    const normalized = slugify(slug);
    if (!normalized || normalized === "free") return null;
    await ensureDb();
    const doc = await SubscriptionPlanModel.findOne({ slug: normalized }).lean<PlanDoc | null>();
    return doc ? mapPlan(doc) : null;
}

export async function findSubscriptionPlanByStripePriceId(
    priceId: string,
): Promise<SubscriptionPlanRecord | null> {
    if (!priceId) return null;
    await ensureDb();
    const doc = await SubscriptionPlanModel.findOne({ stripePriceId: priceId }).lean<PlanDoc | null>();
    return doc ? mapPlan(doc) : null;
}

export async function createSubscriptionPlan(
    input: CreateSubscriptionPlanInput,
): Promise<SubscriptionPlanRecord> {
    await ensureDb();
    const slug = slugify(input.slug?.trim() || input.name);
    if (!slug || slug === "free") {
        throw new Error('Invalid plan slug. Use something other than "free".');
    }

    const existing = await SubscriptionPlanModel.findOne({ slug }).lean();
    if (existing) {
        throw new Error(`Plan slug "${slug}" already exists.`);
    }

    const updatedBy =
        Types.ObjectId.isValid(input.updatedBy) ? new Types.ObjectId(input.updatedBy) : null;

    const created = await SubscriptionPlanModel.create({
        name: input.name.trim(),
        slug,
        description: (input.description ?? "").trim(),
        amountCents: Math.floor(input.amountCents),
        currency: (input.currency ?? "usd").trim().toLowerCase(),
        interval: input.interval ?? "month",
        features: (input.features ?? []).map((f) => f.trim()).filter(Boolean),
        limits: normalizePlanLimits(input.limits),
        limitPeriod: input.limitPeriod ?? "calendar_month",
        active: input.active ?? true,
        sortOrder: input.sortOrder ?? 0,
        highlighted: input.highlighted ?? false,
        syncStatus: "draft",
        updatedBy,
    });

    return mapPlan(created.toObject() as PlanDoc);
}

export async function updateSubscriptionPlan(
    id: string,
    input: UpdateSubscriptionPlanInput,
): Promise<SubscriptionPlanRecord | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    await ensureDb();

    const $set: Record<string, unknown> = {
        updatedBy: Types.ObjectId.isValid(input.updatedBy)
            ? new Types.ObjectId(input.updatedBy)
            : null,
    };

    if (input.name !== undefined) $set.name = input.name.trim();
    if (input.slug !== undefined) {
        const slug = slugify(input.slug);
        if (!slug || slug === "free") {
            throw new Error('Invalid plan slug. Use something other than "free".');
        }
        $set.slug = slug;
    }
    if (input.description !== undefined) $set.description = input.description.trim();
    if (input.amountCents !== undefined) $set.amountCents = Math.floor(input.amountCents);
    if (input.currency !== undefined) $set.currency = input.currency.trim().toLowerCase();
    if (input.interval !== undefined) $set.interval = input.interval;
    if (input.features !== undefined) {
        $set.features = input.features.map((f) => f.trim()).filter(Boolean);
    }
    if (input.limits !== undefined) $set.limits = normalizePlanLimits(input.limits);
    if (input.limitPeriod !== undefined) $set.limitPeriod = input.limitPeriod;
    if (input.active !== undefined) $set.active = input.active;
    if (input.sortOrder !== undefined) $set.sortOrder = input.sortOrder;
    if (input.highlighted !== undefined) $set.highlighted = input.highlighted;

    // Local edits after a sync mark the plan dirty until re-synced (price/product may be stale).
    if (
        input.name !== undefined ||
        input.description !== undefined ||
        input.amountCents !== undefined ||
        input.currency !== undefined ||
        input.interval !== undefined
    ) {
        const current = await SubscriptionPlanModel.findById(id).lean<PlanDoc | null>();
        if (current?.syncStatus === "synced") {
            $set.syncStatus = "draft";
        }
    }

    try {
        const updated = await SubscriptionPlanModel.findByIdAndUpdate(
            id,
            { $set },
            { new: true, runValidators: true },
        ).lean<PlanDoc | null>();
        return updated ? mapPlan(updated) : null;
    } catch (err) {
        if (err && typeof err === "object" && "code" in err && (err as { code: number }).code === 11000) {
            throw new Error("Plan slug or Stripe price already exists.");
        }
        throw err;
    }
}

export async function markPlanSyncResult(
    id: string,
    result:
        | {
              ok: true;
              stripeProductId: string;
              stripePriceId: string;
          }
        | { ok: false; error: string },
): Promise<SubscriptionPlanRecord | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    await ensureDb();

    const $set = result.ok
        ? {
              stripeProductId: result.stripeProductId,
              stripePriceId: result.stripePriceId,
              syncStatus: "synced" as const,
              lastSyncError: null,
              lastSyncedAt: new Date(),
          }
        : {
              syncStatus: "error" as const,
              lastSyncError: result.error,
          };

    const updated = await SubscriptionPlanModel.findByIdAndUpdate(
        id,
        { $set },
        { new: true },
    ).lean<PlanDoc | null>();
    return updated ? mapPlan(updated) : null;
}

export async function deleteSubscriptionPlan(id: string): Promise<boolean> {
    if (!Types.ObjectId.isValid(id)) return false;
    await ensureDb();
    const res = await SubscriptionPlanModel.deleteOne({ _id: new Types.ObjectId(id) });
    return res.deletedCount > 0;
}

export type { FeatureLimitKey };
