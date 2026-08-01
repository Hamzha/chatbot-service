import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@repo/auth/lib/jwt", () => ({
    verifySessionToken: vi.fn(),
}));

vi.mock("@/lib/db/userRepo", () => ({
    findUserById: vi.fn(),
}));

vi.mock("@/lib/db/apiRequestLogRepo", () => ({
    createApiRequestLog: vi.fn(),
}));

import { verifySessionToken } from "@repo/auth/lib/jwt";
import { findUserById } from "@/lib/db/userRepo";
import { createApiRequestLog } from "@/lib/db/apiRequestLogRepo";
import { withApiLogging } from "@/lib/api/withApiLogging";

describe("withApiLogging", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("passes through non-request invocations", async () => {
        const h = vi.fn(async () => new Response(null, { status: 204 }));
        const wrapped = withApiLogging(h);
        const res = await wrapped();
        expect(res.status).toBe(204);
        expect(createApiRequestLog).not.toHaveBeenCalled();
    });

    it("logs successful request metadata", async () => {
        vi.mocked(verifySessionToken).mockResolvedValue({ sub: "u1" } as never);
        vi.mocked(findUserById).mockResolvedValue({
            id: "u1",
            email: "u1@example.com",
        } as never);

        const wrapped = withApiLogging(async (_req: Request) => new Response("ok", { status: 201 }));
        const res = await wrapped(
            new Request("http://localhost/api/test", {
                headers: {
                    cookie: "auth_token=token-1",
                    "x-request-id": "req-1",
                    "x-forwarded-for": "10.0.0.2, 10.0.0.3",
                    "user-agent": "vitest-agent",
                },
            }),
        );

        expect(res.status).toBe(201);
        expect(createApiRequestLog).toHaveBeenCalledWith(
            expect.objectContaining({
                requestId: "req-1",
                method: "GET",
                route: "/api/test",
                status: 201,
                userId: "u1",
                userEmail: "u1@example.com",
                ip: "10.0.0.2",
                userAgent: "vitest-agent",
            }),
        );
    });

    it("logs 500 and rethrows on handler error", async () => {
        vi.mocked(createApiRequestLog).mockResolvedValue(undefined);
        const wrapped = withApiLogging(async () => {
            throw new Error("boom");
        });

        await expect(wrapped(new Request("http://localhost/api/fail"))).rejects.toThrow("boom");
        expect(createApiRequestLog).toHaveBeenCalledWith(
            expect.objectContaining({
                route: "/api/fail",
                status: 500,
                errorMessage: "boom",
            }),
        );
    });

    it("does not fail when log write fails", async () => {
        vi.mocked(createApiRequestLog).mockRejectedValue(new Error("db down"));
        const wrapped = withApiLogging(async () => new Response("ok", { status: 200 }));
        const res = await wrapped(new Request("http://localhost/api/ok"));
        expect(res.status).toBe(200);
    });
});
