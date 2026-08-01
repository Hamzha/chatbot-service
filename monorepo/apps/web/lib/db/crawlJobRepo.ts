import { getMongoDbUri } from "@repo/auth/lib/env";
import mongoose, { Model, Schema, Types } from "mongoose";
import { connectToDatabase } from "@/lib/db/client";

export type CrawlJobState = "queued" | "running" | "completed" | "failed";

export type CrawlJobUrlStatus = "visiting" | "done" | "failed";

export type CrawlJobUrlRow = {
    url: string;
    depth: number;
    status: CrawlJobUrlStatus;
    chunks?: number;
    error?: string;
    at: string;
};

export type CrawlJobIngestedPage = {
    url: string;
    displaySource: string;
    ragSourceKey: string;
    ingested: number;
};

export type CrawlJobRecord = {
    id: string;
    userId: string;
    startUrl: string;
    mode: string;
    maxPages: number;
    maxDepth: number;
    state: CrawlJobState;
    doneCount: number;
    failedCount: number;
    urls: CrawlJobUrlRow[];
    ingestedPages: CrawlJobIngestedPage[];
    error?: string;
    createdAt: string;
    updatedAt: string;
    startedAt?: string;
    finishedAt?: string;
};

type CrawlJobDoc = {
    _id: Types.ObjectId;
    userId: Types.ObjectId;
    startUrl: string;
    mode: string;
    maxPages: number;
    maxDepth: number;
    state: CrawlJobState;
    doneCount: number;
    failedCount: number;
    urls: Array<{
        url: string;
        depth: number;
        status: CrawlJobUrlStatus;
        chunks?: number;
        error?: string;
        at: Date;
    }>;
    ingestedPages: CrawlJobIngestedPage[];
    error?: string;
    createdAt: Date;
    updatedAt: Date;
    startedAt?: Date;
    finishedAt?: Date;
};

const urlRowSchema = new Schema<CrawlJobDoc["urls"][number]>(
    {
        url: { type: String, required: true, trim: true },
        depth: { type: Number, required: true, min: 0 },
        status: {
            type: String,
            enum: ["visiting", "done", "failed"],
            required: true,
        },
        chunks: { type: Number, min: 0 },
        error: { type: String },
        at: { type: Date, required: true, default: () => new Date() },
    },
    { _id: false },
);

const ingestedPageSchema = new Schema<CrawlJobIngestedPage>(
    {
        url: { type: String, required: true },
        displaySource: { type: String, required: true },
        ragSourceKey: { type: String, required: true },
        ingested: { type: Number, required: true, min: 0 },
    },
    { _id: false },
);

const crawlJobSchema = new Schema<CrawlJobDoc>(
    {
        userId: {
            type: Schema.Types.ObjectId,
            required: true,
            ref: "User",
            index: true,
        },
        startUrl: { type: String, required: true, trim: true },
        mode: { type: String, required: true, trim: true },
        maxPages: { type: Number, required: true, min: 1, max: 500 },
        maxDepth: { type: Number, required: true, min: 1, max: 20 },
        state: {
            type: String,
            enum: ["queued", "running", "completed", "failed"],
            default: "queued",
            index: true,
        },
        doneCount: { type: Number, default: 0, min: 0 },
        failedCount: { type: Number, default: 0, min: 0 },
        urls: { type: [urlRowSchema], default: [] },
        ingestedPages: { type: [ingestedPageSchema], default: [] },
        error: { type: String },
        startedAt: { type: Date },
        finishedAt: { type: Date },
    },
    { timestamps: true },
);

crawlJobSchema.index({ userId: 1, createdAt: -1 });

export const CrawlJobModel: Model<CrawlJobDoc> =
    (mongoose.models.CrawlJob as Model<CrawlJobDoc> | undefined) ||
    mongoose.model<CrawlJobDoc>("CrawlJob", crawlJobSchema);

async function ensureDbConnection(): Promise<void> {
    await connectToDatabase(getMongoDbUri());
}

function mapDoc(r: CrawlJobDoc): CrawlJobRecord {
    return {
        id: r._id.toString(),
        userId: r.userId.toString(),
        startUrl: r.startUrl,
        mode: r.mode,
        maxPages: r.maxPages,
        maxDepth: r.maxDepth,
        state: r.state,
        doneCount: r.doneCount,
        failedCount: r.failedCount,
        urls: (r.urls ?? []).map((u) => ({
            url: u.url,
            depth: u.depth,
            status: u.status,
            chunks: u.chunks,
            error: u.error,
            at: u.at instanceof Date ? u.at.toISOString() : new Date(u.at).toISOString(),
        })),
        ingestedPages: r.ingestedPages ?? [],
        error: r.error,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
        startedAt: r.startedAt?.toISOString(),
        finishedAt: r.finishedAt?.toISOString(),
    };
}

export async function createCrawlJob(
    userId: string,
    input: { startUrl: string; mode: string; maxPages: number; maxDepth: number },
): Promise<CrawlJobRecord> {
    await ensureDbConnection();
    const created = await CrawlJobModel.create({
        userId: new Types.ObjectId(userId),
        startUrl: input.startUrl.trim(),
        mode: input.mode,
        maxPages: input.maxPages,
        maxDepth: input.maxDepth,
        state: "queued",
    });
    return mapDoc(created.toObject() as CrawlJobDoc);
}

export async function getCrawlJob(
    userId: string,
    jobId: string,
): Promise<CrawlJobRecord | null> {
    await ensureDbConnection();
    if (!Types.ObjectId.isValid(jobId)) return null;
    const doc = await CrawlJobModel.findOne({
        _id: new Types.ObjectId(jobId),
        userId: new Types.ObjectId(userId),
    }).lean<CrawlJobDoc | null>();
    return doc ? mapDoc(doc) : null;
}

export async function listCrawlJobsForUser(
    userId: string,
    limit = 20,
): Promise<CrawlJobRecord[]> {
    await ensureDbConnection();
    const clamped = Math.min(Math.max(1, limit), 100);
    const docs = await CrawlJobModel.find({ userId: new Types.ObjectId(userId) })
        .sort({ createdAt: -1 })
        .limit(clamped)
        .lean<CrawlJobDoc[]>();
    return docs.map(mapDoc);
}

export async function markCrawlJobRunning(jobId: string): Promise<void> {
    await ensureDbConnection();
    if (!Types.ObjectId.isValid(jobId)) return;
    await CrawlJobModel.updateOne(
        { _id: new Types.ObjectId(jobId), state: "queued" },
        { $set: { state: "running", startedAt: new Date() } },
    );
}

export async function appendVisitingUrl(
    jobId: string,
    url: string,
    depth: number,
): Promise<void> {
    await ensureDbConnection();
    if (!Types.ObjectId.isValid(jobId)) return;
    const result = await CrawlJobModel.updateOne(
        { _id: new Types.ObjectId(jobId), "urls.url": url },
        {
            $set: {
                "urls.$.status": "visiting" as CrawlJobUrlStatus,
                "urls.$.depth": depth,
                "urls.$.at": new Date(),
            },
        },
    );
    if (result.matchedCount === 0) {
        await CrawlJobModel.updateOne(
            { _id: new Types.ObjectId(jobId) },
            {
                $push: {
                    urls: {
                        url,
                        depth,
                        status: "visiting" as CrawlJobUrlStatus,
                        at: new Date(),
                    },
                },
            },
        );
    }
}

export async function markUrlDone(
    jobId: string,
    url: string,
    depth: number,
    chunks: number | undefined,
): Promise<void> {
    await ensureDbConnection();
    if (!Types.ObjectId.isValid(jobId)) return;
    const setFields: Record<string, unknown> = {
        "urls.$.status": "done" as CrawlJobUrlStatus,
        "urls.$.depth": depth,
        "urls.$.at": new Date(),
    };
    if (typeof chunks === "number") setFields["urls.$.chunks"] = chunks;
    const result = await CrawlJobModel.updateOne(
        { _id: new Types.ObjectId(jobId), "urls.url": url },
        { $set: setFields, $inc: { doneCount: 1 } },
    );
    if (result.matchedCount === 0) {
        await CrawlJobModel.updateOne(
            { _id: new Types.ObjectId(jobId) },
            {
                $push: {
                    urls: {
                        url,
                        depth,
                        status: "done" as CrawlJobUrlStatus,
                        chunks,
                        at: new Date(),
                    },
                },
                $inc: { doneCount: 1 },
            },
        );
    }
}

export async function markUrlFailed(
    jobId: string,
    url: string,
    error: string,
): Promise<void> {
    await ensureDbConnection();
    if (!Types.ObjectId.isValid(jobId)) return;
    const result = await CrawlJobModel.updateOne(
        { _id: new Types.ObjectId(jobId), "urls.url": url },
        {
            $set: {
                "urls.$.status": "failed" as CrawlJobUrlStatus,
                "urls.$.error": error,
                "urls.$.at": new Date(),
            },
            $inc: { failedCount: 1 },
        },
    );
    if (result.matchedCount === 0) {
        await CrawlJobModel.updateOne(
            { _id: new Types.ObjectId(jobId) },
            {
                $push: {
                    urls: {
                        url,
                        depth: 0,
                        status: "failed" as CrawlJobUrlStatus,
                        error,
                        at: new Date(),
                    },
                },
                $inc: { failedCount: 1 },
            },
        );
    }
}

export async function appendIngestedPage(
    jobId: string,
    page: CrawlJobIngestedPage,
): Promise<void> {
    await ensureDbConnection();
    if (!Types.ObjectId.isValid(jobId)) return;
    await CrawlJobModel.updateOne(
        { _id: new Types.ObjectId(jobId) },
        { $push: { ingestedPages: page } },
    );
}

export async function markCrawlJobCompleted(jobId: string): Promise<void> {
    await ensureDbConnection();
    if (!Types.ObjectId.isValid(jobId)) return;
    await CrawlJobModel.updateOne(
        { _id: new Types.ObjectId(jobId) },
        { $set: { state: "completed", finishedAt: new Date() } },
    );
}

export async function markCrawlJobFailed(jobId: string, error: string): Promise<void> {
    await ensureDbConnection();
    if (!Types.ObjectId.isValid(jobId)) return;
    await CrawlJobModel.updateOne(
        { _id: new Types.ObjectId(jobId) },
        { $set: { state: "failed", finishedAt: new Date(), error } },
    );
}

/**
 * Reconcile jobs that were `running` when the Next.js process died (no worker will ever finish them).
 * Call on module import to mark abandoned jobs as failed. Optional TTL: jobs older than `staleAfterMs`
 * still in `running` state are flipped to `failed` with a descriptive error.
 */
export async function markStaleRunningJobsFailed(staleAfterMs: number): Promise<number> {
    await ensureDbConnection();
    const cutoff = new Date(Date.now() - staleAfterMs);
    const result = await CrawlJobModel.updateMany(
        { state: "running", updatedAt: { $lt: cutoff } },
        {
            $set: {
                state: "failed",
                finishedAt: new Date(),
                error: "Worker terminated before the crawl finished (server restart or crash).",
            },
        },
    );
    return result.modifiedCount ?? 0;
}
