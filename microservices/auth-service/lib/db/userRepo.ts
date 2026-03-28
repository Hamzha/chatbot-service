import type { SafeUser, UserRecord } from "@/types/user";
import mongoose, { Model, Schema, Types } from "mongoose";
import { getMongoDbUri } from "@/lib/auth/env";
import { connectToDatabase } from "@/lib/db/client";

type UserDoc = {
    _id: Types.ObjectId;
    email: string;
    name: string;
    passwordHash: string;
    emailVerified?: Date;
    createdAt: Date;
    updatedAt: Date;
};

const userSchema = new Schema<UserDoc>(
    {
        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
        },
        name: {
            type: String,
            required: true,
            trim: true,
        },
        passwordHash: {
            type: String,
            required: true,
        },
        emailVerified: {
            type: Date,
            default: null,
        },
    },
    {
        timestamps: true,
    },
);

const UserModel: Model<UserDoc> =
    (mongoose.models.User as Model<UserDoc> | undefined) ||
    mongoose.model<UserDoc>("User", userSchema);

function mapUserDocToRecord(user: UserDoc): UserRecord {
    return {
        emailVerified: user.emailVerified ? user.emailVerified.toISOString() : null,
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        passwordHash: user.passwordHash,
        createdAt: user.createdAt.toISOString(),
    };
}

async function ensureDbConnection(): Promise<void> {
    await connectToDatabase(getMongoDbUri());
}

function normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
}

export function toSafeUser(user: UserRecord): SafeUser {
    return {
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt,
    };
}

export async function findUserByEmail(email: string): Promise<UserRecord | null> {
    await ensureDbConnection();
    const normalized = normalizeEmail(email);
    const user = await UserModel.findOne({ email: normalized }).lean<UserDoc | null>();

    return user ? mapUserDocToRecord(user) : null;
}

export async function findUserById(id: string): Promise<UserRecord | null> {
    if (!Types.ObjectId.isValid(id)) {
        return null;
    }

    await ensureDbConnection();
    const user = await UserModel.findById(id).lean<UserDoc | null>();

    return user ? mapUserDocToRecord(user) : null;
}

export async function createUser(input: {
    email: string;
    name: string;
    passwordHash: string;
}): Promise<UserRecord> {
    await ensureDbConnection();
    const normalized = normalizeEmail(input.email);

    const created = await UserModel.create({
        email: normalized,
        name: input.name.trim(),
        passwordHash: input.passwordHash,
    });

    return mapUserDocToRecord(created.toObject() as UserDoc);
}

export async function verifyUserEmail(userId: string): Promise<UserRecord | null> {
    await ensureDbConnection();

    if (!Types.ObjectId.isValid(userId)) {
        return null;
    }

    const updated = await UserModel.findByIdAndUpdate(
        userId,
        { emailVerified: new Date() },
        { new: true },
    ).lean<UserDoc>();

    return updated ? mapUserDocToRecord(updated) : null;
}

export async function updateUserPassword(userId: string, passwordHash: string): Promise<UserRecord | null> {
    await ensureDbConnection();

    if (!Types.ObjectId.isValid(userId)) {
        return null;
    }

    const updated = await UserModel.findByIdAndUpdate(
        userId,
        { passwordHash },
        { new: true },
    ).lean<UserDoc>();

    return updated ? mapUserDocToRecord(updated) : null;
}
