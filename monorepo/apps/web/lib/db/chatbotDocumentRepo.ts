import { getMongoDbUri } from "@repo/auth/lib/env";
import mongoose, { Model, Schema, Types } from "mongoose";
import { connectToDatabase } from "@/lib/db/client";

export type ChatbotDocumentRecord = {
    id: string;
    userId: string;
    source: string;
    chunks: number;
    createdAt: string;
    updatedAt: string;
};

type ChatbotDocDoc = {
    _id: Types.ObjectId;
    userId: Types.ObjectId;
    source: string;
    chunks: number;
    createdAt: Date;
    updatedAt: Date;
};

const chatbotDocumentSchema = new Schema<ChatbotDocDoc>(
    {
        userId: {
            type: Schema.Types.ObjectId,
            required: true,
            ref: "User",
            index: true,
        },
        source: {
            type: String,
            required: true,
            trim: true,
        },
        chunks: {
            type: Number,
            required: true,
            min: 0,
        },
    },
    {
        timestamps: true,
    },
);

chatbotDocumentSchema.index({ userId: 1, source: 1 }, { unique: true });

const ChatbotDocumentModel: Model<ChatbotDocDoc> =
    (mongoose.models.ChatbotDocument as Model<ChatbotDocDoc> | undefined) ||
    mongoose.model<ChatbotDocDoc>("ChatbotDocument", chatbotDocumentSchema);

async function ensureDbConnection(): Promise<void> {
    await connectToDatabase(getMongoDbUri());
}

function mapDoc(r: ChatbotDocDoc): ChatbotDocumentRecord {
    return {
        id: r._id.toString(),
        userId: r.userId.toString(),
        source: r.source,
        chunks: r.chunks,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
    };
}

export async function upsertChatbotDocument(
    userId: string,
    source: string,
    chunks: number,
): Promise<ChatbotDocumentRecord> {
    await ensureDbConnection();
    const uid = new Types.ObjectId(userId);
    const trimmed = source.trim();
    const doc = await ChatbotDocumentModel.findOneAndUpdate(
        { userId: uid, source: trimmed },
        { $set: { chunks } },
        { new: true, upsert: true, setDefaultsOnInsert: true },
    ).lean<ChatbotDocDoc | null>();

    if (!doc) {
        throw new Error("Failed to upsert chatbot document record.");
    }

    return mapDoc(doc);
}

export async function listChatbotDocuments(userId: string): Promise<ChatbotDocumentRecord[]> {
    await ensureDbConnection();
    const uid = new Types.ObjectId(userId);
    const rows = await ChatbotDocumentModel.find({ userId: uid }).sort({ updatedAt: -1 }).lean<ChatbotDocDoc[]>();
    return rows.map(mapDoc);
}

export async function deleteChatbotDocument(userId: string, source: string): Promise<boolean> {
    await ensureDbConnection();
    const uid = new Types.ObjectId(userId);
    const res = await ChatbotDocumentModel.deleteOne({ userId: uid, source });
    return res.deletedCount > 0;
}
