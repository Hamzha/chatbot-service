/**
 * Shared Mongo test harness for Vitest integration suites.
 *
 * Boots an in-memory MongoDB via `mongodb-memory-server`, connects Mongoose to
 * it, and exposes per-test cleanup. `MONGODB_URI` is set before any repo
 * imports so `connectToDatabase` picks up the right URI.
 *
 * Usage:
 *
 *   import { setupMongoTestEnv } from "@/lib/testing/mongo";
 *
 *   setupMongoTestEnv();
 *
 *   test("...", async () => { ... });
 */
import { afterAll, afterEach, beforeAll } from "vitest";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { authEnv } from "@repo/auth/lib/env";

let mem: MongoMemoryServer | null = null;

export function setupMongoTestEnv(): void {
    beforeAll(async () => {
        mem = await MongoMemoryServer.create();
        const uri = mem.getUri();
        process.env.MONGODB_URI = uri;
        process.env.MONGODB_DB_NAME = "test_db";
        // `authEnv.mongodbUri` is captured at import time, so mutate it too.
        authEnv.mongodbUri = uri;
        if (mongoose.connection.readyState === 0) {
            await mongoose.connect(uri, { dbName: "test_db", bufferCommands: false });
        }
    }, 60_000);

    afterEach(async () => {
        const collections = await mongoose.connection.db?.collections();
        if (!collections) return;
        for (const c of collections) {
            await c.deleteMany({});
        }
    });

    afterAll(async () => {
        await mongoose.disconnect();
        if (mem) {
            await mem.stop();
            mem = null;
        }
    });
}
