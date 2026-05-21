import { getMongoDbUri } from "@repo/auth/lib/env";
import mongoose, { Model, Schema, Types } from "mongoose";
import { connectToDatabase } from "@/lib/db/client";

export type EscalationStatus = "open" | "in_progress" | "resolved";
export type EscalationReason = "user_request" | "low_confidence" | "manual";
export type EscalationTranscriptRole = "user" | "bot";

export type EscalationTranscriptEntry = {
    role: EscalationTranscriptRole;
    content: string;
    createdAt: string;
};

export type LiveTakeoverState = {
    active: boolean;
    agentUserId: string | null;
    startedAt: string | null;
    endedAt: string | null;
};

export type EscalationRecord = {
    id: string;
    botOwnerId: string;
    chatbotId: string;
    widgetSessionId: string;
    contact: { name: string; email: string };
    reason: EscalationReason;
    message: string;
    transcriptSnapshot: EscalationTranscriptEntry[];
    status: EscalationStatus;
    notes: string;
    liveTakeover: LiveTakeoverState;
    createdAt: string;
    updatedAt: string;
    resolvedAt: string | null;
};

type LiveTakeoverDoc = {
    active: boolean;
    agentUserId?: Types.ObjectId | null;
    startedAt?: Date | null;
    endedAt?: Date | null;
};

type EscalationDoc = {
    _id: Types.ObjectId;
    botOwnerId: Types.ObjectId;
    chatbotId: Types.ObjectId;
    widgetSessionId: string;
    contact: { name: string; email: string };
    reason: EscalationReason;
    message: string;
    transcriptSnapshot: { role: EscalationTranscriptRole; content: string; createdAt: Date }[];
    status: EscalationStatus;
    notes: string;
    liveTakeover?: LiveTakeoverDoc;
    createdAt: Date;
    updatedAt: Date;
    resolvedAt: Date | null;
};

const transcriptEntrySchema = new Schema(
    {
        role: { type: String, required: true, enum: ["user", "bot"] },
        content: { type: String, required: true, maxlength: 4000 },
        createdAt: { type: Date, required: true, default: () => new Date() },
    },
    { _id: false },
);

const liveTakeoverSchema = new Schema<LiveTakeoverDoc>(
    {
        active: { type: Boolean, required: true, default: false },
        agentUserId: { type: Schema.Types.ObjectId, ref: "User", default: null },
        startedAt: { type: Date, default: null },
        endedAt: { type: Date, default: null },
    },
    { _id: false },
);

const escalationSchema = new Schema<EscalationDoc>(
    {
        botOwnerId: { type: Schema.Types.ObjectId, required: true, ref: "User", index: true },
        chatbotId: { type: Schema.Types.ObjectId, required: true, ref: "ChatbotChatSession", index: true },
        widgetSessionId: { type: String, required: true, trim: true, maxlength: 128 },
        contact: {
            name: { type: String, required: false, default: "", trim: true, maxlength: 100 },
            email: { type: String, required: false, default: "", lowercase: true, trim: true, maxlength: 254 },
        },
        reason: { type: String, required: true, enum: ["user_request", "low_confidence", "manual"] },
        message: { type: String, default: "", maxlength: 1000 },
        transcriptSnapshot: { type: [transcriptEntrySchema], default: [] },
        status: { type: String, required: true, enum: ["open", "in_progress", "resolved"], default: "open" },
        notes: { type: String, default: "", maxlength: 4000 },
        liveTakeover: {
            type: liveTakeoverSchema,
            default: () => ({ active: false, agentUserId: null, startedAt: null, endedAt: null }),
        },
        resolvedAt: { type: Date, default: null },
    },
    { timestamps: true },
);

escalationSchema.index({ botOwnerId: 1, status: 1, createdAt: -1 });
escalationSchema.index({ widgetSessionId: 1, status: 1 });
escalationSchema.index({ widgetSessionId: 1, "liveTakeover.active": 1 });

const EscalationModel: Model<EscalationDoc> =
    (mongoose.models.Escalation as Model<EscalationDoc> | undefined) ||
    mongoose.model<EscalationDoc>("Escalation", escalationSchema);

async function ensureDbConnection(): Promise<void> {
    await connectToDatabase(getMongoDbUri());
}

function mapLiveTakeover(t: LiveTakeoverDoc | undefined | null): LiveTakeoverState {
    if (!t) return { active: false, agentUserId: null, startedAt: null, endedAt: null };
    return {
        active: Boolean(t.active),
        agentUserId: t.agentUserId ? t.agentUserId.toString() : null,
        startedAt: t.startedAt ? t.startedAt.toISOString() : null,
        endedAt: t.endedAt ? t.endedAt.toISOString() : null,
    };
}

function mapDoc(d: EscalationDoc): EscalationRecord {
    return {
        id: d._id.toString(),
        botOwnerId: d.botOwnerId.toString(),
        chatbotId: d.chatbotId.toString(),
        widgetSessionId: d.widgetSessionId,
        contact: { name: d.contact.name, email: d.contact.email },
        reason: d.reason,
        message: d.message ?? "",
        transcriptSnapshot: (d.transcriptSnapshot ?? []).map((e) => ({
            role: e.role,
            content: e.content,
            createdAt: e.createdAt.toISOString(),
        })),
        status: d.status,
        notes: d.notes ?? "",
        liveTakeover: mapLiveTakeover(d.liveTakeover),
        createdAt: d.createdAt.toISOString(),
        updatedAt: d.updatedAt.toISOString(),
        resolvedAt: d.resolvedAt ? d.resolvedAt.toISOString() : null,
    };
}

export type CreateEscalationInput = {
    botOwnerId: string;
    chatbotId: string;
    widgetSessionId: string;
    contact?: { name?: string; email?: string };
    reason: EscalationReason;
    message: string;
    transcriptSnapshot: EscalationTranscriptEntry[];
};

export async function createEscalation(input: CreateEscalationInput): Promise<EscalationRecord> {
    await ensureDbConnection();
    const name = input.contact?.name?.trim() ?? "";
    const email = input.contact?.email?.trim().toLowerCase() ?? "";
    const doc = await EscalationModel.create({
        botOwnerId: new Types.ObjectId(input.botOwnerId),
        chatbotId: new Types.ObjectId(input.chatbotId),
        widgetSessionId: input.widgetSessionId.trim(),
        contact: { name, email },
        reason: input.reason,
        message: input.message.trim(),
        transcriptSnapshot: input.transcriptSnapshot.map((e) => ({
            role: e.role,
            content: e.content,
            createdAt: new Date(e.createdAt),
        })),
        status: "open",
        notes: "",
        resolvedAt: null,
    });
    return mapDoc(doc.toObject() as EscalationDoc);
}

export type SetEscalationContactResult =
    | { ok: true; record: EscalationRecord }
    | { ok: false; reason: "not_found" };

export async function setContactForOpenSessionEscalation(
    widgetSessionId: string,
    contact: { name?: string; email: string },
): Promise<SetEscalationContactResult> {
    if (!widgetSessionId.trim()) return { ok: false, reason: "not_found" };
    await ensureDbConnection();
    const email = contact.email.trim().toLowerCase();
    const $set: Record<string, unknown> = { "contact.email": email };
    if (typeof contact.name === "string" && contact.name.trim()) {
        $set["contact.name"] = contact.name.trim();
    }
    const updated = await EscalationModel.findOneAndUpdate(
        {
            widgetSessionId: widgetSessionId.trim(),
            status: { $in: ["open", "in_progress"] },
        },
        { $set },
        { new: true, sort: { createdAt: -1 } },
    ).lean<EscalationDoc | null>();
    if (!updated) return { ok: false, reason: "not_found" };
    return { ok: true, record: mapDoc(updated) };
}

export async function findOpenEscalationForSession(widgetSessionId: string): Promise<EscalationRecord | null> {
    if (!widgetSessionId.trim()) return null;
    await ensureDbConnection();
    const row = await EscalationModel.findOne({
        widgetSessionId: widgetSessionId.trim(),
        status: { $in: ["open", "in_progress"] },
    }).lean<EscalationDoc | null>();
    return row ? mapDoc(row) : null;
}

export type ListEscalationsOptions = {
    status?: EscalationStatus | "all";
    limit?: number;
    cursor?: string | null;
};

export type ListEscalationsResult = {
    items: EscalationRecord[];
    nextCursor: string | null;
};

export async function listEscalationsForOwner(
    ownerId: string,
    opts: ListEscalationsOptions = {},
): Promise<ListEscalationsResult> {
    if (!Types.ObjectId.isValid(ownerId)) return { items: [], nextCursor: null };
    await ensureDbConnection();

    const limit = Math.min(Math.max(opts.limit ?? 25, 1), 100);
    const filter: Record<string, unknown> = { botOwnerId: new Types.ObjectId(ownerId) };
    if (opts.status && opts.status !== "all") {
        filter.status = opts.status;
    }
    if (opts.cursor && Types.ObjectId.isValid(opts.cursor)) {
        filter._id = { $lt: new Types.ObjectId(opts.cursor) };
    }

    const rows = await EscalationModel.find(filter)
        .sort({ _id: -1 })
        .limit(limit + 1)
        .lean<EscalationDoc[]>();

    const hasMore = rows.length > limit;
    const slice = hasMore ? rows.slice(0, limit) : rows;
    return {
        items: slice.map(mapDoc),
        nextCursor: hasMore ? slice[slice.length - 1]!._id.toString() : null,
    };
}

export async function getEscalation(id: string, ownerId: string): Promise<EscalationRecord | null> {
    if (!Types.ObjectId.isValid(id) || !Types.ObjectId.isValid(ownerId)) return null;
    await ensureDbConnection();
    const row = await EscalationModel.findOne({
        _id: new Types.ObjectId(id),
        botOwnerId: new Types.ObjectId(ownerId),
    }).lean<EscalationDoc | null>();
    return row ? mapDoc(row) : null;
}

const ALLOWED_TRANSITIONS: Record<EscalationStatus, EscalationStatus[]> = {
    open: ["in_progress", "resolved"],
    in_progress: ["resolved"],
    resolved: [],
};

export type UpdateEscalationResult =
    | { ok: true; record: EscalationRecord }
    | { ok: false; reason: "not_found" | "invalid_transition" };

export async function updateEscalation(
    id: string,
    ownerId: string,
    patch: { status?: EscalationStatus; notes?: string },
): Promise<UpdateEscalationResult> {
    if (!Types.ObjectId.isValid(id) || !Types.ObjectId.isValid(ownerId)) {
        return { ok: false, reason: "not_found" };
    }
    await ensureDbConnection();
    const existing = await EscalationModel.findOne({
        _id: new Types.ObjectId(id),
        botOwnerId: new Types.ObjectId(ownerId),
    }).lean<EscalationDoc | null>();
    if (!existing) return { ok: false, reason: "not_found" };

    const $set: Record<string, unknown> = {};
    if (patch.notes !== undefined) {
        $set.notes = patch.notes.slice(0, 4000);
    }
    if (patch.status !== undefined && patch.status !== existing.status) {
        const allowed = ALLOWED_TRANSITIONS[existing.status] ?? [];
        if (!allowed.includes(patch.status)) {
            return { ok: false, reason: "invalid_transition" };
        }
        $set.status = patch.status;
        if (patch.status === "resolved") {
            $set.resolvedAt = new Date();
            if (existing.liveTakeover?.active) {
                $set["liveTakeover.active"] = false;
                $set["liveTakeover.endedAt"] = new Date();
            }
        }
    }

    if (Object.keys($set).length === 0) {
        return { ok: true, record: mapDoc(existing) };
    }

    const updated = await EscalationModel.findOneAndUpdate(
        { _id: new Types.ObjectId(id), botOwnerId: new Types.ObjectId(ownerId) },
        { $set },
        { new: true },
    ).lean<EscalationDoc | null>();

    if (!updated) return { ok: false, reason: "not_found" };
    return { ok: true, record: mapDoc(updated) };
}

export type TakeoverResult =
    | { ok: true; record: EscalationRecord }
    | { ok: false; reason: "not_found" | "invalid_state" };

export async function startTakeover(
    id: string,
    ownerId: string,
    agentUserId: string,
): Promise<TakeoverResult> {
    if (!Types.ObjectId.isValid(id) || !Types.ObjectId.isValid(ownerId) || !Types.ObjectId.isValid(agentUserId)) {
        return { ok: false, reason: "not_found" };
    }
    await ensureDbConnection();
    const existing = await EscalationModel.findOne({
        _id: new Types.ObjectId(id),
        botOwnerId: new Types.ObjectId(ownerId),
    }).lean<EscalationDoc | null>();
    if (!existing) return { ok: false, reason: "not_found" };
    if (existing.status === "resolved") {
        return { ok: false, reason: "invalid_state" };
    }

    const $set: Record<string, unknown> = {
        "liveTakeover.active": true,
        "liveTakeover.agentUserId": new Types.ObjectId(agentUserId),
        "liveTakeover.startedAt": new Date(),
        "liveTakeover.endedAt": null,
    };
    if (existing.status === "open") {
        $set.status = "in_progress";
    }

    const updated = await EscalationModel.findOneAndUpdate(
        { _id: new Types.ObjectId(id), botOwnerId: new Types.ObjectId(ownerId) },
        { $set },
        { new: true },
    ).lean<EscalationDoc | null>();
    if (!updated) return { ok: false, reason: "not_found" };
    return { ok: true, record: mapDoc(updated) };
}

export async function endTakeover(id: string, ownerId: string): Promise<TakeoverResult> {
    if (!Types.ObjectId.isValid(id) || !Types.ObjectId.isValid(ownerId)) {
        return { ok: false, reason: "not_found" };
    }
    await ensureDbConnection();
    const updated = await EscalationModel.findOneAndUpdate(
        { _id: new Types.ObjectId(id), botOwnerId: new Types.ObjectId(ownerId) },
        {
            $set: {
                "liveTakeover.active": false,
                "liveTakeover.endedAt": new Date(),
            },
        },
        { new: true },
    ).lean<EscalationDoc | null>();
    if (!updated) return { ok: false, reason: "not_found" };
    return { ok: true, record: mapDoc(updated) };
}

export async function findActiveTakeoverForSession(
    widgetSessionId: string,
): Promise<EscalationRecord | null> {
    if (!widgetSessionId.trim()) return null;
    await ensureDbConnection();
    const row = await EscalationModel.findOne({
        widgetSessionId: widgetSessionId.trim(),
        "liveTakeover.active": true,
    }).lean<EscalationDoc | null>();
    return row ? mapDoc(row) : null;
}

export async function listEscalationsSinceForOwner(
    ownerId: string,
    sinceIso: string | null,
    limit: number = 50,
): Promise<EscalationRecord[]> {
    if (!Types.ObjectId.isValid(ownerId)) return [];
    await ensureDbConnection();
    const filter: Record<string, unknown> = { botOwnerId: new Types.ObjectId(ownerId) };
    if (sinceIso) {
        const since = new Date(sinceIso);
        if (!Number.isNaN(since.getTime())) {
            filter.createdAt = { $gt: since };
        }
    }
    const rows = await EscalationModel.find(filter)
        .sort({ createdAt: 1 })
        .limit(Math.min(Math.max(limit, 1), 200))
        .lean<EscalationDoc[]>();
    return rows.map(mapDoc);
}

export async function countOpenEscalationsForOwner(ownerId: string): Promise<number> {
    if (!Types.ObjectId.isValid(ownerId)) return 0;
    await ensureDbConnection();
    return EscalationModel.countDocuments({
        botOwnerId: new Types.ObjectId(ownerId),
        status: { $in: ["open", "in_progress"] },
    });
}
