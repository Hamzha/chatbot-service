import { getMongoDbUri } from "@repo/auth/lib/env";
import mongoose, { Model, Schema } from "mongoose";
import { connectToDatabase } from "@/lib/db/client";

type RateLimitDoc = {
    _id: string;
    count: number;
    expiresAt: Date;
};

const rateLimitSchema = new Schema<RateLimitDoc>(
    {
        _id: { type: String, required: true },
        count: { type: Number, required: true, default: 0 },
        expiresAt: { type: Date, required: true },
    },
    { _id: false, versionKey: false },
);

rateLimitSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const RateLimitModel: Model<RateLimitDoc> =
    (mongoose.models.RateLimit as Model<RateLimitDoc> | undefined) ||
    mongoose.model<RateLimitDoc>("RateLimit", rateLimitSchema);

async function ensureDbConnection(): Promise<void> {
    await connectToDatabase(getMongoDbUri());
}

export type ConsumeResult = {
    allowed: boolean;
    count: number;
    limit: number;
    resetAt: number;
};

export async function consumeRateLimit(
    bucket: string,
    key: string,
    limit: number,
    windowSec: number,
): Promise<ConsumeResult> {
    await ensureDbConnection();
    const now = Date.now();
    const windowMs = windowSec * 1000;
    const windowIndex = Math.floor(now / windowMs);
    const resetAt = (windowIndex + 1) * windowMs;
    const docId = `${bucket}:${key}:${windowIndex}`;

    const doc = await RateLimitModel.findOneAndUpdate(
        { _id: docId },
        { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date(resetAt + 60_000) } },
        { upsert: true, new: true },
    ).lean<RateLimitDoc>();

    const count = doc?.count ?? 1;
    return {
        allowed: count <= limit,
        count,
        limit,
        resetAt,
    };
}
