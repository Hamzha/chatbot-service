import { getMongoDbUri } from "@repo/auth/lib/env";
import mongoose, { Model, Schema, Types } from "mongoose";
import { connectToDatabase } from "@/lib/db/client";

export type ChatbotMessageRole = "user" | "assistant";

export type ChatbotMessageRecord = {
    id: string;
    userId: string;
    role: ChatbotMessageRole;
    content: string;
    createdAt: string;
};

type ChatbotMsgDoc = {
    _id: Types.ObjectId;
    userId: Types.ObjectId;
    role: ChatbotMessageRole;
    content: string;
    createdAt: Date;
};

const chatbotMessageSchema = new Schema<ChatbotMsgDoc>(
    {
        userId: {
            type: Schema.Types.ObjectId,
            required: true,
            ref: "User",
            index: true,
        },
        role: {
            type: String,
            required: true,
            enum: ["user", "assistant"],
        },
        content: {
            type: String,
            required: true,
            maxlength: 100_000,
        },
    },
    {
        timestamps: { createdAt: true, updatedAt: false },
    },
);

chatbotMessageSchema.index({ userId: 1, createdAt: 1 });

const ChatbotMessageModel: Model<ChatbotMsgDoc> =
    (mongoose.models.ChatbotMessage as Model<ChatbotMsgDoc> | undefined) ||
    mongoose.model<ChatbotMsgDoc>("ChatbotMessage", chatbotMessageSchema);

async function ensureDbConnection(): Promise<void> {
    await connectToDatabase(getMongoDbUri());
}

function mapDoc(r: ChatbotMsgDoc): ChatbotMessageRecord {
    return {
        id: r._id.toString(),
        userId: r.userId.toString(),
        role: r.role,
        content: r.content,
        createdAt: r.createdAt.toISOString(),
    };
}

const DEFAULT_LIMIT = 80;

export async function listChatbotMessages(
    userId: string,
    limit: number = DEFAULT_LIMIT,
): Promise<ChatbotMessageRecord[]> {
    await ensureDbConnection();
    const uid = new Types.ObjectId(userId);
    const rows = await ChatbotMessageModel.find({ userId: uid })
        .sort({ createdAt: -1 })
        .limit(Math.min(limit, 200))
        .lean<ChatbotMsgDoc[]>();
    return rows.reverse().map(mapDoc);
}

/** Append user + assistant pair after a completed exchange (single round-trip). */
export async function appendChatbotExchange(
    userId: string,
    userContent: string,
    assistantContent: string,
): Promise<{ user: ChatbotMessageRecord; assistant: ChatbotMessageRecord }> {
    await ensureDbConnection();
    const uid = new Types.ObjectId(userId);
    const u = await ChatbotMessageModel.create({
        userId: uid,
        role: "user",
        content: userContent,
    });
    const a = await ChatbotMessageModel.create({
        userId: uid,
        role: "assistant",
        content: assistantContent,
    });
    return {
        user: mapDoc(u.toObject() as ChatbotMsgDoc),
        assistant: mapDoc(a.toObject() as ChatbotMsgDoc),
    };
}

export async function clearChatbotMessages(userId: string): Promise<number> {
    await ensureDbConnection();
    const uid = new Types.ObjectId(userId);
    const res = await ChatbotMessageModel.deleteMany({ userId: uid });
    return res.deletedCount ?? 0;
}
