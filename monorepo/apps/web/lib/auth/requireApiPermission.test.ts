import { describe, expect, it, vi, beforeEach } from "vitest";
import {
    requireApiPermission,
    requireUserIdWithPermission,
} from "./requireApiPermission";

vi.mock("@repo/auth/lib/cookies", () => ({
    getSessionCookie: vi.fn(),
}));

vi.mock("@repo/auth/lib/jwt", () => ({
    verifySessionToken: vi.fn(),
}));

vi.mock("@/lib/auth/authorization", () => ({
    getAuthContextForUserId: vi.fn(),
}));

import { getSessionCookie } from "@repo/auth/lib/cookies";
import { verifySessionToken } from "@repo/auth/lib/jwt";
import { getAuthContextForUserId } from "@/lib/auth/authorization";

function mockCtx(permissions: string[]) {
    return {
        userId: "u1",
        permissions: new Set(permissions),
        roles: [],
    };
}

beforeEach(() => {
    vi.clearAllMocks();
});

describe("requireApiPermission", () => {
    it("returns 401 when there is no session cookie", async () => {
        vi.mocked(getSessionCookie).mockResolvedValue(null);
        const res = await requireApiPermission("roles:read");
        expect(res).toBeInstanceOf(Response);
        expect((res as Response).status).toBe(401);
    });

    it("returns 401 when token verification fails", async () => {
        vi.mocked(getSessionCookie).mockResolvedValue("bad");
        vi.mocked(verifySessionToken).mockRejectedValue(new Error("invalid"));
        const res = await requireApiPermission("roles:read");
        expect((res as Response).status).toBe(401);
    });

    it("returns 401 when auth context is missing", async () => {
        vi.mocked(getSessionCookie).mockResolvedValue("tok");
        vi.mocked(verifySessionToken).mockResolvedValue({ sub: "u1" } as never);
        vi.mocked(getAuthContextForUserId).mockResolvedValue(null);
        const res = await requireApiPermission("roles:read");
        expect((res as Response).status).toBe(401);
    });

    it("returns 403 when permission is not granted", async () => {
        vi.mocked(getSessionCookie).mockResolvedValue("tok");
        vi.mocked(verifySessionToken).mockResolvedValue({ sub: "u1" } as never);
        vi.mocked(getAuthContextForUserId).mockResolvedValue(
            mockCtx(["dashboard:read"]),
        );
        const res = await requireApiPermission("roles:read");
        expect((res as Response).status).toBe(403);
    });

    it("returns ctx when permission is granted", async () => {
        vi.mocked(getSessionCookie).mockResolvedValue("tok");
        vi.mocked(verifySessionToken).mockResolvedValue({ sub: "u1" } as never);
        const ctx = mockCtx(["roles:read", "users:read"]);
        vi.mocked(getAuthContextForUserId).mockResolvedValue(ctx);
        const ok = await requireApiPermission("roles:read");
        expect(ok).toEqual({ ctx });
    });
});

describe("requireUserIdWithPermission", () => {
    it("returns userId on success", async () => {
        vi.mocked(getSessionCookie).mockResolvedValue("tok");
        vi.mocked(verifySessionToken).mockResolvedValue({ sub: "u1" } as never);
        vi.mocked(getAuthContextForUserId).mockResolvedValue(
            mockCtx(["roles:read"]),
        );
        const r = await requireUserIdWithPermission("roles:read");
        expect(r).toEqual({ userId: "u1" });
    });

    it("forwards error response when requireApiPermission fails", async () => {
        vi.mocked(getSessionCookie).mockResolvedValue(null);
        const r = await requireUserIdWithPermission("roles:read");
        expect((r as Response).status).toBe(401);
    });
});
