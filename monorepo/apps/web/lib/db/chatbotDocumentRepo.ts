import { getMongoDbUri } from "@repo/auth/lib/env";
import mongoose, { Model, Schema, Types } from "mongoose";
import { connectToDatabase } from "@/lib/db/client";

export type ChatbotDocumentKind = "upload" | "site";

/** Per-page Chroma source reference kept inside a `kind: "site"` aggregator row. */
export type ChatbotSitePageEntry = {
    /** Chroma `source` metadata for the individual page (currently the page URL). */
    key: string;
    /** Chunks produced for this page on its most recent ingest. */
    chunks: number;
};

export type ChatbotDocumentRecord = {
    id: string;
    userId: string;
    source: string;
    /** Chroma `source` metadata; for legacy rows equals display `source` (filename). */
    ragSourceKey: string;
    chunks: number;
    /**
     * "upload" — single PDF/file ingest (legacy default).
     * "site"  — aggregator row representing a crawled website; the real Chroma sources live in `pages`.
     */
    kind: ChatbotDocumentKind;
    /** Only populated when `kind === "site"`. Each entry is one ingested page. */
    pages: ChatbotSitePageEntry[];
    createdAt: string;
    updatedAt: string;
};

export type ChatbotDocDoc = {
    _id: Types.ObjectId;
    userId: Types.ObjectId;
    source: string;
    ragSourceKey?: string;
    chunks: number;
    kind?: ChatbotDocumentKind;
    pages?: ChatbotSitePageEntry[];
    createdAt: Date;
    updatedAt: Date;
};

const sitePageSchema = new Schema<ChatbotSitePageEntry>(
    {
        key: { type: String, required: true, trim: true },
        chunks: { type: Number, required: true, min: 0 },
    },
    { _id: false },
);

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
        kind: {
            type: String,
            enum: ["upload", "site"],
            default: "upload",
            required: true,
        },
        pages: {
            type: [sitePageSchema],
            default: [],
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

/**
 * Expand a stored `ragSourceKey` to the full list of Chroma source ids that should
 * be passed to `/v1/query.source_ids`. For `kind: "upload"` rows this is just the
 * key itself; for `kind: "site"` rows it's the list of per-page keys.
 */
export function effectiveQuerySourceIds(doc: ChatbotDocDoc | ChatbotDocumentRecord): string[] {
    const kind = docKind(doc);
    if (kind === "site") {
        const pages = "pages" in doc && Array.isArray(doc.pages) ? doc.pages : [];
        const keys = pages.map((p) => p.key).filter((k): k is string => !!k && k.length > 0);
        if (keys.length > 0) return [...new Set(keys)];
    }
    return [effectiveRagSourceKey(doc)];
}

function docKind(doc: ChatbotDocDoc | ChatbotDocumentRecord): ChatbotDocumentKind {
    if ("kind" in doc && doc.kind === "site") return "site";
    return "upload";
}

function mapDoc(r: ChatbotDocDoc): ChatbotDocumentRecord {
    const kind: ChatbotDocumentKind = r.kind === "site" ? "site" : "upload";
    const pages: ChatbotSitePageEntry[] = Array.isArray(r.pages)
        ? r.pages.map((p) => ({ key: p.key, chunks: p.chunks }))
        : [];
    return {
        id: r._id.toString(),
        userId: r.userId.toString(),
        source: r.source,
        ragSourceKey: effectiveRagSourceKey(r),
        chunks: r.chunks,
        kind,
        pages,
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
            kind: "upload",
            pages: [],
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
    if (!Types.ObjectId.isValid(documentId)) return null;
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
        {
            $set: { chunks, ragSourceKey: key },
            $setOnInsert: { kind: "upload", pages: [] },
        },
        { new: true, upsert: true, setDefaultsOnInsert: true },
    ).lean<ChatbotDocDoc | null>();

    if (!doc) {
        throw new Error("Failed to upsert chatbot document record.");
    }

    return mapDoc(doc);
}

/**
 * Upsert a site-level aggregator row that groups every crawled page of a single website
 * into one library entry. Called once per scraped page; idempotent by (userId, siteKey, pageKey).
 *
 * On first call for a site: creates the row with `kind: "site"`, `pages: [{ pageKey, pageChunks }]`,
 * `chunks = pageChunks`.
 * On repeat call with a new pageKey: appends the page and increments total chunks.
 * On repeat call with an existing pageKey (re-ingest/re-crawl of same URL): replaces that page's
 * chunk count and recomputes the total, so `chunks` stays accurate.
 */
export async function upsertChatbotSiteDocument(input: {
    userId: string;
    siteKey: string;
    displaySource: string;
    pageKey: string;
    pageChunks: number;
}): Promise<ChatbotDocumentRecord> {
    await ensureDbConnection();
    const uid = new Types.ObjectId(input.userId);
    const siteKey = input.siteKey.trim();
    const displaySource = input.displaySource.trim() || siteKey;
    const pageKey = input.pageKey.trim();
    if (!siteKey) throw new Error("upsertChatbotSiteDocument: siteKey is required");
    if (!pageKey) throw new Error("upsertChatbotSiteDocument: pageKey is required");

    // We do this in two round trips to handle both "new page" and "re-ingest of existing page"
    // correctly; there's no single Mongo update operator that can conditionally push-or-update
    // a sub-doc AND recompute the derived `chunks` sum in one shot.
    const existing = await ChatbotDocumentModel.findOne({
        userId: uid,
        ragSourceKey: siteKey,
    }).lean<ChatbotDocDoc | null>();

    if (!existing) {
        try {
            const created = await ChatbotDocumentModel.create({
                userId: uid,
                source: displaySource,
                ragSourceKey: siteKey,
                kind: "site",
                pages: [{ key: pageKey, chunks: input.pageChunks }],
                chunks: input.pageChunks,
            });
            return mapDoc(created.toObject() as ChatbotDocDoc);
        } catch (e) {
            // Duplicate source from a legacy upload row with the same display name would collide
            // on the (userId, source) index; fall through to retry-as-update below.
            const code = (e as { code?: number }).code;
            if (code !== 11000) throw e;
        }
    }

    const prevPages = existing?.pages ?? [];
    const idx = prevPages.findIndex((p) => p.key === pageKey);
    const nextPages: ChatbotSitePageEntry[] =
        idx >= 0
            ? prevPages.map((p, i) => (i === idx ? { key: pageKey, chunks: input.pageChunks } : p))
            : [...prevPages, { key: pageKey, chunks: input.pageChunks }];
    const totalChunks = nextPages.reduce((sum, p) => sum + (p.chunks || 0), 0);

    const updated = await ChatbotDocumentModel.findOneAndUpdate(
        { userId: uid, ragSourceKey: siteKey },
        {
            $set: {
                source: existing?.source ?? displaySource,
                kind: "site",
                pages: nextPages,
                chunks: totalChunks,
            },
        },
        { new: true, upsert: true, setDefaultsOnInsert: true },
    ).lean<ChatbotDocDoc | null>();

    if (!updated) {
        throw new Error("Failed to upsert chatbot site document record.");
    }
    return mapDoc(updated);
}

export async function getChatbotDocument(
    userId: string,
    documentId: string,
): Promise<ChatbotDocumentRecord | null> {
    await ensureDbConnection();
    // Malformed ObjectId → treat as "not found" instead of throwing so
    // callers can return 404 rather than 500. This is the fix for the
    // user-reported "Delete failed (404)" being masked by a stack trace.
    if (!Types.ObjectId.isValid(documentId)) return null;
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

/** Look up a user's documents by their top-level `ragSourceKey` values (site origins or page keys). */
export async function findChatbotDocumentsByRagKeys(
    userId: string,
    ragKeys: string[],
): Promise<ChatbotDocumentRecord[]> {
    await ensureDbConnection();
    const uniq = [...new Set(ragKeys.map((k) => k.trim()).filter((k) => k.length > 0))];
    if (uniq.length === 0) return [];
    const uid = new Types.ObjectId(userId);
    const rows = await ChatbotDocumentModel.find({
        userId: uid,
        ragSourceKey: { $in: uniq },
    }).lean<ChatbotDocDoc[]>();
    return rows.map(mapDoc);
}

export async function deleteChatbotDocumentById(userId: string, documentId: string): Promise<ChatbotDocumentRecord | null> {
    await ensureDbConnection();
    if (!Types.ObjectId.isValid(documentId)) return null;
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
