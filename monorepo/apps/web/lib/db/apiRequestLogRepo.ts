import mongoose, { Model, Schema, Types } from "mongoose";
import { getMongoDbUri } from "@repo/auth/lib/env";
import { connectToDatabase } from "@/lib/db/client";

export type ApiRequestLogRecord = {
    id: string;
    requestId: string;
    method: string;
    route: string;
    status: number;
    success: boolean;
    durationMs: number;
    occurredAt: string;
    userId: string | null;
    userEmail: string | null;
    ip: string | null;
    userAgent: string | null;
    errorMessage: string | null;
};

type ApiRequestLogDoc = {
    _id: Types.ObjectId;
    requestId: string;
    method: string;
    route: string;
    status: number;
    success: boolean;
    durationMs: number;
    occurredAt: Date;
    userId?: string | null;
    userEmail?: string | null;
    ip?: string | null;
    userAgent?: string | null;
    errorMessage?: string | null;
    createdAt: Date;
    updatedAt: Date;
};

const apiRequestLogSchema = new Schema<ApiRequestLogDoc>(
    {
        requestId: { type: String, required: true, trim: true, index: true },
        method: { type: String, required: true, trim: true, uppercase: true },
        route: { type: String, required: true, trim: true, index: true },
        status: { type: Number, required: true },
        success: { type: Boolean, required: true, index: true },
        durationMs: { type: Number, required: true },
        occurredAt: { type: Date, required: true, index: true },
        userId: { type: String, default: null, index: true },
        userEmail: { type: String, default: null, index: true },
        ip: { type: String, default: null },
        userAgent: { type: String, default: null },
        errorMessage: { type: String, default: null },
    },
    { timestamps: true },
);

// Keep logs for 30 days by default.
apiRequestLogSchema.index(
    { occurredAt: 1 },
    { expireAfterSeconds: Number(process.env.API_LOG_RETENTION_SECONDS ?? 60 * 60 * 24 * 30) },
);

const ApiRequestLogModel: Model<ApiRequestLogDoc> =
    (mongoose.models.ApiRequestLog as Model<ApiRequestLogDoc> | undefined) ||
    mongoose.model<ApiRequestLogDoc>("ApiRequestLog", apiRequestLogSchema);

async function ensureDbConnection(): Promise<void> {
    await connectToDatabase(getMongoDbUri());
}

function mapDoc(doc: ApiRequestLogDoc): ApiRequestLogRecord {
    return {
        id: doc._id.toString(),
        requestId: doc.requestId,
        method: doc.method,
        route: doc.route,
        status: doc.status,
        success: doc.success,
        durationMs: doc.durationMs,
        occurredAt: doc.occurredAt.toISOString(),
        userId: doc.userId ?? null,
        userEmail: doc.userEmail ?? null,
        ip: doc.ip ?? null,
        userAgent: doc.userAgent ?? null,
        errorMessage: doc.errorMessage ?? null,
    };
}

export async function createApiRequestLog(input: {
    requestId: string;
    method: string;
    route: string;
    status: number;
    durationMs: number;
    userId?: string | null;
    userEmail?: string | null;
    ip?: string | null;
    userAgent?: string | null;
    errorMessage?: string | null;
}): Promise<void> {
    await ensureDbConnection();
    await ApiRequestLogModel.create({
        requestId: input.requestId,
        method: input.method,
        route: input.route,
        status: input.status,
        success: input.status < 400,
        durationMs: input.durationMs,
        occurredAt: new Date(),
        userId: input.userId ?? null,
        userEmail: input.userEmail ?? null,
        ip: input.ip ?? null,
        userAgent: input.userAgent ?? null,
        errorMessage: input.errorMessage ?? null,
    });
}

export async function listApiRequestLogs(filters: {
    method?: string;
    route?: string;
    status?: number;
    success?: boolean;
    userId?: string;
    userEmail?: string;
    from?: Date;
    to?: Date;
    limit?: number;
    offset?: number;
}): Promise<{ total: number; logs: ApiRequestLogRecord[] }> {
    await ensureDbConnection();
    const query: Record<string, unknown> = {};
    if (filters.method) query.method = filters.method.toUpperCase();
    if (filters.route) query.route = filters.route;
    if (typeof filters.status === "number") query.status = filters.status;
    if (typeof filters.success === "boolean") query.success = filters.success;
    if (filters.userId) query.userId = filters.userId;
    if (filters.userEmail) query.userEmail = filters.userEmail.toLowerCase();
    if (filters.from || filters.to) {
        query.occurredAt = {
            ...(filters.from ? { $gte: filters.from } : {}),
            ...(filters.to ? { $lte: filters.to } : {}),
        };
    }
    const limit = Math.min(Math.max(filters.limit ?? 100, 1), 500);
    const offset = Math.max(filters.offset ?? 0, 0);
    const [total, rows] = await Promise.all([
        ApiRequestLogModel.countDocuments(query),
        ApiRequestLogModel.find(query)
            .sort({ occurredAt: -1 })
            .skip(offset)
            .limit(limit)
            .lean<ApiRequestLogDoc[]>(),
    ]);
    return { total, logs: rows.map(mapDoc) };
}
