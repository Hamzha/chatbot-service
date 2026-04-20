/**
 * Integration test for `expandSessionRagKeys` against real (in-memory) Mongo.
 * Verifies that chat sessions storing a site-level ragSourceKey correctly expand
 * to the full per-page key list for the `source_ids` payload sent to Chroma.
 */
import { describe, expect, it } from "vitest";
import { Types } from "mongoose";
import { setupMongoTestEnv } from "@/lib/testing/mongo";
import {
    upsertChatbotDocument,
    upsertChatbotSiteDocument,
} from "@/lib/db/chatbotDocumentRepo";
import { expandSessionRagKeys } from "@/lib/chatbot/expandSessionRagKeys";

setupMongoTestEnv();

function newUserId(): string {
    return new Types.ObjectId().toString();
}

describe("expandSessionRagKeys (DB-backed)", () => {
    it("expands a site key to every stored page.key", async () => {
        const userId = newUserId();
        await upsertChatbotSiteDocument({
            userId,
            siteKey: "https://example.com",
            displaySource: "example.com",
            pageKey: "https://example.com/a",
            pageChunks: 1,
        });
        await upsertChatbotSiteDocument({
            userId,
            siteKey: "https://example.com",
            displaySource: "example.com",
            pageKey: "https://example.com/b",
            pageChunks: 1,
        });

        const expanded = await expandSessionRagKeys(userId, ["https://example.com"]);
        expect(expanded.sort()).toEqual([
            "https://example.com/a",
            "https://example.com/b",
        ]);
    });

    it("newly-added pages appear automatically in existing sessions (no session migration needed)", async () => {
        const userId = newUserId();
        await upsertChatbotSiteDocument({
            userId,
            siteKey: "https://example.com",
            displaySource: "example.com",
            pageKey: "https://example.com/old",
            pageChunks: 1,
        });

        const before = await expandSessionRagKeys(userId, ["https://example.com"]);
        expect(before).toEqual(["https://example.com/old"]);

        // Simulate a re-crawl that discovers a new page.
        await upsertChatbotSiteDocument({
            userId,
            siteKey: "https://example.com",
            displaySource: "example.com",
            pageKey: "https://example.com/new",
            pageChunks: 1,
        });

        const after = await expandSessionRagKeys(userId, ["https://example.com"]);
        expect(after.sort()).toEqual([
            "https://example.com/new",
            "https://example.com/old",
        ]);
    });

    it("mixes upload PDF keys and site keys in one session", async () => {
        const userId = newUserId();
        await upsertChatbotDocument(userId, "cv.pdf", 4, "rag-cv");
        await upsertChatbotSiteDocument({
            userId,
            siteKey: "https://example.com",
            displaySource: "example.com",
            pageKey: "https://example.com/a",
            pageChunks: 1,
        });

        const expanded = await expandSessionRagKeys(userId, [
            "rag-cv",
            "https://example.com",
        ]);
        expect(expanded).toEqual(["rag-cv", "https://example.com/a"]);
    });

    it("passes through an unknown key (session references a deleted/legacy doc)", async () => {
        const userId = newUserId();
        const expanded = await expandSessionRagKeys(userId, [
            "https://gone.example/page",
        ]);
        expect(expanded).toEqual(["https://gone.example/page"]);
    });

    it("enforces per-user scoping (does not leak another user's site keys)", async () => {
        const userA = newUserId();
        const userB = newUserId();
        await upsertChatbotSiteDocument({
            userId: userA,
            siteKey: "https://shared.com",
            displaySource: "shared.com",
            pageKey: "https://shared.com/a-only",
            pageChunks: 1,
        });
        await upsertChatbotSiteDocument({
            userId: userB,
            siteKey: "https://shared.com",
            displaySource: "shared.com",
            pageKey: "https://shared.com/b-only",
            pageChunks: 1,
        });

        const forA = await expandSessionRagKeys(userA, ["https://shared.com"]);
        expect(forA).toEqual(["https://shared.com/a-only"]);
        const forB = await expandSessionRagKeys(userB, ["https://shared.com"]);
        expect(forB).toEqual(["https://shared.com/b-only"]);
    });
});
