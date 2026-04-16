import { getMongoDbUri } from "@repo/auth/lib/env";
import mongoose, { Model, Schema, Types } from "mongoose";
import { connectToDatabase } from "@/lib/db/client";

export type WidgetConfigRecord = {
  id: string;
  userId: string;
  primaryColor: string;
  createdAt: string;
  updatedAt: string;
};

type WidgetConfigDoc = {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  primaryColor: string;
  createdAt: Date;
  updatedAt: Date;
};

const widgetConfigSchema = new Schema<WidgetConfigDoc>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "User",
      unique: true,
      index: true,
    },
    primaryColor: {
      type: String,
      required: true,
      default: "#0f766e",
      trim: true,
      maxlength: 20,
    },
  },
  { timestamps: true },
);

const WidgetConfigModel: Model<WidgetConfigDoc> =
  (mongoose.models.WidgetConfig as Model<WidgetConfigDoc> | undefined) ||
  mongoose.model<WidgetConfigDoc>("WidgetConfig", widgetConfigSchema);

async function ensureDbConnection(): Promise<void> {
  await connectToDatabase(getMongoDbUri());
}

function mapConfig(r: WidgetConfigDoc): WidgetConfigRecord {
  return {
    id: r._id.toString(),
    userId: r.userId.toString(),
    primaryColor: r.primaryColor,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

export async function getWidgetConfig(userId: string): Promise<WidgetConfigRecord | null> {
  await ensureDbConnection();
  const uid = new Types.ObjectId(userId);
  const row = await WidgetConfigModel.findOne({ userId: uid }).lean<WidgetConfigDoc | null>();
  return row ? mapConfig(row) : null;
}

export async function upsertWidgetConfig(
  userId: string,
  primaryColor: string,
): Promise<WidgetConfigRecord> {
  await ensureDbConnection();
  const uid = new Types.ObjectId(userId);
  const row = await WidgetConfigModel.findOneAndUpdate(
    { userId: uid },
    { $set: { primaryColor } },
    { new: true, upsert: true },
  ).lean<WidgetConfigDoc>();
  return mapConfig(row!);
}
