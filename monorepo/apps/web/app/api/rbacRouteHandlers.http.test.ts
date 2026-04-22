import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthContext } from "@/lib/auth/authorization";

vi.mock("@repo/auth/lib/cookies", () => ({
    getSessionCookie: vi.fn(),
}));

vi.mock("@repo/auth/lib/jwt", () => ({
    verifySessionToken: vi.fn(),
}));

vi.mock("@/lib/auth/authorization", () => ({
    getAuthContextForUserId: vi.fn(),
}));

vi.mock("@/lib/db/roleRepo", () => ({
    listRoles: vi.fn(),
    createRole: vi.fn(),
    findRoleById: vi.fn(),
    updateRole: vi.fn(),
    deleteRoleById: vi.fn(),
}));

vi.mock("@/lib/db/userRepo", () => ({
    listUsersForAdmin: vi.fn(),
    getAdminUserRow: vi.fn(),
    updateUserRoleIds: vi.fn(),
}));

vi.mock("@/lib/db/permissionRepo", () => ({
    listPermissions: vi.fn(),
}));

vi.mock("@/lib/db/chatbotDocumentRepo", () => ({
    listChatbotDocuments: vi.fn(),
    finalizeChatbotDocument: vi.fn(),
    createPendingChatbotDocument: vi.fn(),
    getChatbotDocument: vi.fn(),
    deleteChatbotDocumentById: vi.fn(),
}));

vi.mock("@/lib/db/chatSessionRepo", () => ({
    listChatSessions: vi.fn(),
    createChatSession: vi.fn(),
    resolveSessionSelectedDocuments: vi.fn(),
    getChatSession: vi.fn(),
    updateChatSession: vi.fn(),
    deleteChatSession: vi.fn(),
}));

vi.mock("@/lib/db/chatbotMessageRepo", () => ({
    listChatbotMessages: vi.fn(),
    appendChatbotExchange: vi.fn(),
    clearChatbotMessages: vi.fn(),
    deleteMessagesForSession: vi.fn(),
}));

vi.mock("@/lib/db/crawlJobRepo", () => ({
    createCrawlJob: vi.fn(),
    getCrawlJob: vi.fn(),
    listCrawlJobsForUser: vi.fn(),
}));

vi.mock("@/lib/scraper/crawlJobWorker", () => ({
    runCrawlJob: vi.fn(),
}));

vi.mock("@/lib/rateLimit/requireRateLimit", () => ({
    requireRateLimitByUser: vi.fn(),
    requireRateLimitByIp: vi.fn(),
}));

import { getSessionCookie } from "@repo/auth/lib/cookies";
import { verifySessionToken } from "@repo/auth/lib/jwt";
import { getAuthContextForUserId } from "@/lib/auth/authorization";
import {
    createRole,
    deleteRoleById,
    findRoleById,
    listRoles,
    updateRole,
} from "@/lib/db/roleRepo";
import { getAdminUserRow, listUsersForAdmin, updateUserRoleIds } from "@/lib/db/userRepo";
import { listPermissions } from "@/lib/db/permissionRepo";
import {
    deleteChatbotDocumentById,
    finalizeChatbotDocument,
    getChatbotDocument,
    listChatbotDocuments,
} from "@/lib/db/chatbotDocumentRepo";
import {
    createChatSession,
    deleteChatSession,
    getChatSession,
    listChatSessions,
    resolveSessionSelectedDocuments,
    updateChatSession,
} from "@/lib/db/chatSessionRepo";
import {
    appendChatbotExchange,
    clearChatbotMessages,
    listChatbotMessages,
} from "@/lib/db/chatbotMessageRepo";
import {
    createCrawlJob,
    getCrawlJob,
    listCrawlJobsForUser,
} from "@/lib/db/crawlJobRepo";
import { runCrawlJob } from "@/lib/scraper/crawlJobWorker";

import { GET as adminPermissionsGet } from "@/app/api/admin/permissions/route";
import { GET as adminRolesGet, POST as adminRolesPost } from "@/app/api/admin/roles/route";
import {
    DELETE as adminRoleDelete,
    GET as adminRoleByIdGet,
    PATCH as adminRoleByIdPatch,
} from "@/app/api/admin/roles/[id]/route";
import { GET as adminUsersGet } from "@/app/api/admin/users/route";
import { GET as adminUserByIdGet, PATCH as adminUserByIdPatch } from "@/app/api/admin/users/[id]/route";
import { GET as chatbotDocumentsGet, POST as chatbotDocumentsPost } from "@/app/api/chatbot/documents/route";
import { DELETE as chatbotDocumentByIdDelete } from "@/app/api/chatbot/documents/[documentId]/route";
import { POST as chatbotIngestPost } from "@/app/api/chatbot/ingest/route";
import { GET as chatbotSourcesGet } from "@/app/api/chatbot/sources/route";
import { DELETE as chatbotSourceByIdDelete } from "@/app/api/chatbot/sources/[sourceId]/route";
import { POST as chatbotQueryPost } from "@/app/api/chatbot/query/route";
import { GET as chatbotJobGet } from "@/app/api/chatbot/jobs/[eventId]/route";
import { GET as chatbotSessionsGet, POST as chatbotSessionsPost } from "@/app/api/chatbot/sessions/route";
import {
    DELETE as chatbotSessionByIdDelete,
    GET as chatbotSessionByIdGet,
    PATCH as chatbotSessionByIdPatch,
} from "@/app/api/chatbot/sessions/[sessionId]/route";
import { DELETE as chatbotMessagesDelete, GET as chatbotMessagesGet, POST as chatbotMessagesPost } from "@/app/api/chatbot/messages/route";
import { NextRequest, NextResponse } from "next/server";
import { POST as scraperScrapePost } from "@/app/api/scraper/scrape/route";
import { requireRateLimitByIp, requireRateLimitByUser } from "@/lib/rateLimit/requireRateLimit";
import {
    GET as scraperCrawlJobsGet,
    POST as scraperCrawlJobsPost,
} from "@/app/api/scraper/crawl/jobs/route";
import { GET as scraperCrawlJobByIdGet } from "@/app/api/scraper/crawl/jobs/[jobId]/route";

function authCtx(permissions: Iterable<string>, userId = "user-1"): AuthContext {
    return {
        userId,
        permissions: new Set(permissions),
        roles: [],
    };
}

function noSession(): void {
    vi.mocked(getSessionCookie).mockResolvedValue(null);
}

function badJwt(): void {
    vi.mocked(getSessionCookie).mockResolvedValue("bad");
    vi.mocked(verifySessionToken).mockRejectedValue(new Error("invalid jwt"));
}

function goodSession(sub = "user-1"): void {
    vi.mocked(getSessionCookie).mockResolvedValue("session-token");
    vi.mocked(verifySessionToken).mockResolvedValue({ sub } as never);
}

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireRateLimitByUser).mockResolvedValue(undefined);
    vi.mocked(requireRateLimitByIp).mockResolvedValue(undefined);
});

describe("GET /api/admin/roles", () => {
    it("401 when there is no session cookie", async () => {
        noSession();
        const res = await adminRolesGet();
        expect(res.status).toBe(401);
    });

    it("401 when JWT verification fails", async () => {
        badJwt();
        const res = await adminRolesGet();
        expect(res.status).toBe(401);
    });

    it("401 when auth context cannot be loaded", async () => {
        goodSession();
        vi.mocked(getAuthContextForUserId).mockResolvedValue(null);
        const res = await adminRolesGet();
        expect(res.status).toBe(401);
    });

    it("403 when user lacks roles:read", async () => {
        goodSession();
        vi.mocked(getAuthContextForUserId).mockResolvedValue(
            authCtx(["dashboard:read", "chatbot_documents:read"]),
        );
        const res = await adminRolesGet();
        expect(res.status).toBe(403);
    });

    it("200 with roles payload when user has roles:read", async () => {
        goodSession();
        vi.mocked(getAuthContextForUserId).mockResolvedValue(authCtx(["roles:read"]));
        vi.mocked(listRoles).mockResolvedValue([
            {
                id: "r1",
                name: "Admin",
                slug: "admin",
                description: "",
                isSystem: true,
                enabled: true,
                permissionCodes: ["dashboard:read"],
            },
        ]);
        const res = await adminRolesGet();
        expect(res.status).toBe(200);
        const body = (await res.json()) as { roles: unknown[] };
        expect(body.roles).toHaveLength(1);
        expect(body.roles[0]).toMatchObject({ slug: "admin" });
    });
});

describe("GET /api/admin/users/[id]", () => {
    const params = Promise.resolve({ id: "507f1f77bcf86cd799439011" });

    it("403 without users:read", async () => {
        goodSession();
        vi.mocked(getAuthContextForUserId).mockResolvedValue(authCtx(["roles:read"]));
        const res = await adminUserByIdGet(new Request("http://localhost"), { params });
        expect(res.status).toBe(403);
    });

    it("200 when user row exists", async () => {
        goodSession();
        vi.mocked(getAuthContextForUserId).mockResolvedValue(authCtx(["users:read"]));
        vi.mocked(getAdminUserRow).mockResolvedValue({
            id: "507f1f77bcf86cd799439011",
            email: "u@example.com",
            name: "U",
            createdAt: new Date().toISOString(),
            emailVerified: true,
            roleIds: [],
            roles: [],
        });
        const res = await adminUserByIdGet(new Request("http://localhost"), { params });
        expect(res.status).toBe(200);
        const body = (await res.json()) as { user: { email: string } };
        expect(body.user.email).toBe("u@example.com");
    });
});

describe("GET /api/admin/users", () => {
    it("403 without users:read", async () => {
        goodSession();
        vi.mocked(getAuthContextForUserId).mockResolvedValue(authCtx(["roles:read"]));
        const res = await adminUsersGet();
        expect(res.status).toBe(403);
    });

    it("200 with users when user has users:read", async () => {
        goodSession();
        vi.mocked(getAuthContextForUserId).mockResolvedValue(authCtx(["users:read"]));
        vi.mocked(listUsersForAdmin).mockResolvedValue([
            {
                id: "u1",
                email: "a@example.com",
                name: "A",
                createdAt: new Date().toISOString(),
                emailVerified: true,
                roleIds: [],
                roles: [],
            },
        ]);
        const res = await adminUsersGet();
        expect(res.status).toBe(200);
        const body = (await res.json()) as { users: unknown[] };
        expect(body.users).toHaveLength(1);
    });

    it("429 when the users list rate limit is exceeded", async () => {
        goodSession();
        vi.mocked(getAuthContextForUserId).mockResolvedValue(authCtx(["users:read"]));
        vi.mocked(requireRateLimitByUser).mockResolvedValue(
            NextResponse.json({ error: "Too many requests" }, { status: 429 }),
        );
        const res = await adminUsersGet();
        expect(res.status).toBe(429);
    });
});

describe("GET /api/admin/permissions", () => {
    it("403 without roles:read", async () => {
        goodSession();
        vi.mocked(getAuthContextForUserId).mockResolvedValue(authCtx(["users:read"]));
        const res = await adminPermissionsGet();
        expect(res.status).toBe(403);
    });

    it("200 when user has roles:read", async () => {
        goodSession();
        vi.mocked(getAuthContextForUserId).mockResolvedValue(authCtx(["roles:read"]));
        vi.mocked(listPermissions).mockResolvedValue([
            {
                id: "p1",
                code: "dashboard:read",
                module: "dashboard",
                action: "read",
                description: "Access the dashboard shell and overview",
            },
        ]);
        const res = await adminPermissionsGet();
        expect(res.status).toBe(200);
        const body = (await res.json()) as { permissions: unknown[] };
        expect(body.permissions).toHaveLength(1);
    });
});

describe("POST /api/admin/roles", () => {
    it("403 without roles:create", async () => {
        goodSession();
        vi.mocked(getAuthContextForUserId).mockResolvedValue(authCtx(["roles:read"]));
        const res = await adminRolesPost(
            new Request("http://localhost/api/admin/roles", {
                method: "POST",
                body: JSON.stringify({ name: "X", slug: "x", permissionCodes: [] }),
                headers: { "content-type": "application/json" },
            }),
        );
        expect(res.status).toBe(403);
    });

    it("400 when body is invalid JSON", async () => {
        goodSession();
        vi.mocked(getAuthContextForUserId).mockResolvedValue(authCtx(["roles:create"]));
        const res = await adminRolesPost(
            new Request("http://localhost/api/admin/roles", {
                method: "POST",
                body: "not-json",
                headers: { "content-type": "application/json" },
            }),
        );
        expect(res.status).toBe(400);
    });

    it("201 when create succeeds", async () => {
        goodSession();
        vi.mocked(getAuthContextForUserId).mockResolvedValue(authCtx(["roles:create"]));
        vi.mocked(createRole).mockResolvedValue({
            id: "new1",
            name: "Custom",
            slug: "custom",
            description: "",
            isSystem: false,
            enabled: true,
            permissionCodes: ["dashboard:read"],
        });
        const res = await adminRolesPost(
            new Request("http://localhost/api/admin/roles", {
                method: "POST",
                body: JSON.stringify({
                    name: "Custom",
                    slug: "custom",
                    permissionCodes: ["dashboard:read"],
                }),
                headers: { "content-type": "application/json" },
            }),
        );
        expect(res.status).toBe(201);
        const body = (await res.json()) as { role: { slug: string } };
        expect(body.role.slug).toBe("custom");
    });

    it("429 when role creation rate limit is exceeded", async () => {
        goodSession();
        vi.mocked(getAuthContextForUserId).mockResolvedValue(authCtx(["roles:create"]));
        vi.mocked(requireRateLimitByUser).mockResolvedValue(
            NextResponse.json({ error: "Too many requests" }, { status: 429 }),
        );
        const res = await adminRolesPost(
            new Request("http://localhost/api/admin/roles", {
                method: "POST",
                body: JSON.stringify({
                    name: "Custom",
                    slug: "custom",
                    permissionCodes: ["dashboard:read"],
                }),
                headers: { "content-type": "application/json" },
            }),
        );
        expect(res.status).toBe(429);
    });
});

describe("GET /api/admin/roles/[id]", () => {
    const params = Promise.resolve({ id: "507f1f77bcf86cd799439011" });

    it("403 without roles:read", async () => {
        goodSession();
        vi.mocked(getAuthContextForUserId).mockResolvedValue(authCtx(["roles:create"]));
        const res = await adminRoleByIdGet(new Request("http://localhost"), { params });
        expect(res.status).toBe(403);
    });

    it("404 when role missing", async () => {
        goodSession();
        vi.mocked(getAuthContextForUserId).mockResolvedValue(authCtx(["roles:read"]));
        vi.mocked(findRoleById).mockResolvedValue(null);
        const res = await adminRoleByIdGet(new Request("http://localhost"), { params });
        expect(res.status).toBe(404);
    });

    it("200 when role exists", async () => {
        goodSession();
        vi.mocked(getAuthContextForUserId).mockResolvedValue(authCtx(["roles:read"]));
        vi.mocked(findRoleById).mockResolvedValue({
            id: "507f1f77bcf86cd799439011",
            name: "Client",
            slug: "client",
            description: "",
            isSystem: true,
            enabled: true,
            permissionCodes: ["dashboard:read"],
        });
        const res = await adminRoleByIdGet(new Request("http://localhost"), { params });
        expect(res.status).toBe(200);
        const body = (await res.json()) as { role: { slug: string } };
        expect(body.role.slug).toBe("client");
    });
});

describe("PATCH /api/admin/roles/[id]", () => {
    const params = Promise.resolve({ id: "507f1f77bcf86cd799439011" });

    it("403 without roles:update", async () => {
        goodSession();
        vi.mocked(getAuthContextForUserId).mockResolvedValue(authCtx(["roles:read"]));
        const res = await adminRoleByIdPatch(
            new Request("http://localhost", {
                method: "PATCH",
                body: JSON.stringify({ name: "N" }),
                headers: { "content-type": "application/json" },
            }),
            { params },
        );
        expect(res.status).toBe(403);
    });

    it("409 when disabling a system role", async () => {
        goodSession();
        vi.mocked(getAuthContextForUserId).mockResolvedValue(authCtx(["roles:update"]));
        vi.mocked(updateRole).mockRejectedValue(new Error("System roles cannot be disabled."));
        const res = await adminRoleByIdPatch(
            new Request("http://localhost", {
                method: "PATCH",
                body: JSON.stringify({ enabled: false }),
                headers: { "content-type": "application/json" },
            }),
            { params },
        );
        expect(res.status).toBe(409);
        const body = (await res.json()) as { error: string };
        expect(body.error).toContain("System roles cannot");
    });
});

describe("DELETE /api/admin/roles/[id]", () => {
    const params = Promise.resolve({ id: "507f1f77bcf86cd799439011" });

    it("403 without roles:delete", async () => {
        goodSession();
        vi.mocked(getAuthContextForUserId).mockResolvedValue(authCtx(["roles:update"]));
        const res = await adminRoleDelete(
            new Request("http://localhost", { method: "DELETE", body: "{}" }),
            { params },
        );
        expect(res.status).toBe(403);
    });

    it("200 when delete succeeds", async () => {
        goodSession();
        vi.mocked(getAuthContextForUserId).mockResolvedValue(authCtx(["roles:delete"]));
        vi.mocked(deleteRoleById).mockResolvedValue({ ok: true });
        const res = await adminRoleDelete(
            new Request("http://localhost", { method: "DELETE", body: "{}" }),
            { params },
        );
        expect(res.status).toBe(200);
        const body = (await res.json()) as { ok: boolean };
        expect(body.ok).toBe(true);
    });
});

describe("GET /api/chatbot/documents", () => {
    it("403 without chatbot_documents:read", async () => {
        goodSession();
        vi.mocked(getAuthContextForUserId).mockResolvedValue(
            authCtx(["chatbot_sessions:read"]),
        );
        const res = await chatbotDocumentsGet();
        expect(res.status).toBe(403);
    });

    it("200 lists documents for permitted user", async () => {
        goodSession();
        vi.mocked(getAuthContextForUserId).mockResolvedValue(authCtx(["chatbot_documents:read"]));
        vi.mocked(listChatbotDocuments).mockResolvedValue([
            {
                id: "d1",
                userId: "user-1",
                source: "doc.pdf",
                ragSourceKey: "k1",
                chunks: 3,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            },
        ]);
        const res = await chatbotDocumentsGet();
        expect(res.status).toBe(200);
        const body = (await res.json()) as { sources: { id: string }[] };
        expect(body.sources).toHaveLength(1);
        expect(body.sources[0].id).toBe("d1");
    });
});

describe("GET /api/chatbot/sessions", () => {
    it("403 without chatbot_sessions:read (mediator-style gap)", async () => {
        goodSession();
        vi.mocked(getAuthContextForUserId).mockResolvedValue(
            authCtx(["dashboard:read"]),
        );
        const res = await chatbotSessionsGet();
        expect(res.status).toBe(403);
    });

    it("200 when user has chatbot_sessions:read", async () => {
        goodSession();
        vi.mocked(getAuthContextForUserId).mockResolvedValue(authCtx(["chatbot_sessions:read"]));
        vi.mocked(listChatSessions).mockResolvedValue([
            {
                id: "s1",
                userId: "user-1",
                name: "Test",
                selectedRagKeys: ["a"],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            },
        ]);
        const res = await chatbotSessionsGet();
        expect(res.status).toBe(200);
        const body = (await res.json()) as { sessions: unknown[] };
        expect(body.sessions).toHaveLength(1);
    });
});

describe("GET /api/chatbot/messages", () => {
    it("403 without chatbot_messages:read", async () => {
        goodSession();
        vi.mocked(getAuthContextForUserId).mockResolvedValue(authCtx(["chatbot_sessions:read"]));
        const res = await chatbotMessagesGet(
            new Request("http://localhost/api/chatbot/messages?sessionId=s1"),
        );
        expect(res.status).toBe(403);
    });

    it("200 when permitted and sessionId present", async () => {
        goodSession();
        vi.mocked(getAuthContextForUserId).mockResolvedValue(authCtx(["chatbot_messages:read"]));
        vi.mocked(listChatbotMessages).mockResolvedValue([
            {
                id: "m1",
                userId: "user-1",
                sessionId: "507f1f77bcf86cd799439011",
                role: "user",
                content: "hi",
                createdAt: new Date().toISOString(),
            },
        ]);
        const res = await chatbotMessagesGet(
            new Request("http://localhost/api/chatbot/messages?sessionId=507f1f77bcf86cd799439011"),
        );
        expect(res.status).toBe(200);
        const body = (await res.json()) as { messages: unknown[] };
        expect(body.messages).toHaveLength(1);
    });
});

describe("GET /api/chatbot/jobs/[eventId]", () => {
    const params = Promise.resolve({ eventId: "evt_123" });

    it("403 without chatbot_jobs:read", async () => {
        goodSession();
        vi.mocked(getAuthContextForUserId).mockResolvedValue(authCtx(["chatbot_query:create"]));
        const res = await chatbotJobGet(new Request("http://localhost"), { params });
        expect(res.status).toBe(403);
    });
});

describe("POST /api/chatbot/query", () => {
    it("403 without chatbot_query:create", async () => {
        goodSession();
        vi.mocked(getAuthContextForUserId).mockResolvedValue(
            authCtx(["chatbot_sessions:read"]),
        );
        const res = await chatbotQueryPost(
            new Request("http://localhost", {
                method: "POST",
                body: JSON.stringify({ question: "hi", sessionId: "s1" }),
                headers: { "content-type": "application/json" },
            }),
        );
        expect(res.status).toBe(403);
    });

    it("400 when question missing after auth", async () => {
        goodSession();
        vi.mocked(getAuthContextForUserId).mockResolvedValue(authCtx(["chatbot_query:create"]));
        const res = await chatbotQueryPost(
            new Request("http://localhost", {
                method: "POST",
                body: JSON.stringify({ sessionId: "s1" }),
                headers: { "content-type": "application/json" },
            }),
        );
        expect(res.status).toBe(400);
    });
});

describe("POST /api/scraper/scrape", () => {
    it("403 without scraper:create", async () => {
        goodSession();
        vi.mocked(getAuthContextForUserId).mockResolvedValue(
            authCtx(["dashboard:read", "chatbot_documents:read"]),
        );
        const res = await scraperScrapePost(
            new NextRequest("http://localhost/api/scraper/scrape", {
                method: "POST",
                body: JSON.stringify({ url: "https://example.com" }),
                headers: { "content-type": "application/json" },
            }),
        );
        expect(res.status).toBe(403);
    });
});

describe("PATCH /api/admin/users/[id]", () => {
    const userId = "507f1f77bcf86cd799439011";
    const roleId = "507f1f77bcf86cd799439012";
    const params = Promise.resolve({ id: userId });

    it("403 without users:update", async () => {
        goodSession();
        vi.mocked(getAuthContextForUserId).mockResolvedValue(authCtx(["users:read"]));
        const res = await adminUserByIdPatch(
            new Request("http://localhost", {
                method: "PATCH",
                body: JSON.stringify({ roleIds: [roleId] }),
                headers: { "content-type": "application/json" },
            }),
            { params },
        );
        expect(res.status).toBe(403);
    });

    it("400 when roleIds is not an array", async () => {
        goodSession();
        vi.mocked(getAuthContextForUserId).mockResolvedValue(authCtx(["users:update"]));
        const res = await adminUserByIdPatch(
            new Request("http://localhost", {
                method: "PATCH",
                body: JSON.stringify({ roleIds: "not-array" }),
                headers: { "content-type": "application/json" },
            }),
            { params },
        );
        expect(res.status).toBe(400);
    });

    it("200 when roles are updated", async () => {
        goodSession();
        vi.mocked(getAuthContextForUserId).mockResolvedValue(authCtx(["users:update"]));
        vi.mocked(listRoles).mockResolvedValue([
            {
                id: roleId,
                name: "Client",
                slug: "client",
                description: "",
                isSystem: true,
                enabled: true,
                permissionCodes: ["dashboard:read"],
            },
        ]);
        vi.mocked(updateUserRoleIds).mockResolvedValue({
            id: userId,
            email: "u@example.com",
            name: "U",
            passwordHash: "x",
            roleIds: [roleId],
            createdAt: new Date().toISOString(),
            emailVerified: null,
        });
        vi.mocked(getAdminUserRow).mockResolvedValue({
            id: userId,
            email: "u@example.com",
            name: "U",
            createdAt: new Date().toISOString(),
            emailVerified: true,
            roleIds: [roleId],
            roles: [
                { id: roleId, slug: "client", name: "Client", enabled: true },
            ],
        });
        const res = await adminUserByIdPatch(
            new Request("http://localhost", {
                method: "PATCH",
                body: JSON.stringify({ roleIds: [roleId] }),
                headers: { "content-type": "application/json" },
            }),
            { params },
        );
        expect(res.status).toBe(200);
        const body = (await res.json()) as { user: { roleIds: string[] } };
        expect(body.user.roleIds).toEqual([roleId]);
    });
});

describe("POST /api/chatbot/documents (finalize)", () => {
    it("403 without chatbot_documents:update", async () => {
        goodSession();
        vi.mocked(getAuthContextForUserId).mockResolvedValue(authCtx(["chatbot_documents:read"]));
        const res = await chatbotDocumentsPost(
            new Request("http://localhost", {
                method: "POST",
                body: JSON.stringify({ documentId: "507f1f77bcf86cd799439011", chunks: 1 }),
                headers: { "content-type": "application/json" },
            }),
        );
        expect(res.status).toBe(403);
    });

    it("400 when JSON body is invalid", async () => {
        goodSession();
        vi.mocked(getAuthContextForUserId).mockResolvedValue(authCtx(["chatbot_documents:update"]));
        const res = await chatbotDocumentsPost(
            new Request("http://localhost", {
                method: "POST",
                body: "not-json",
                headers: { "content-type": "application/json" },
            }),
        );
        expect(res.status).toBe(400);
    });

    it("200 when finalize succeeds", async () => {
        goodSession();
        vi.mocked(getAuthContextForUserId).mockResolvedValue(authCtx(["chatbot_documents:update"]));
        vi.mocked(finalizeChatbotDocument).mockResolvedValue({
            id: "507f1f77bcf86cd799439011",
            userId: "user-1",
            source: "a.pdf",
            ragSourceKey: "k",
            chunks: 2,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        });
        const res = await chatbotDocumentsPost(
            new Request("http://localhost", {
                method: "POST",
                body: JSON.stringify({ documentId: "507f1f77bcf86cd799439011", chunks: 2 }),
                headers: { "content-type": "application/json" },
            }),
        );
        expect(res.status).toBe(200);
        const body = (await res.json()) as { chunks: number };
        expect(body.chunks).toBe(2);
    });
});

describe("DELETE /api/chatbot/documents/[documentId]", () => {
    const params = Promise.resolve({ documentId: "507f1f77bcf86cd799439011" });

    it("403 without chatbot_documents:delete", async () => {
        goodSession();
        vi.mocked(getAuthContextForUserId).mockResolvedValue(authCtx(["chatbot_documents:read"]));
        const res = await chatbotDocumentByIdDelete(new Request("http://localhost"), { params });
        expect(res.status).toBe(403);
    });

    it("fans out vector deletions to every page when deleting a site aggregator", async () => {
        goodSession();
        vi.mocked(getAuthContextForUserId).mockResolvedValue(authCtx(["chatbot_documents:delete"]));
        vi.mocked(getChatbotDocument).mockResolvedValue({
            id: "507f1f77bcf86cd799439011",
            userId: "user-1",
            source: "example.com",
            ragSourceKey: "https://example.com",
            chunks: 9,
            kind: "site",
            pages: [
                { key: "https://example.com/a", chunks: 3 },
                { key: "https://example.com/b", chunks: 4 },
                { key: "https://example.com/c", chunks: 2 },
            ],
            createdAt: "",
            updatedAt: "",
        });
        vi.mocked(deleteChatbotDocumentById).mockResolvedValue({
            id: "507f1f77bcf86cd799439011",
            userId: "user-1",
            source: "example.com",
            ragSourceKey: "https://example.com",
            chunks: 9,
            kind: "site",
            pages: [],
            createdAt: "",
            updatedAt: "",
        });

        const deletedKeys: string[] = [];
        const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
            const full = typeof url === "string" ? url : (url as URL).toString();
            const m = full.match(/\/v1\/sources\/([^?]+)/);
            if (m) deletedKeys.push(decodeURIComponent(m[1]));
            return new Response(JSON.stringify({ ok: true }), { status: 200 });
        });

        try {
            const res = await chatbotDocumentByIdDelete(new Request("http://localhost"), { params });
            expect(res.status).toBe(200);
            const body = (await res.json()) as { ok: boolean; deletedPages: number };
            expect(body.ok).toBe(true);
            expect(body.deletedPages).toBe(3);
            expect(deletedKeys.sort()).toEqual([
                "https://example.com/a",
                "https://example.com/b",
                "https://example.com/c",
            ]);
            expect(vi.mocked(deleteChatbotDocumentById)).toHaveBeenCalledWith(
                "user-1",
                "507f1f77bcf86cd799439011",
            );
        } finally {
            fetchSpy.mockRestore();
        }
    });

    it("deletes exactly one vector source for legacy upload rows", async () => {
        goodSession();
        vi.mocked(getAuthContextForUserId).mockResolvedValue(authCtx(["chatbot_documents:delete"]));
        vi.mocked(getChatbotDocument).mockResolvedValue({
            id: "507f1f77bcf86cd799439011",
            userId: "user-1",
            source: "cv.pdf",
            ragSourceKey: "rag-abc",
            chunks: 7,
            kind: "upload",
            pages: [],
            createdAt: "",
            updatedAt: "",
        });
        vi.mocked(deleteChatbotDocumentById).mockResolvedValue({
            id: "507f1f77bcf86cd799439011",
            userId: "user-1",
            source: "cv.pdf",
            ragSourceKey: "rag-abc",
            chunks: 7,
            kind: "upload",
            pages: [],
            createdAt: "",
            updatedAt: "",
        });

        const deletedKeys: string[] = [];
        const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
            const full = typeof url === "string" ? url : (url as URL).toString();
            const m = full.match(/\/v1\/sources\/([^?]+)/);
            if (m) deletedKeys.push(decodeURIComponent(m[1]));
            return new Response(JSON.stringify({ ok: true }), { status: 200 });
        });

        try {
            const res = await chatbotDocumentByIdDelete(new Request("http://localhost"), { params });
            expect(res.status).toBe(200);
            expect(deletedKeys).toEqual(["rag-abc"]);
        } finally {
            fetchSpy.mockRestore();
        }
    });

    it("tolerates a 404 from the vector store (treats as already-gone) and still deletes the Mongo row", async () => {
        goodSession();
        vi.mocked(getAuthContextForUserId).mockResolvedValue(authCtx(["chatbot_documents:delete"]));
        vi.mocked(getChatbotDocument).mockResolvedValue({
            id: "507f1f77bcf86cd799439011",
            userId: "user-1",
            source: "example.com",
            ragSourceKey: "https://example.com",
            chunks: 2,
            kind: "site",
            pages: [
                { key: "https://example.com/a", chunks: 1 },
                { key: "https://example.com/b", chunks: 1 },
            ],
            createdAt: "",
            updatedAt: "",
        });
        vi.mocked(deleteChatbotDocumentById).mockResolvedValue({
            id: "507f1f77bcf86cd799439011",
            userId: "user-1",
            source: "example.com",
            ragSourceKey: "https://example.com",
            chunks: 2,
            kind: "site",
            pages: [],
            createdAt: "",
            updatedAt: "",
        });

        let call = 0;
        const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
            call += 1;
            if (call === 1) {
                return new Response("not found", { status: 404 });
            }
            return new Response("ok", { status: 200 });
        });

        try {
            const res = await chatbotDocumentByIdDelete(new Request("http://localhost"), { params });
            expect(res.status).toBe(200);
            expect(vi.mocked(deleteChatbotDocumentById)).toHaveBeenCalled();
        } finally {
            fetchSpy.mockRestore();
        }
    });
});

describe("POST /api/chatbot/ingest", () => {
    it("403 without chatbot_documents:create", async () => {
        goodSession();
        vi.mocked(getAuthContextForUserId).mockResolvedValue(authCtx(["chatbot_documents:read"]));
        const fd = new FormData();
        fd.append("file", new File(["x"], "x.pdf", { type: "application/pdf" }));
        const res = await chatbotIngestPost(
            new Request("http://localhost/api/chatbot/ingest", { method: "POST", body: fd }),
        );
        expect(res.status).toBe(403);
    });

    it("400 when file field is missing", async () => {
        goodSession();
        vi.mocked(getAuthContextForUserId).mockResolvedValue(authCtx(["chatbot_documents:create"]));
        const fd = new FormData();
        const res = await chatbotIngestPost(
            new Request("http://localhost/api/chatbot/ingest", { method: "POST", body: fd }),
        );
        expect(res.status).toBe(400);
    });
});

describe("GET /api/chatbot/sources", () => {
    it("403 without chatbot_sources:read", async () => {
        goodSession();
        vi.mocked(getAuthContextForUserId).mockResolvedValue(authCtx(["chatbot_documents:read"]));
        const res = await chatbotSourcesGet();
        expect(res.status).toBe(403);
    });
});

describe("DELETE /api/chatbot/sources/[sourceId]", () => {
    const params = Promise.resolve({ sourceId: "src-1" });

    it("403 without chatbot_sources:delete", async () => {
        goodSession();
        vi.mocked(getAuthContextForUserId).mockResolvedValue(authCtx(["chatbot_sources:read"]));
        const res = await chatbotSourceByIdDelete(new Request("http://localhost"), { params });
        expect(res.status).toBe(403);
    });
});

describe("POST /api/chatbot/sessions", () => {
    it("403 without chatbot_sessions:create", async () => {
        goodSession();
        vi.mocked(getAuthContextForUserId).mockResolvedValue(authCtx(["chatbot_sessions:read"]));
        const res = await chatbotSessionsPost(
            new Request("http://localhost", {
                method: "POST",
                body: JSON.stringify({ name: "S", documentIds: ["507f1f77bcf86cd799439011"] }),
                headers: { "content-type": "application/json" },
            }),
        );
        expect(res.status).toBe(403);
    });

    it("400 when documentIds is empty", async () => {
        goodSession();
        vi.mocked(getAuthContextForUserId).mockResolvedValue(authCtx(["chatbot_sessions:create"]));
        const res = await chatbotSessionsPost(
            new Request("http://localhost", {
                method: "POST",
                body: JSON.stringify({ name: "S", documentIds: [] }),
                headers: { "content-type": "application/json" },
            }),
        );
        expect(res.status).toBe(400);
    });

    it("200 when session is created", async () => {
        goodSession();
        vi.mocked(getAuthContextForUserId).mockResolvedValue(authCtx(["chatbot_sessions:create"]));
        const sid = "507f1f77bcf86cd799439099";
        vi.mocked(createChatSession).mockResolvedValue({
            id: sid,
            userId: "user-1",
            name: "S",
            selectedRagKeys: ["k1"],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        });
        vi.mocked(resolveSessionSelectedDocuments).mockResolvedValue([]);
        const res = await chatbotSessionsPost(
            new Request("http://localhost", {
                method: "POST",
                body: JSON.stringify({ name: "S", documentIds: ["507f1f77bcf86cd799439011"] }),
                headers: { "content-type": "application/json" },
            }),
        );
        expect(res.status).toBe(200);
        const body = (await res.json()) as { session: { id: string } };
        expect(body.session.id).toBe(sid);
    });

    it("429 when session creation rate limit is exceeded", async () => {
        goodSession();
        vi.mocked(getAuthContextForUserId).mockResolvedValue(authCtx(["chatbot_sessions:create"]));
        vi.mocked(requireRateLimitByUser).mockResolvedValue(
            NextResponse.json({ error: "Too many requests" }, { status: 429 }),
        );
        const res = await chatbotSessionsPost(
            new Request("http://localhost", {
                method: "POST",
                body: JSON.stringify({ name: "S", documentIds: ["507f1f77bcf86cd799439011"] }),
                headers: { "content-type": "application/json" },
            }),
        );
        expect(res.status).toBe(429);
    });
});

describe("GET /api/chatbot/sessions/[sessionId]", () => {
    const sessionId = "507f1f77bcf86cd799439099";
    const params = Promise.resolve({ sessionId });

    it("403 without chatbot_sessions:read", async () => {
        goodSession();
        vi.mocked(getAuthContextForUserId).mockResolvedValue(authCtx(["chatbot_sessions:create"]));
        const res = await chatbotSessionByIdGet(new Request("http://localhost"), { params });
        expect(res.status).toBe(403);
    });

    it("404 when session is missing", async () => {
        goodSession();
        vi.mocked(getAuthContextForUserId).mockResolvedValue(authCtx(["chatbot_sessions:read"]));
        vi.mocked(getChatSession).mockResolvedValue(null);
        const res = await chatbotSessionByIdGet(new Request("http://localhost"), { params });
        expect(res.status).toBe(404);
    });

    it("200 when session exists", async () => {
        goodSession();
        vi.mocked(getAuthContextForUserId).mockResolvedValue(authCtx(["chatbot_sessions:read"]));
        vi.mocked(getChatSession).mockResolvedValue({
            id: sessionId,
            userId: "user-1",
            name: "S",
            selectedRagKeys: ["k1"],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        });
        vi.mocked(resolveSessionSelectedDocuments).mockResolvedValue([]);
        const res = await chatbotSessionByIdGet(new Request("http://localhost"), { params });
        expect(res.status).toBe(200);
        const body = (await res.json()) as { session: { id: string } };
        expect(body.session.id).toBe(sessionId);
    });
});

describe("PATCH /api/chatbot/sessions/[sessionId]", () => {
    const sessionId = "507f1f77bcf86cd799439099";
    const params = Promise.resolve({ sessionId });

    it("403 without chatbot_sessions:update", async () => {
        goodSession();
        vi.mocked(getAuthContextForUserId).mockResolvedValue(authCtx(["chatbot_sessions:read"]));
        const res = await chatbotSessionByIdPatch(
            new Request("http://localhost", {
                method: "PATCH",
                body: JSON.stringify({ name: "N" }),
                headers: { "content-type": "application/json" },
            }),
            { params },
        );
        expect(res.status).toBe(403);
    });

    it("400 when no updates provided", async () => {
        goodSession();
        vi.mocked(getAuthContextForUserId).mockResolvedValue(authCtx(["chatbot_sessions:update"]));
        const res = await chatbotSessionByIdPatch(
            new Request("http://localhost", {
                method: "PATCH",
                body: JSON.stringify({}),
                headers: { "content-type": "application/json" },
            }),
            { params },
        );
        expect(res.status).toBe(400);
    });

    it("200 when update succeeds", async () => {
        goodSession();
        vi.mocked(getAuthContextForUserId).mockResolvedValue(authCtx(["chatbot_sessions:update"]));
        vi.mocked(updateChatSession).mockResolvedValue({
            id: sessionId,
            userId: "user-1",
            name: "Renamed",
            selectedRagKeys: ["k1"],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        });
        vi.mocked(resolveSessionSelectedDocuments).mockResolvedValue([]);
        const res = await chatbotSessionByIdPatch(
            new Request("http://localhost", {
                method: "PATCH",
                body: JSON.stringify({ name: "Renamed" }),
                headers: { "content-type": "application/json" },
            }),
            { params },
        );
        expect(res.status).toBe(200);
        const body = (await res.json()) as { session: { name: string } };
        expect(body.session.name).toBe("Renamed");
    });
});

describe("DELETE /api/chatbot/sessions/[sessionId]", () => {
    const sessionId = "507f1f77bcf86cd799439099";
    const params = Promise.resolve({ sessionId });

    it("403 without chatbot_sessions:delete", async () => {
        goodSession();
        vi.mocked(getAuthContextForUserId).mockResolvedValue(authCtx(["chatbot_sessions:update"]));
        const res = await chatbotSessionByIdDelete(new Request("http://localhost"), { params });
        expect(res.status).toBe(403);
    });

    it("200 when delete succeeds", async () => {
        goodSession();
        vi.mocked(getAuthContextForUserId).mockResolvedValue(authCtx(["chatbot_sessions:delete"]));
        vi.mocked(deleteChatSession).mockResolvedValue(true);
        const res = await chatbotSessionByIdDelete(new Request("http://localhost"), { params });
        expect(res.status).toBe(200);
        const body = (await res.json()) as { ok: boolean };
        expect(body.ok).toBe(true);
    });
});

describe("POST /api/chatbot/messages", () => {
    it("403 without chatbot_messages:create", async () => {
        goodSession();
        vi.mocked(getAuthContextForUserId).mockResolvedValue(authCtx(["chatbot_messages:read"]));
        const res = await chatbotMessagesPost(
            new Request("http://localhost", {
                method: "POST",
                body: JSON.stringify({
                    question: "q",
                    answer: "a",
                    sessionId: "507f1f77bcf86cd799439099",
                }),
                headers: { "content-type": "application/json" },
            }),
        );
        expect(res.status).toBe(403);
    });

    it("400 when question/answer shape is wrong", async () => {
        goodSession();
        vi.mocked(getAuthContextForUserId).mockResolvedValue(authCtx(["chatbot_messages:create"]));
        const res = await chatbotMessagesPost(
            new Request("http://localhost", {
                method: "POST",
                body: JSON.stringify({ question: 1, answer: "a", sessionId: "507f1f77bcf86cd799439099" }),
                headers: { "content-type": "application/json" },
            }),
        );
        expect(res.status).toBe(400);
    });

    it("200 when exchange is saved", async () => {
        goodSession();
        vi.mocked(getAuthContextForUserId).mockResolvedValue(authCtx(["chatbot_messages:create"]));
        vi.mocked(appendChatbotExchange).mockResolvedValue(undefined);
        const res = await chatbotMessagesPost(
            new Request("http://localhost", {
                method: "POST",
                body: JSON.stringify({
                    question: "q",
                    answer: "a",
                    sessionId: "507f1f77bcf86cd799439099",
                }),
                headers: { "content-type": "application/json" },
            }),
        );
        expect(res.status).toBe(200);
        const body = (await res.json()) as { ok: boolean };
        expect(body.ok).toBe(true);
    });

    it("429 when message creation rate limit is exceeded", async () => {
        goodSession();
        vi.mocked(getAuthContextForUserId).mockResolvedValue(authCtx(["chatbot_messages:create"]));
        vi.mocked(requireRateLimitByUser).mockResolvedValue(
            NextResponse.json({ error: "Too many requests" }, { status: 429 }),
        );
        const res = await chatbotMessagesPost(
            new Request("http://localhost", {
                method: "POST",
                body: JSON.stringify({
                    question: "q",
                    answer: "a",
                    sessionId: "507f1f77bcf86cd799439099",
                }),
                headers: { "content-type": "application/json" },
            }),
        );
        expect(res.status).toBe(429);
    });
});

describe("DELETE /api/chatbot/messages", () => {
    it("403 without chatbot_messages:delete", async () => {
        goodSession();
        vi.mocked(getAuthContextForUserId).mockResolvedValue(authCtx(["chatbot_messages:create"]));
        const res = await chatbotMessagesDelete(
            new Request("http://localhost/api/chatbot/messages?sessionId=507f1f77bcf86cd799439099"),
        );
        expect(res.status).toBe(403);
    });

    it("400 when sessionId query is missing", async () => {
        goodSession();
        vi.mocked(getAuthContextForUserId).mockResolvedValue(authCtx(["chatbot_messages:delete"]));
        const res = await chatbotMessagesDelete(new Request("http://localhost/api/chatbot/messages"));
        expect(res.status).toBe(400);
    });

    it("200 when clear succeeds", async () => {
        goodSession();
        vi.mocked(getAuthContextForUserId).mockResolvedValue(authCtx(["chatbot_messages:delete"]));
        vi.mocked(clearChatbotMessages).mockResolvedValue(3);
        const res = await chatbotMessagesDelete(
            new Request("http://localhost/api/chatbot/messages?sessionId=507f1f77bcf86cd799439099"),
        );
        expect(res.status).toBe(200);
        const body = (await res.json()) as { deleted: number };
        expect(body.deleted).toBe(3);
    });
});

function fakeCrawlJob(overrides: Partial<Record<string, unknown>> = {}) {
    return {
        id: "507f1f77bcf86cd799439011",
        userId: "user-1",
        startUrl: "https://example.com",
        mode: "auto",
        maxPages: 10,
        maxDepth: 2,
        state: "queued" as const,
        doneCount: 0,
        failedCount: 0,
        urls: [],
        ingestedPages: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...overrides,
    };
}

describe("GET /api/scraper/crawl/jobs", () => {
    it("401 without session", async () => {
        noSession();
        const res = await scraperCrawlJobsGet();
        expect(res.status).toBe(401);
    });

    it("403 without scraper:create", async () => {
        goodSession();
        vi.mocked(getAuthContextForUserId).mockResolvedValue(authCtx(["dashboard:read"]));
        const res = await scraperCrawlJobsGet();
        expect(res.status).toBe(403);
    });

    it("200 returns jobs list", async () => {
        goodSession();
        vi.mocked(getAuthContextForUserId).mockResolvedValue(authCtx(["scraper:create"]));
        vi.mocked(listCrawlJobsForUser).mockResolvedValue([fakeCrawlJob()] as never);
        const res = await scraperCrawlJobsGet();
        expect(res.status).toBe(200);
        const body = (await res.json()) as { jobs: unknown[] };
        expect(body.jobs).toHaveLength(1);
    });
});

describe("POST /api/scraper/crawl/jobs", () => {
    const makeReq = (body: unknown) =>
        new NextRequest("http://localhost/api/scraper/crawl/jobs", {
            method: "POST",
            body: typeof body === "string" ? body : JSON.stringify(body),
            headers: { "content-type": "application/json" },
        });

    it("401 without session", async () => {
        noSession();
        const res = await scraperCrawlJobsPost(makeReq({ url: "https://example.com" }));
        expect(res.status).toBe(401);
    });

    it("403 without scraper:create", async () => {
        goodSession();
        vi.mocked(getAuthContextForUserId).mockResolvedValue(authCtx(["dashboard:read"]));
        const res = await scraperCrawlJobsPost(makeReq({ url: "https://example.com" }));
        expect(res.status).toBe(403);
    });

    it("400 when body is invalid JSON", async () => {
        goodSession();
        vi.mocked(getAuthContextForUserId).mockResolvedValue(authCtx(["scraper:create"]));
        const res = await scraperCrawlJobsPost(makeReq("not json"));
        expect(res.status).toBe(400);
    });

    it("400 when url is missing", async () => {
        goodSession();
        vi.mocked(getAuthContextForUserId).mockResolvedValue(authCtx(["scraper:create"]));
        const res = await scraperCrawlJobsPost(makeReq({}));
        expect(res.status).toBe(400);
    });

    it("400 when url is not a valid http(s) URL", async () => {
        goodSession();
        vi.mocked(getAuthContextForUserId).mockResolvedValue(authCtx(["scraper:create"]));
        const res = await scraperCrawlJobsPost(makeReq({ url: "ftp://bad" }));
        expect(res.status).toBe(400);
    });

    it("202 returns job and kicks off worker", async () => {
        goodSession();
        vi.mocked(getAuthContextForUserId).mockResolvedValue(authCtx(["scraper:create"]));
        vi.mocked(createCrawlJob).mockResolvedValue(fakeCrawlJob() as never);
        const res = await scraperCrawlJobsPost(
            makeReq({ url: "https://example.com", mode: "static", max_pages: 5, max_depth: 1 }),
        );
        expect(res.status).toBe(202);
        expect(createCrawlJob).toHaveBeenCalledWith(
            "user-1",
            expect.objectContaining({
                startUrl: "https://example.com",
                mode: "static",
                maxPages: 5,
                maxDepth: 1,
            }),
        );
        expect(runCrawlJob).toHaveBeenCalledWith(
            expect.objectContaining({
                jobId: "507f1f77bcf86cd799439011",
                userId: "user-1",
                startUrl: "https://example.com",
            }),
        );
    });

    it("clamps out-of-range max_pages and max_depth and falls back to 'auto' mode", async () => {
        goodSession();
        vi.mocked(getAuthContextForUserId).mockResolvedValue(authCtx(["scraper:create"]));
        vi.mocked(createCrawlJob).mockResolvedValue(fakeCrawlJob() as never);
        await scraperCrawlJobsPost(
            makeReq({ url: "https://example.com", mode: "bogus", max_pages: 9999, max_depth: -4 }),
        );
        expect(createCrawlJob).toHaveBeenCalledWith(
            "user-1",
            expect.objectContaining({ mode: "auto", maxPages: 200, maxDepth: 1 }),
        );
    });
});

describe("GET /api/scraper/crawl/jobs/[jobId]", () => {
    const params = (jobId: string) => Promise.resolve({ jobId });

    it("401 without session", async () => {
        noSession();
        const res = await scraperCrawlJobByIdGet(new Request("http://localhost"), {
            params: params("x"),
        });
        expect(res.status).toBe(401);
    });

    it("403 without scraper:create", async () => {
        goodSession();
        vi.mocked(getAuthContextForUserId).mockResolvedValue(authCtx(["dashboard:read"]));
        const res = await scraperCrawlJobByIdGet(new Request("http://localhost"), {
            params: params("507f1f77bcf86cd799439011"),
        });
        expect(res.status).toBe(403);
    });

    it("404 when job is missing", async () => {
        goodSession();
        vi.mocked(getAuthContextForUserId).mockResolvedValue(authCtx(["scraper:create"]));
        vi.mocked(getCrawlJob).mockResolvedValue(null);
        const res = await scraperCrawlJobByIdGet(new Request("http://localhost"), {
            params: params("507f1f77bcf86cd799439011"),
        });
        expect(res.status).toBe(404);
    });

    it("200 returns the job when owned by the caller", async () => {
        goodSession();
        vi.mocked(getAuthContextForUserId).mockResolvedValue(authCtx(["scraper:create"]));
        vi.mocked(getCrawlJob).mockResolvedValue(
            fakeCrawlJob({ state: "running", doneCount: 3 }) as never,
        );
        const res = await scraperCrawlJobByIdGet(new Request("http://localhost"), {
            params: params("507f1f77bcf86cd799439011"),
        });
        expect(res.status).toBe(200);
        const body = (await res.json()) as { job: { state: string; doneCount: number } };
        expect(body.job.state).toBe("running");
        expect(body.job.doneCount).toBe(3);
    });
});
