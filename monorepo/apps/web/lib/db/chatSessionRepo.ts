import { getMongoDbUri } from "@repo/auth/lib/env";
import mongoose, { Model, Schema, Types } from "mongoose";
import { connectToDatabase } from "@/lib/db/client";
import {
    resolveSelectedDocumentsFromLibrary,
    type SessionSelectedDocRow,
} from "@/lib/chatbot/resolveSessionSelectedDocuments";
import { ChatbotDocumentModel, effectiveRagSourceKey, type ChatbotDocDoc } from "@/lib/db/chatbotDocumentRepo";

export type { SessionSelectedDocRow } from "@/lib/chatbot/resolveSessionSelectedDocuments";

export type ChatSessionRecord = {
    id: string;
    userId: string;
    name: string;
    primaryColor: string;
    selectedRagKeys: string[];
    createdAt: string;
    updatedAt: string;
};

type ChatSessionDoc = {
    _id: Types.ObjectId;
    userId: Types.ObjectId;
    name: string;
    primaryColor: string;
    selectedRagKeys: string[];
    createdAt: Date;
    updatedAt: Date;
};

const chatSessionSchema = new Schema<ChatSessionDoc>(
    {
        userId: {
            type: Schema.Types.ObjectId,
            required: true,
            ref: "User",
            index: true,
        },
        name: {
            type: String,
            required: true,
            trim: true,
            maxlength: 200,
        },
        primaryColor: {
            type: String,
            required: true,
            default: "#0f766e",
            trim: true,
            maxlength: 20,
        },
        selectedRagKeys: {
            type: [String],
            required: true,
            default: [],
        },
    },
    { timestamps: true },
);

chatSessionSchema.index({ userId: 1, updatedAt: -1 });

const ChatSessionModel: Model<ChatSessionDoc> =
    (mongoose.models.ChatbotChatSession as Model<ChatSessionDoc> | undefined) ||
    mongoose.model<ChatSessionDoc>("ChatbotChatSession", chatSessionSchema);

async function ensureDbConnection(): Promise<void> {
    await connectToDatabase(getMongoDbUri());
}

function mapSession(r: ChatSessionDoc): ChatSessionRecord {
    return {
        id: r._id.toString(),
        userId: r.userId.toString(),
        name: r.name,
        primaryColor: r.primaryColor,
        selectedRagKeys: [...r.selectedRagKeys],
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
    };
}

async function resolveRagKeys(userId: string, documentIds: string[]): Promise<string[]> {
    const uid = new Types.ObjectId(userId);
    const validIds = documentIds.filter((id) => Types.ObjectId.isValid(id));
    if (validIds.length !== documentIds.length) {
        throw new Error("One or more document ids are invalid.");
    }
    const oids = validIds.map((id) => new Types.ObjectId(id));
    const rows = await ChatbotDocumentModel.find({ userId: uid, _id: { $in: oids } }).lean<ChatbotDocDoc[]>();
    if (rows.length !== oids.length) {
        throw new Error("One or more documents were not found in your library.");
    }
    const keys = rows.map((d) => effectiveRagSourceKey(d));
    return [...new Set(keys)];
}

export async function createChatSession(
    userId: string,
    name: string,
    documentIds: string[],
): Promise<ChatSessionRecord> {
    await ensureDbConnection();
    const selectedRagKeys = await resolveRagKeys(userId, documentIds);
    if (selectedRagKeys.length === 0) {
        throw new Error("Select at least one document that exists in your library.");
    }
    const trimmedName = name.trim() || "Untitled chat";
    const doc = await ChatSessionModel.create({
        userId: new Types.ObjectId(userId),
        name: trimmedName,
        primaryColor: "#0f766e",
        selectedRagKeys,
    });
    return mapSession(doc.toObject() as ChatSessionDoc);
}

export async function listChatSessions(userId: string): Promise<ChatSessionRecord[]> {
    await ensureDbConnection();
    const uid = new Types.ObjectId(userId);
    const rows = await ChatSessionModel.find({ userId: uid }).sort({ updatedAt: -1 }).lean<ChatSessionDoc[]>();
    return rows.map(mapSession);
}

export async function getChatSession(userId: string, sessionId: string): Promise<ChatSessionRecord | null> {
    await ensureDbConnection();
    const uid = new Types.ObjectId(userId);
    const sid = new Types.ObjectId(sessionId);
    const row = await ChatSessionModel.findOne({ _id: sid, userId: uid }).lean<ChatSessionDoc | null>();
    return row ? mapSession(row) : null;
}

export async function getChatSessionById(sessionId: string): Promise<ChatSessionRecord | null> {
    await ensureDbConnection();
    const sid = new Types.ObjectId(sessionId);
    const row = await ChatSessionModel.findOne({ _id: sid }).lean<ChatSessionDoc | null>();
    return row ? mapSession(row) : null;
}

/** Resolve `selectedRagKeys` to library filenames for UI (survives navigation; works if the documents list API fails). */
export async function resolveSessionSelectedDocuments(
    userId: string,
    selectedRagKeys: string[],
): Promise<SessionSelectedDocRow[]> {
    await ensureDbConnection();
    const uid = new Types.ObjectId(userId);
    const all = await ChatbotDocumentModel.find({ userId: uid }).lean<ChatbotDocDoc[]>();
    const libraryRows = all.map((d) => ({
        id: d._id.toString(),
        source: d.source,
        ragSourceKey: effectiveRagSourceKey(d),
    }));
    return resolveSelectedDocumentsFromLibrary(libraryRows, selectedRagKeys);
}

export async function updateChatSession(
    userId: string,
    sessionId: string,
    patch: { name?: string; documentIds?: string[]; primaryColor?: string },
): Promise<ChatSessionRecord | null> {
    await ensureDbConnection();
    const uid = new Types.ObjectId(userId);
    const sid = new Types.ObjectId(sessionId);
    const update: { name?: string; primaryColor?: string; selectedRagKeys?: string[] } = {};
    if (patch.name !== undefined) {
        update.name = patch.name.trim() || "Untitled chat";
    }
    if (patch.primaryColor !== undefined) {
        update.primaryColor = patch.primaryColor;
    }
    if (patch.documentIds !== undefined) {
        const keys = await resolveRagKeys(userId, patch.documentIds);
        if (keys.length === 0) {
            throw new Error("Select at least one document that exists in your library.");
        }
        update.selectedRagKeys = keys;
    }
    if (Object.keys(update).length === 0) {
        return getChatSession(userId, sessionId);
    }
    const row = await ChatSessionModel.findOneAndUpdate({ _id: sid, userId: uid }, { $set: update }, { new: true }).lean<
        ChatSessionDoc | null
    >();
    return row ? mapSession(row) : null;
}

export async function deleteChatSession(userId: string, sessionId: string): Promise<boolean> {
    await ensureDbConnection();
    const uid = new Types.ObjectId(userId);
    const sid = new Types.ObjectId(sessionId);
    const res = await ChatSessionModel.deleteOne({ _id: sid, userId: uid });
    return (res.deletedCount ?? 0) > 0;
}
