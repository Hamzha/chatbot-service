import { getMongoDbUri } from "@repo/auth/lib/env";
import mongoose, { Model, Schema, Types } from "mongoose";
import { connectToDatabase } from "@/lib/db/client";

export type ChatbotMessageRole = "user" | "assistant";

export type ChatbotMessageRecord = {
    id: string;
    userId: string;
    sessionId: string | null;
    role: ChatbotMessageRole;
    content: string;
    createdAt: string;
};

type ChatbotMsgDoc = {
    _id: Types.ObjectId;
    userId: Types.ObjectId;
    sessionId?: Types.ObjectId | null;
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
        sessionId: {
            type: Schema.Types.ObjectId,
            required: false,
            ref: "ChatbotChatSession",
            index: true,
            default: null,
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

chatbotMessageSchema.index({ userId: 1, sessionId: 1, createdAt: 1 });

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
        sessionId: r.sessionId ? r.sessionId.toString() : null,
        role: r.role,
        content: r.content,
        createdAt: r.createdAt.toISOString(),
    };
}

const DEFAULT_LIMIT = 80;

export async function listChatbotMessages(
    userId: string,
    sessionId: string,
    limit: number = DEFAULT_LIMIT,
): Promise<ChatbotMessageRecord[]> {
    await ensureDbConnection();
    const uid = new Types.ObjectId(userId);
    const sid = new Types.ObjectId(sessionId);
    const rows = await ChatbotMessageModel.find({ userId: uid, sessionId: sid })
        .sort({ createdAt: -1 })
        .limit(Math.min(limit, 200))
        .lean<ChatbotMsgDoc[]>();
    return rows.reverse().map(mapDoc);
}

/** Append user + assistant pair after a completed exchange (single round-trip). */
export async function appendChatbotExchange(
    userId: string,
    sessionId: string,
    userContent: string,
    assistantContent: string,
): Promise<{ user: ChatbotMessageRecord; assistant: ChatbotMessageRecord }> {
    await ensureDbConnection();
    const uid = new Types.ObjectId(userId);
    const sid = new Types.ObjectId(sessionId);
    const u = await ChatbotMessageModel.create({
        userId: uid,
        sessionId: sid,
        role: "user",
        content: userContent,
    });
    const a = await ChatbotMessageModel.create({
        userId: uid,
        sessionId: sid,
        role: "assistant",
        content: assistantContent,
    });
    return {
        user: mapDoc(u.toObject() as ChatbotMsgDoc),
        assistant: mapDoc(a.toObject() as ChatbotMsgDoc),
    };
}

export async function clearChatbotMessages(userId: string, sessionId: string): Promise<number> {
    await ensureDbConnection();
    const uid = new Types.ObjectId(userId);
    const sid = new Types.ObjectId(sessionId);
    const res = await ChatbotMessageModel.deleteMany({ userId: uid, sessionId: sid });
    return res.deletedCount ?? 0;
}

export async function deleteMessagesForSession(userId: string, sessionId: string): Promise<number> {
    return clearChatbotMessages(userId, sessionId);
}
