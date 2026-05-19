import { getMongoDbUri } from "@repo/auth/lib/env";
import mongoose, { Model, Schema, Types } from "mongoose";
import { connectToDatabase } from "@/lib/db/client";

export type WidgetMessageRole = "user" | "bot" | "agent" | "system";

export type WidgetMessageMetadata = {
    numContexts: number | null;
};

export type WidgetMessageRecord = {
    id: string;
    botId: string;
    widgetSessionId: string;
    role: WidgetMessageRole;
    content: string;
    agentUserId: string | null;
    metadata: WidgetMessageMetadata;
    createdAt: string;
};

type WidgetMessageDoc = {
    _id: Types.ObjectId;
    botId: Types.ObjectId;
    widgetSessionId: string;
    role: WidgetMessageRole;
    content: string;
    agentUserId?: Types.ObjectId | null;
    metadata?: { numContexts?: number | null } | null;
    createdAt: Date;
};

const widgetMessageSchema = new Schema<WidgetMessageDoc>(
    {
        botId: {
            type: Schema.Types.ObjectId,
            required: true,
            ref: "ChatbotChatSession",
            index: true,
        },
        widgetSessionId: {
            type: String,
            required: true,
            trim: true,
            maxlength: 128,
        },
        role: {
            type: String,
            required: true,
            enum: ["user", "bot", "agent", "system"],
        },
        content: {
            type: String,
            required: true,
            maxlength: 8000,
        },
        agentUserId: {
            type: Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },
        metadata: {
            type: new Schema(
                { numContexts: { type: Number, default: null } },
                { _id: false },
            ),
            default: () => ({ numContexts: null }),
        },
    },
    { timestamps: { createdAt: true, updatedAt: false } },
);

widgetMessageSchema.index({ widgetSessionId: 1, createdAt: 1 });
widgetMessageSchema.index({ botId: 1, widgetSessionId: 1, createdAt: 1 });

const WidgetMessageModel: Model<WidgetMessageDoc> =
    (mongoose.models.WidgetMessage as Model<WidgetMessageDoc> | undefined) ||
    mongoose.model<WidgetMessageDoc>("WidgetMessage", widgetMessageSchema);

async function ensureDbConnection(): Promise<void> {
    await connectToDatabase(getMongoDbUri());
}

function mapDoc(d: WidgetMessageDoc): WidgetMessageRecord {
    return {
        id: d._id.toString(),
        botId: d.botId.toString(),
        widgetSessionId: d.widgetSessionId,
        role: d.role,
        content: d.content,
        agentUserId: d.agentUserId ? d.agentUserId.toString() : null,
        metadata: { numContexts: d.metadata?.numContexts ?? null },
        createdAt: d.createdAt.toISOString(),
    };
}

export type AppendWidgetMessageInput = {
    botId: string;
    widgetSessionId: string;
    role: WidgetMessageRole;
    content: string;
    agentUserId?: string | null;
    metadata?: { numContexts?: number | null };
};

export async function appendWidgetMessage(input: AppendWidgetMessageInput): Promise<WidgetMessageRecord> {
    if (!Types.ObjectId.isValid(input.botId)) {
        throw new Error("Invalid botId");
    }
    const trimmedContent = input.content.slice(0, 8000);
    if (!trimmedContent.trim()) {
        throw new Error("Message content is empty");
    }
    await ensureDbConnection();
    const doc = await WidgetMessageModel.create({
        botId: new Types.ObjectId(input.botId),
        widgetSessionId: input.widgetSessionId.trim(),
        role: input.role,
        content: trimmedContent,
        agentUserId:
            input.agentUserId && Types.ObjectId.isValid(input.agentUserId)
                ? new Types.ObjectId(input.agentUserId)
                : null,
        metadata: {
            numContexts:
                typeof input.metadata?.numContexts === "number" ? input.metadata.numContexts : null,
        },
    });
    return mapDoc(doc.toObject() as WidgetMessageDoc);
}

export async function listLastBotWidgetMessages(
    widgetSessionId: string,
    limit: number,
): Promise<WidgetMessageRecord[]> {
    if (!widgetSessionId.trim()) return [];
    await ensureDbConnection();
    const cap = Math.min(Math.max(limit, 1), 20);
    const rows = await WidgetMessageModel.find({
        widgetSessionId: widgetSessionId.trim(),
        role: "bot",
    })
        .sort({ createdAt: -1 })
        .limit(cap)
        .lean<WidgetMessageDoc[]>();
    return rows.map(mapDoc);
}

export async function appendWidgetExchange(
    botId: string,
    widgetSessionId: string,
    userContent: string,
    botContent: string,
): Promise<{ user: WidgetMessageRecord; bot: WidgetMessageRecord }> {
    const user = await appendWidgetMessage({ botId, widgetSessionId, role: "user", content: userContent });
    const bot = await appendWidgetMessage({ botId, widgetSessionId, role: "bot", content: botContent });
    return { user, bot };
}

const MAX_LIMIT = 200;

export async function listWidgetMessagesForSession(
    widgetSessionId: string,
    limit: number = 80,
): Promise<WidgetMessageRecord[]> {
    if (!widgetSessionId.trim()) return [];
    await ensureDbConnection();
    const rows = await WidgetMessageModel.find({ widgetSessionId: widgetSessionId.trim() })
        .sort({ createdAt: -1 })
        .limit(Math.min(Math.max(limit, 1), MAX_LIMIT))
        .lean<WidgetMessageDoc[]>();
    return rows.reverse().map(mapDoc);
}

export async function listWidgetMessagesSince(
    widgetSessionId: string,
    sinceIso: string | null,
    limit: number = MAX_LIMIT,
): Promise<WidgetMessageRecord[]> {
    if (!widgetSessionId.trim()) return [];
    await ensureDbConnection();
    const filter: Record<string, unknown> = { widgetSessionId: widgetSessionId.trim() };
    if (sinceIso) {
        const since = new Date(sinceIso);
        if (!Number.isNaN(since.getTime())) {
            filter.createdAt = { $gt: since };
        }
    }
    const rows = await WidgetMessageModel.find(filter)
        .sort({ createdAt: 1 })
        .limit(Math.min(Math.max(limit, 1), MAX_LIMIT))
        .lean<WidgetMessageDoc[]>();
    return rows.map(mapDoc);
}

export async function getLastWidgetMessageTime(widgetSessionId: string): Promise<Date | null> {
    if (!widgetSessionId.trim()) return null;
    await ensureDbConnection();
    const row = await WidgetMessageModel.findOne({ widgetSessionId: widgetSessionId.trim() })
        .sort({ createdAt: -1 })
        .select({ createdAt: 1 })
        .lean<{ createdAt: Date } | null>();
    return row ? row.createdAt : null;
}
