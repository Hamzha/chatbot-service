import mongoose from "mongoose";

type MongooseCache = {
    conn: typeof mongoose | null;
    promise: Promise<typeof mongoose> | null;
};

const globalMongoose = globalThis as typeof globalThis & {
    __MONGOOSE_CACHE__?: MongooseCache;
};

const cache: MongooseCache = globalMongoose.__MONGOOSE_CACHE__ ?? {
    conn: null,
    promise: null,
};

if (!globalMongoose.__MONGOOSE_CACHE__) {
    globalMongoose.__MONGOOSE_CACHE__ = cache;
}

export async function connectToDatabase(mongoUri: string): Promise<typeof mongoose> {
    if (cache.conn) {
        return cache.conn;
    }

    if (!cache.promise) {
        cache.promise = mongoose.connect(mongoUri, {
            dbName: process.env.MONGODB_DB_NAME || "auth_app",
            bufferCommands: false,
        });
    }

    cache.conn = await cache.promise;
    return cache.conn;
}
