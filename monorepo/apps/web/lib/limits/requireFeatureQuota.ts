import { NextResponse } from "next/server";
import mongoose, { Schema, Types, type Model } from "mongoose";
import { getMongoDbUri } from "@repo/auth/lib/env";
import { connectToDatabase } from "@/lib/db/client";
import {
    FEATURE_LIMIT_KEYS,
    type FeatureLimitKey,
    type FeatureLimitPeriod,
    resolveEffectiveFeatureLimits,
} from "@/lib/db/featureLimitRepo";
// Side-effect imports so mongoose.models.* exist when counting.
import "@/lib/db/crawlJobRepo";
import "@/lib/db/chatbotDocumentRepo";
import "@/lib/db/chatSessionRepo";
import "@/lib/db/chatbotMessageRepo";
import "@/lib/db/widgetMessageRepo";

type ScrapeRunDoc = {
    _id: Types.ObjectId;
    userId: Types.ObjectId;
    createdAt: Date;
};

const scrapeRunSchema = new Schema<ScrapeRunDoc>(
    {
        userId: { type: Schema.Types.ObjectId, required: true, index: true, ref: "User" },
    },
    { timestamps: { createdAt: true, updatedAt: false } },
);

const ScrapeRunModel: Model<ScrapeRunDoc> =
    (mongoose.models.ScrapeRun as Model<ScrapeRunDoc> | undefined) ||
    mongoose.model<ScrapeRunDoc>("ScrapeRun", scrapeRunSchema);

function monthStartUtc(now = new Date()): Date {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
}

function periodFilter(period: FeatureLimitPeriod): { createdAt?: { $gte: Date } } {
    if (period === "calendar_month") {
        return { createdAt: { $gte: monthStartUtc() } };
    }
    return {};
}

async function ensureDb(): Promise<void> {
    await connectToDatabase(getMongoDbUri());
}

async function countScraperRuns(userId: string, period: FeatureLimitPeriod): Promise<number> {
    await ensureDb();
    const uid = new Types.ObjectId(userId);
    const pf = periodFilter(period);
    const CrawlJob = mongoose.models.CrawlJob;
    const [jobs, oneShots] = await Promise.all([
        CrawlJob ? CrawlJob.countDocuments({ userId: uid, ...pf }) : Promise.resolve(0),
        ScrapeRunModel.countDocuments({ userId: uid, ...pf }),
    ]);
    return jobs + oneShots;
}

/** Record a one-shot scrape against the shared scraper quota. */
export async function recordScrapeRun(userId: string): Promise<void> {
    if (!Types.ObjectId.isValid(userId)) return;
    await ensureDb();
    await ScrapeRunModel.create({ userId: new Types.ObjectId(userId) });
}

async function countDocumentUploads(userId: string, period: FeatureLimitPeriod): Promise<number> {
    await ensureDb();
    const Model = mongoose.models.ChatbotDocument;
    if (!Model) return 0;
    return Model.countDocuments({
        userId: new Types.ObjectId(userId),
        kind: "upload",
        ...periodFilter(period),
    });
}

async function countBotsCreated(userId: string, period: FeatureLimitPeriod): Promise<number> {
    await ensureDb();
    const Model = mongoose.models.ChatbotChatSession;
    if (!Model) return 0;
    return Model.countDocuments({
        userId: new Types.ObjectId(userId),
        ...periodFilter(period),
    });
}

async function countDashboardChats(userId: string, period: FeatureLimitPeriod): Promise<number> {
    await ensureDb();
    const Model = mongoose.models.ChatbotMessage;
    if (!Model) return 0;
    return Model.countDocuments({
        userId: new Types.ObjectId(userId),
        role: "user",
        ...periodFilter(period),
    });
}

async function countWidgetChats(ownerUserId: string, period: FeatureLimitPeriod): Promise<number> {
    await ensureDb();
    const Session = mongoose.models.ChatbotChatSession;
    const Message = mongoose.models.WidgetMessage;
    if (!Session || !Message) return 0;
    const bots = await Session.find({ userId: new Types.ObjectId(ownerUserId) })
        .select("_id")
        .lean<{ _id: Types.ObjectId }[]>();
    if (bots.length === 0) return 0;
    return Message.countDocuments({
        botId: { $in: bots.map((b) => b._id) },
        role: "user",
        ...periodFilter(period),
    });
}

export async function getFeatureUsage(
    userId: string,
    key: FeatureLimitKey,
    period: FeatureLimitPeriod,
): Promise<number> {
    switch (key) {
        case "scraperRuns":
            return countScraperRuns(userId, period);
        case "documentUploads":
            return countDocumentUploads(userId, period);
        case "botsCreated":
            return countBotsCreated(userId, period);
        case "dashboardChats":
            return countDashboardChats(userId, period);
        case "widgetChats":
            return countWidgetChats(userId, period);
        default:
            return 0;
    }
}

export type QuotaSnapshot = {
    key: FeatureLimitKey;
    limit: number | null;
    used: number;
    remaining: number | null;
    period: FeatureLimitPeriod;
};

export async function getQuotaSnapshot(userId: string, key: FeatureLimitKey): Promise<QuotaSnapshot> {
    const { period, limits } = await resolveEffectiveFeatureLimits(userId);
    const limit = limits[key];
    const used = await getFeatureUsage(userId, key, period);
    const remaining = limit === null ? null : Math.max(0, limit - used);
    return { key, limit, used, remaining, period };
}

export async function getAllQuotaSnapshots(userId: string): Promise<QuotaSnapshot[]> {
    const { period, limits } = await resolveEffectiveFeatureLimits(userId);
    const snapshots: QuotaSnapshot[] = [];
    for (const key of FEATURE_LIMIT_KEYS) {
        const used = await getFeatureUsage(userId, key, period);
        const limit = limits[key];
        snapshots.push({
            key,
            limit,
            used,
            remaining: limit === null ? null : Math.max(0, limit - used),
            period,
        });
    }
    return snapshots;
}

/**
 * Returns a 403 NextResponse when the user is at/over quota for `key`.
 * `null` means allowed (including unlimited).
 */
export async function requireFeatureQuota(
    userId: string,
    key: FeatureLimitKey,
): Promise<NextResponse | null> {
    const snap = await getQuotaSnapshot(userId, key);
    if (snap.limit === null) return null;
    if (snap.used < snap.limit) return null;

    const periodLabel = snap.period === "calendar_month" ? "this month" : "on your trial";
    return NextResponse.json(
        {
            error: `Trial limit reached for ${key}: ${snap.used}/${snap.limit} used ${periodLabel}.`,
            code: "FEATURE_LIMIT_REACHED",
            quota: snap,
        },
        { status: 403 },
    );
}
