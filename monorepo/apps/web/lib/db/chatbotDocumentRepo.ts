import { getMongoDbUri } from "@repo/auth/lib/env";
import mongoose, { Model, Schema, Types } from "mongoose";
import { connectToDatabase } from "@/lib/db/client";

export type ChatbotDocumentRecord = {
    id: string;
    userId: string;
    source: string;
    /** Chroma `source` metadata; for legacy rows equals display `source` (filename). */
    ragSourceKey: string;
    chunks: number;
    createdAt: string;
    updatedAt: string;
};

export type ChatbotDocDoc = {
    _id: Types.ObjectId;
    userId: Types.ObjectId;
    source: string;
    ragSourceKey?: string;
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
        ragSourceKey: {
            type: String,
            trim: true,
            sparse: true,
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
chatbotDocumentSchema.index({ userId: 1, ragSourceKey: 1 }, { unique: true, sparse: true });

export const ChatbotDocumentModel: Model<ChatbotDocDoc> =
    (mongoose.models.ChatbotDocument as Model<ChatbotDocDoc> | undefined) ||
    mongoose.model<ChatbotDocDoc>("ChatbotDocument", chatbotDocumentSchema);

async function ensureDbConnection(): Promise<void> {
    await connectToDatabase(getMongoDbUri());
}

/** Vector store id for Chroma metadata `source` (stable per upload). */
export function effectiveRagSourceKey(doc: ChatbotDocDoc | ChatbotDocumentRecord): string {
    if ("ragSourceKey" in doc && doc.ragSourceKey && doc.ragSourceKey.trim()) {
        return doc.ragSourceKey.trim();
    }
    return doc.source;
}

function mapDoc(r: ChatbotDocDoc): ChatbotDocumentRecord {
    return {
        id: r._id.toString(),
        userId: r.userId.toString(),
        source: r.source,
        ragSourceKey: effectiveRagSourceKey(r),
        chunks: r.chunks,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
    };
}

export async function createPendingChatbotDocument(
    userId: string,
    displaySource: string,
): Promise<ChatbotDocumentRecord> {
    await ensureDbConnection();
    const uid = new Types.ObjectId(userId);
    const trimmed = displaySource.trim();
    const ragSourceKey = new Types.ObjectId().toString();
    try {
        const created = await ChatbotDocumentModel.create({
            userId: uid,
            source: trimmed,
            ragSourceKey,
            chunks: 0,
        });
        return mapDoc(created.toObject() as ChatbotDocDoc);
    } catch (e) {
        const code = (e as { code?: number }).code;
        if (code === 11000) {
            throw new Error(
                "A document with this filename already exists. Remove it or rename the file before uploading again.",
            );
        }
        throw e;
    }
}

export async function finalizeChatbotDocument(
    userId: string,
    documentId: string,
    chunks: number,
): Promise<ChatbotDocumentRecord | null> {
    await ensureDbConnection();
    const uid = new Types.ObjectId(userId);
    const did = new Types.ObjectId(documentId);
    const doc = await ChatbotDocumentModel.findOneAndUpdate(
        { _id: did, userId: uid },
        { $set: { chunks } },
        { new: true },
    ).lean<ChatbotDocDoc | null>();
    return doc ? mapDoc(doc) : null;
}

export async function upsertChatbotDocument(
    userId: string,
    source: string,
    chunks: number,
    ragSourceKey?: string,
): Promise<ChatbotDocumentRecord> {
    await ensureDbConnection();
    const uid = new Types.ObjectId(userId);
    const trimmed = source.trim();
    const key = ragSourceKey?.trim() || trimmed;
    const doc = await ChatbotDocumentModel.findOneAndUpdate(
        { userId: uid, source: trimmed },
        { $set: { chunks, ragSourceKey: key } },
        { new: true, upsert: true, setDefaultsOnInsert: true },
    ).lean<ChatbotDocDoc | null>();

    if (!doc) {
        throw new Error("Failed to upsert chatbot document record.");
    }

    return mapDoc(doc);
}

export async function getChatbotDocument(
    userId: string,
    documentId: string,
): Promise<ChatbotDocumentRecord | null> {
    await ensureDbConnection();
    const uid = new Types.ObjectId(userId);
    const did = new Types.ObjectId(documentId);
    const row = await ChatbotDocumentModel.findOne({ _id: did, userId: uid }).lean<ChatbotDocDoc | null>();
    return row ? mapDoc(row) : null;
}

export async function listChatbotDocuments(userId: string): Promise<ChatbotDocumentRecord[]> {
    await ensureDbConnection();
    const uid = new Types.ObjectId(userId);
    const rows = await ChatbotDocumentModel.find({ userId: uid }).sort({ updatedAt: -1 }).lean<ChatbotDocDoc[]>();
    return rows.map(mapDoc);
}

export async function deleteChatbotDocumentById(userId: string, documentId: string): Promise<ChatbotDocumentRecord | null> {
    await ensureDbConnection();
    const uid = new Types.ObjectId(userId);
    const did = new Types.ObjectId(documentId);
    const row = await ChatbotDocumentModel.findOneAndDelete({ _id: did, userId: uid }).lean<ChatbotDocDoc | null>();
    return row ? mapDoc(row) : null;
}

/** @deprecated Use deleteChatbotDocumentById; kept for scripts */
export async function deleteChatbotDocument(userId: string, source: string): Promise<boolean> {
    await ensureDbConnection();
    const uid = new Types.ObjectId(userId);
    const res = await ChatbotDocumentModel.deleteOne({ userId: uid, source });
    return res.deletedCount > 0;
}
