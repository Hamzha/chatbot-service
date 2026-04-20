/**
 * Integration tests for `chatbotDocumentRepo` against an in-memory MongoDB.
 *
 * Focus areas:
 *  - Create/upsert/finalize flow for both PDF uploads and scrape ingestion.
 *  - User-scoped lookups (`getChatbotDocument`, `listChatbotDocuments`).
 *  - Delete semantics — the case that produced the user-reported 404.
 *  - Malformed ObjectId handling (current behaviour: throws).
 */
import { beforeAll, describe, expect, it } from "vitest";
import { Types } from "mongoose";
import { setupMongoTestEnv } from "@/lib/testing/mongo";
import {
    ChatbotDocumentModel,
    createPendingChatbotDocument,
    deleteChatbotDocument,
    deleteChatbotDocumentById,
    effectiveQuerySourceIds,
    effectiveRagSourceKey,
    finalizeChatbotDocument,
    findChatbotDocumentsByRagKeys,
    getChatbotDocument,
    listChatbotDocuments,
    upsertChatbotDocument,
    upsertChatbotSiteDocument,
} from "@/lib/db/chatbotDocumentRepo";

setupMongoTestEnv();

// Unique indexes (userId+source) are declared on the schema but only built
// asynchronously on first use. Force them here so duplicate detection is
// deterministic from the very first test.
beforeAll(async () => {
    await ChatbotDocumentModel.syncIndexes();
});

function newUserId(): string {
    return new Types.ObjectId().toString();
}

describe("createPendingChatbotDocument", () => {
    it("creates a record with a fresh ragSourceKey and 0 chunks", async () => {
        const userId = newUserId();
        const doc = await createPendingChatbotDocument(userId, "cv.pdf");

        expect(doc.userId).toBe(userId);
        expect(doc.source).toBe("cv.pdf");
        expect(doc.chunks).toBe(0);
        expect(Types.ObjectId.isValid(doc.ragSourceKey)).toBe(true);
    });

    it("rejects duplicate source for the same user with a friendly error", async () => {
        const userId = newUserId();
        await createPendingChatbotDocument(userId, "cv.pdf");

        await expect(
            createPendingChatbotDocument(userId, "cv.pdf"),
        ).rejects.toThrow(/already exists/i);
    });

    it("permits the same source for different users", async () => {
        const userA = newUserId();
        const userB = newUserId();
        await createPendingChatbotDocument(userA, "cv.pdf");
        await expect(
            createPendingChatbotDocument(userB, "cv.pdf"),
        ).resolves.toBeDefined();
    });
});

describe("finalizeChatbotDocument", () => {
    it("updates chunk count and returns the record", async () => {
        const userId = newUserId();
        const created = await createPendingChatbotDocument(userId, "cv.pdf");

        const finalized = await finalizeChatbotDocument(userId, created.id, 12);
        expect(finalized).not.toBeNull();
        expect(finalized!.chunks).toBe(12);
    });

    it("returns null when the document does not belong to the caller", async () => {
        const owner = newUserId();
        const stranger = newUserId();
        const created = await createPendingChatbotDocument(owner, "cv.pdf");

        const res = await finalizeChatbotDocument(stranger, created.id, 12);
        expect(res).toBeNull();
    });
});

describe("upsertChatbotDocument (scrape ingestion path)", () => {
    it("creates a new row with the supplied ragSourceKey", async () => {
        const userId = newUserId();
        const rec = await upsertChatbotDocument(
            userId,
            "example.com/",
            4,
            "rag-key-1",
        );

        expect(rec.source).toBe("example.com/");
        expect(rec.chunks).toBe(4);
        expect(rec.ragSourceKey).toBe("rag-key-1");
    });

    it("updates chunks and ragSourceKey on re-ingest of the same source", async () => {
        const userId = newUserId();
        await upsertChatbotDocument(userId, "example.com/", 4, "rag-key-1");

        const updated = await upsertChatbotDocument(
            userId,
            "example.com/",
            7,
            "rag-key-2",
        );
        expect(updated.chunks).toBe(7);
        expect(updated.ragSourceKey).toBe("rag-key-2");

        const list = await listChatbotDocuments(userId);
        expect(list).toHaveLength(1);
    });

    it("defaults ragSourceKey to display source when none is supplied", async () => {
        const userId = newUserId();
        const rec = await upsertChatbotDocument(userId, "legacy.pdf", 3);
        expect(rec.ragSourceKey).toBe("legacy.pdf");
    });
});

describe("upsertChatbotSiteDocument", () => {
    it("creates a new kind:site row with a single page on first call", async () => {
        const userId = newUserId();
        const rec = await upsertChatbotSiteDocument({
            userId,
            siteKey: "https://example.com",
            displaySource: "example.com",
            pageKey: "https://example.com/about",
            pageChunks: 4,
        });

        expect(rec.kind).toBe("site");
        expect(rec.ragSourceKey).toBe("https://example.com");
        expect(rec.source).toBe("example.com");
        expect(rec.chunks).toBe(4);
        expect(rec.pages).toEqual([{ key: "https://example.com/about", chunks: 4 }]);
    });

    it("appends distinct pages and accumulates total chunks", async () => {
        const userId = newUserId();
        await upsertChatbotSiteDocument({
            userId,
            siteKey: "https://example.com",
            displaySource: "example.com",
            pageKey: "https://example.com/a",
            pageChunks: 2,
        });
        const rec = await upsertChatbotSiteDocument({
            userId,
            siteKey: "https://example.com",
            displaySource: "example.com",
            pageKey: "https://example.com/b",
            pageChunks: 5,
        });

        expect(rec.chunks).toBe(7);
        expect(rec.pages.map((p) => p.key).sort()).toEqual([
            "https://example.com/a",
            "https://example.com/b",
        ]);

        const list = await listChatbotDocuments(userId);
        expect(list).toHaveLength(1);
    });

    it("re-ingesting the same page replaces that page's chunks (recomputes total, no duplicate)", async () => {
        const userId = newUserId();
        await upsertChatbotSiteDocument({
            userId,
            siteKey: "https://example.com",
            displaySource: "example.com",
            pageKey: "https://example.com/a",
            pageChunks: 10,
        });
        await upsertChatbotSiteDocument({
            userId,
            siteKey: "https://example.com",
            displaySource: "example.com",
            pageKey: "https://example.com/b",
            pageChunks: 4,
        });
        const rec = await upsertChatbotSiteDocument({
            userId,
            siteKey: "https://example.com",
            displaySource: "example.com",
            pageKey: "https://example.com/a",
            pageChunks: 3,
        });

        expect(rec.chunks).toBe(7);
        const byKey = Object.fromEntries(rec.pages.map((p) => [p.key, p.chunks]));
        expect(byKey).toEqual({
            "https://example.com/a": 3,
            "https://example.com/b": 4,
        });
    });

    it("scopes rows per user (two users with the same site)", async () => {
        const userA = newUserId();
        const userB = newUserId();
        await upsertChatbotSiteDocument({
            userId: userA,
            siteKey: "https://shared.com",
            displaySource: "shared.com",
            pageKey: "https://shared.com/a",
            pageChunks: 1,
        });
        await upsertChatbotSiteDocument({
            userId: userB,
            siteKey: "https://shared.com",
            displaySource: "shared.com",
            pageKey: "https://shared.com/x",
            pageChunks: 2,
        });

        expect(await listChatbotDocuments(userA)).toHaveLength(1);
        expect(await listChatbotDocuments(userB)).toHaveLength(1);
    });

    it("rejects empty siteKey / pageKey loudly rather than silently creating bad rows", async () => {
        const userId = newUserId();
        await expect(
            upsertChatbotSiteDocument({
                userId,
                siteKey: "",
                displaySource: "example.com",
                pageKey: "https://example.com/a",
                pageChunks: 1,
            }),
        ).rejects.toThrow(/siteKey/);
        await expect(
            upsertChatbotSiteDocument({
                userId,
                siteKey: "https://example.com",
                displaySource: "example.com",
                pageKey: "   ",
                pageChunks: 1,
            }),
        ).rejects.toThrow(/pageKey/);
    });
});

describe("effectiveQuerySourceIds", () => {
    it("returns the single ragSourceKey for upload docs", () => {
        expect(
            effectiveQuerySourceIds({
                id: "x",
                userId: "u",
                source: "cv.pdf",
                ragSourceKey: "rag-1",
                chunks: 1,
                kind: "upload",
                pages: [],
                createdAt: "",
                updatedAt: "",
            }),
        ).toEqual(["rag-1"]);
    });

    it("returns every page.key for site docs (deduped)", () => {
        expect(
            effectiveQuerySourceIds({
                id: "x",
                userId: "u",
                source: "example.com",
                ragSourceKey: "https://example.com",
                chunks: 3,
                kind: "site",
                pages: [
                    { key: "https://example.com/a", chunks: 1 },
                    { key: "https://example.com/b", chunks: 2 },
                    { key: "https://example.com/a", chunks: 1 }, // shouldn't really happen, but dedupe defensively
                ],
                createdAt: "",
                updatedAt: "",
            }),
        ).toEqual(["https://example.com/a", "https://example.com/b"]);
    });

    it("falls back to ragSourceKey when a site row has no pages", () => {
        expect(
            effectiveQuerySourceIds({
                id: "x",
                userId: "u",
                source: "example.com",
                ragSourceKey: "https://example.com",
                chunks: 0,
                kind: "site",
                pages: [],
                createdAt: "",
                updatedAt: "",
            }),
        ).toEqual(["https://example.com"]);
    });
});

describe("findChatbotDocumentsByRagKeys", () => {
    it("returns only rows for the given user + keys", async () => {
        const userA = newUserId();
        const userB = newUserId();
        await upsertChatbotSiteDocument({
            userId: userA,
            siteKey: "https://a.com",
            displaySource: "a.com",
            pageKey: "https://a.com/x",
            pageChunks: 1,
        });
        await upsertChatbotSiteDocument({
            userId: userA,
            siteKey: "https://b.com",
            displaySource: "b.com",
            pageKey: "https://b.com/x",
            pageChunks: 1,
        });
        await upsertChatbotSiteDocument({
            userId: userB,
            siteKey: "https://a.com",
            displaySource: "a.com",
            pageKey: "https://a.com/y",
            pageChunks: 1,
        });

        const rows = await findChatbotDocumentsByRagKeys(userA, [
            "https://a.com",
            "https://c.com", // does not exist
        ]);
        expect(rows).toHaveLength(1);
        expect(rows[0].ragSourceKey).toBe("https://a.com");
        expect(rows[0].userId).toBe(userA);
    });

    it("returns [] for empty input", async () => {
        const userId = newUserId();
        expect(await findChatbotDocumentsByRagKeys(userId, [])).toEqual([]);
        expect(await findChatbotDocumentsByRagKeys(userId, ["", "   "])).toEqual([]);
    });
});

describe("effectiveRagSourceKey", () => {
    it("prefers ragSourceKey when present and non-empty", () => {
        expect(
            effectiveRagSourceKey({
                id: "x",
                userId: "u",
                source: "cv.pdf",
                ragSourceKey: "rag-abc",
                chunks: 1,
                createdAt: "",
                updatedAt: "",
            }),
        ).toBe("rag-abc");
    });

    it("falls back to display source when ragSourceKey is missing/empty", () => {
        expect(
            effectiveRagSourceKey({
                id: "x",
                userId: "u",
                source: "legacy.pdf",
                ragSourceKey: "",
                chunks: 1,
                createdAt: "",
                updatedAt: "",
            }),
        ).toBe("legacy.pdf");
    });
});

describe("getChatbotDocument", () => {
    it("returns the record for the owner", async () => {
        const userId = newUserId();
        const doc = await createPendingChatbotDocument(userId, "cv.pdf");

        const fetched = await getChatbotDocument(userId, doc.id);
        expect(fetched).not.toBeNull();
        expect(fetched!.id).toBe(doc.id);
    });

    it("returns null for a different user (data-scoping)", async () => {
        const owner = newUserId();
        const stranger = newUserId();
        const doc = await createPendingChatbotDocument(owner, "cv.pdf");

        const fetched = await getChatbotDocument(stranger, doc.id);
        expect(fetched).toBeNull();
    });

    it("returns null for a well-formed but non-existent ObjectId", async () => {
        const userId = newUserId();
        const ghostId = new Types.ObjectId().toString();
        const fetched = await getChatbotDocument(userId, ghostId);
        expect(fetched).toBeNull();
    });

    it("returns null for malformed ObjectId (no throw)", async () => {
        const userId = newUserId();
        await expect(getChatbotDocument(userId, "not-valid")).resolves.toBeNull();
    });

    it("deleteChatbotDocumentById returns null for malformed ObjectId (no throw)", async () => {
        const userId = newUserId();
        await expect(deleteChatbotDocumentById(userId, "garbage")).resolves.toBeNull();
    });
});

describe("listChatbotDocuments", () => {
    it("returns rows newest-first, scoped to the user", async () => {
        const userA = newUserId();
        const userB = newUserId();
        const a1 = await createPendingChatbotDocument(userA, "a1.pdf");
        await new Promise((r) => setTimeout(r, 5));
        const a2 = await createPendingChatbotDocument(userA, "a2.pdf");
        await createPendingChatbotDocument(userB, "b1.pdf");

        const list = await listChatbotDocuments(userA);
        expect(list.map((d) => d.id)).toEqual([a2.id, a1.id]);
    });
});

describe("deleteChatbotDocumentById — the 404 repro", () => {
    it("returns the deleted record on success", async () => {
        const userId = newUserId();
        const doc = await createPendingChatbotDocument(userId, "cv.pdf");

        const deleted = await deleteChatbotDocumentById(userId, doc.id);
        expect(deleted).not.toBeNull();
        expect(deleted!.id).toBe(doc.id);

        const after = await getChatbotDocument(userId, doc.id);
        expect(after).toBeNull();
    });

    it("returns null when the document belongs to another user (would 404 the caller)", async () => {
        const owner = newUserId();
        const stranger = newUserId();
        const doc = await createPendingChatbotDocument(owner, "cv.pdf");

        const deleted = await deleteChatbotDocumentById(stranger, doc.id);
        expect(deleted).toBeNull();

        // The document still exists for its real owner.
        const stillThere = await getChatbotDocument(owner, doc.id);
        expect(stillThere).not.toBeNull();
    });

    it("returns null on a well-formed but missing ObjectId (the common user-reported 404)", async () => {
        const userId = newUserId();
        const ghostId = new Types.ObjectId().toString();
        const deleted = await deleteChatbotDocumentById(userId, ghostId);
        expect(deleted).toBeNull();
    });
});

describe("deleteChatbotDocument (deprecated source-based delete)", () => {
    it("deletes by display source and returns true when found", async () => {
        const userId = newUserId();
        await createPendingChatbotDocument(userId, "cv.pdf");

        const ok = await deleteChatbotDocument(userId, "cv.pdf");
        expect(ok).toBe(true);
    });

    it("returns false when nothing matches", async () => {
        const userId = newUserId();
        const ok = await deleteChatbotDocument(userId, "missing.pdf");
        expect(ok).toBe(false);
    });
});
