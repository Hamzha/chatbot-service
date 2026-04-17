import { getMongoDbUri } from "@repo/auth/lib/env";
import mongoose, { Model, Schema, Types } from "mongoose";
import { connectToDatabase } from "@/lib/db/client";
import { PERMISSION_CATALOG, permissionCode } from "@/lib/auth/permissionCatalog";

export type PermissionRecord = {
    id: string;
    code: string;
    module: string;
    action: string;
    description: string;
};

type PermissionDoc = {
    _id: Types.ObjectId;
    code: string;
    module: string;
    action: string;
    description: string;
};

const permissionSchema = new Schema<PermissionDoc>(
    {
        code: { type: String, required: true, unique: true, trim: true },
        module: { type: String, required: true, trim: true },
        action: { type: String, required: true, trim: true },
        description: { type: String, required: true, trim: true },
    },
    { timestamps: true },
);

permissionSchema.index({ module: 1, action: 1 }, { unique: true });

const PermissionModel: Model<PermissionDoc> =
    (mongoose.models.Permission as Model<PermissionDoc> | undefined) ||
    mongoose.model<PermissionDoc>("Permission", permissionSchema);

async function ensureDbConnection(): Promise<void> {
    await connectToDatabase(getMongoDbUri());
}

function mapDoc(d: PermissionDoc): PermissionRecord {
    return {
        id: d._id.toString(),
        code: d.code,
        module: d.module,
        action: d.action,
        description: d.description,
    };
}

/** Upsert all catalog entries (idempotent). */
export async function syncPermissionCatalog(): Promise<void> {
    await ensureDbConnection();
    for (const def of PERMISSION_CATALOG) {
        const code = permissionCode(def.module, def.action);
        await PermissionModel.updateOne(
            { code },
            {
                $set: {
                    module: def.module,
                    action: def.action,
                    description: def.description,
                },
            },
            { upsert: true },
        );
    }
}

export async function listPermissions(): Promise<PermissionRecord[]> {
    await ensureDbConnection();
    const rows = await PermissionModel.find({}).sort({ module: 1, action: 1 }).lean<PermissionDoc[]>();
    return rows.map(mapDoc);
}

export async function findPermissionsByCodes(codes: string[]): Promise<PermissionRecord[]> {
    if (codes.length === 0) return [];
    await ensureDbConnection();
    const rows = await PermissionModel.find({ code: { $in: codes } }).lean<PermissionDoc[]>();
    return rows.map(mapDoc);
}

export async function findPermissionIdsByCodes(codes: string[]): Promise<Types.ObjectId[]> {
    if (codes.length === 0) return [];
    await ensureDbConnection();
    const rows = await PermissionModel.find({ code: { $in: codes } })
        .select("_id")
        .lean<{ _id: Types.ObjectId }[]>();
    return rows.map((r) => r._id);
}

export async function findPermissionCodesByIds(ids: Types.ObjectId[]): Promise<string[]> {
    if (ids.length === 0) return [];
    await ensureDbConnection();
    const rows = await PermissionModel.find({ _id: { $in: ids } })
        .select("code")
        .lean<{ code: string }[]>();
    return rows.map((r) => r.code);
}
