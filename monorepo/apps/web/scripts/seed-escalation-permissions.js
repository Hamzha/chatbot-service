import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const APP_ROOT = path.resolve(__dirname, "..");

function loadEnvFile(filePath) {
    if (!fs.existsSync(filePath)) return;
    const content = fs.readFileSync(filePath, "utf8");
    for (const rawLine of content.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith("#") || !line.includes("=")) continue;
        const eqIndex = line.indexOf("=");
        const key = line.slice(0, eqIndex).trim();
        const value = line.slice(eqIndex + 1).trim();
        if (!key || process.env[key] !== undefined) continue;
        process.env[key] = value.replace(/^['"]|['"]$/g, "");
    }
}

loadEnvFile(path.join(APP_ROOT, ".env.local"));
loadEnvFile(path.join(APP_ROOT, ".env"));

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || "auth_app";

if (!MONGODB_URI) {
    console.error("Missing MONGODB_URI environment variable.");
    process.exit(1);
}

const NEW_PERMISSIONS = [
    {
        code: "escalations:read",
        module: "escalations",
        action: "read",
        description: "View human-escalation tickets in the owner inbox",
    },
    {
        code: "escalations:update",
        module: "escalations",
        action: "update",
        description: "Update escalation status / internal notes",
    },
];

const ROLES_TO_GRANT = ["admin", "client", "user"];

async function main() {
    await mongoose.connect(MONGODB_URI, { dbName: MONGODB_DB_NAME });
    const db = mongoose.connection.db;
    const permissions = db.collection("permissions");
    const roles = db.collection("roles");

    const now = new Date();
    const upsertedIds = [];
    for (const p of NEW_PERMISSIONS) {
        const res = await permissions.findOneAndUpdate(
            { code: p.code },
            {
                $set: {
                    module: p.module,
                    action: p.action,
                    description: p.description,
                    updatedAt: now,
                },
                $setOnInsert: { code: p.code, createdAt: now },
            },
            { upsert: true, returnDocument: "after" },
        );
        const doc = res?.value ?? (await permissions.findOne({ code: p.code }));
        if (!doc) throw new Error(`Failed to upsert permission ${p.code}`);
        upsertedIds.push({ code: p.code, id: doc._id });
        console.log(`  ✓ permission ${p.code} (${doc._id})`);
    }

    console.log("\nGranting permissions to roles:");
    for (const slug of ROLES_TO_GRANT) {
        const role = await roles.findOne({ slug });
        if (!role) {
            console.log(`  • role '${slug}' not found — skipping`);
            continue;
        }
        const idsToAdd = upsertedIds.map((p) => p.id);
        const result = await roles.updateOne(
            { _id: role._id },
            { $addToSet: { permissionIds: { $each: idsToAdd } }, $set: { updatedAt: now } },
        );
        console.log(
            `  ✓ role '${slug}' — modified=${result.modifiedCount} (already had perms: ${result.modifiedCount === 0})`,
        );
    }

    console.log("\nDone. New permission codes are now in Mongo and assigned to admin/client/user roles.");
    await mongoose.disconnect();
}

main().catch(async (err) => {
    console.error(err);
    try {
        await mongoose.disconnect();
    } catch (_) { }
    process.exit(1);
});
