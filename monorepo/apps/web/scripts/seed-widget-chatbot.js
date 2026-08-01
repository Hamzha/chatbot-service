import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import bcrypt from "bcryptjs";
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
const DEFAULT_EMAIL = (process.env.CHATBOT_SEED_EMAIL || "seed-user@test.local").trim().toLowerCase();
const DEFAULT_NAME = (process.env.CHATBOT_SEED_NAME || "Seed User").trim();
const DEFAULT_PASSWORD = process.env.CHATBOT_SEED_PASSWORD || "SeedUser123!";
const DEFAULT_SESSION_NAME = (process.env.CHATBOT_SEED_SESSION_NAME || "Seeded Widget Chatbot").trim();
const DEFAULT_PRIMARY_COLOR = (process.env.CHATBOT_SEED_PRIMARY_COLOR || "#0f766e").trim();
const DEFAULT_ORIGIN = (process.env.APP_ORIGIN || "http://localhost:3000").trim();

if (!MONGODB_URI) {
    console.error("Missing MONGODB_URI environment variable.");
    process.exit(1);
}

const userSchema = new mongoose.Schema(
    {
        email: { type: String, required: true, unique: true, lowercase: true, trim: true },
        name: { type: String, required: true, trim: true },
        passwordHash: { type: String, required: true },
        emailVerified: { type: Date, default: null },
        roleIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Role" }],
    },
    { timestamps: true },
);

const roleSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true },
        slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
        description: { type: String, default: "", trim: true },
        isSystem: { type: Boolean, default: false },
        enabled: { type: Boolean, default: true },
        permissionIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Permission" }],
    },
    { timestamps: true },
);

const chatSessionSchema = new mongoose.Schema(
    {
        userId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: "User", index: true },
        name: { type: String, required: true, trim: true, maxlength: 200 },
        primaryColor: { type: String, required: true, default: "#0f766e", trim: true, maxlength: 20 },
        selectedRagKeys: { type: [String], required: true, default: [] },
    },
    { timestamps: true },
);

chatSessionSchema.index({ userId: 1, updatedAt: -1 });

const UserModel = mongoose.models.User || mongoose.model("User", userSchema);
const RoleModel = mongoose.models.Role || mongoose.model("Role", roleSchema);
const ChatSessionModel = mongoose.models.ChatbotChatSession || mongoose.model("ChatbotChatSession", chatSessionSchema);

async function connect() {
    await mongoose.connect(MONGODB_URI, { dbName: MONGODB_DB_NAME });
}

async function getSeedUser() {
    const existingUser = await UserModel.findOne({}).sort({ createdAt: 1 }).lean();
    if (existingUser) {
        return { user: existingUser, created: false };
    }

    const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
    const role = await RoleModel.findOne({ slug: "client" }).lean();
    const userData = {
        email: DEFAULT_EMAIL,
        name: DEFAULT_NAME,
        passwordHash,
        emailVerified: new Date(),
        roleIds: role ? [role._id] : [],
    };
    const createdUser = await UserModel.create(userData);
    return { user: createdUser.toObject(), created: true };
}

async function ensureChatbotSession(userId) {
    const sessionName = DEFAULT_SESSION_NAME || "Seeded Widget Chatbot";
    const existing = await ChatSessionModel.findOne({ userId, name: sessionName }).lean();
    if (existing) {
        return existing;
    }

    const created = await ChatSessionModel.create({
        userId,
        name: sessionName,
        primaryColor: DEFAULT_PRIMARY_COLOR,
        selectedRagKeys: [],
    });
    return created.toObject();
}

async function main() {
    await connect();

    const { user, created } = await getSeedUser();
    const session = await ensureChatbotSession(user._id);

    const snippet = `<script src="${DEFAULT_ORIGIN}/chatbot-widget.js" data-bot-id="${session._id}"></script>`;

    console.log(`Seed user: ${user.email}${created ? " (created demo user)" : ""}`);
    if (created) {
        console.log(`Demo password: ${DEFAULT_PASSWORD}`);
    }
    console.log(`Seeded chatbot session: ${session.name} (${session._id})`);
    console.log(`Open dashboard: ${DEFAULT_ORIGIN}/dashboard/get-script`);
    console.log("Embed snippet:");
    console.log(snippet);
}

main()
    .catch((error) => {
        console.error(error);
        process.exit(1);
    })
    .finally(async () => {
        await mongoose.disconnect().catch(() => {});
    });