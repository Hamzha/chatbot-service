import { describe, expect, it, vi, beforeEach } from "vitest";
import type { UserRecord } from "@repo/auth/types";
import type { RoleRecord } from "@/lib/db/roleRepo";

vi.mock("@/lib/db/userRepo", () => ({
    findUserById: vi.fn(),
}));

vi.mock("@/lib/db/roleRepo", () => ({
    findRolesByIds: vi.fn(),
}));

import { findUserById } from "@/lib/db/userRepo";
import { findRolesByIds } from "@/lib/db/roleRepo";
import { getAuthContextForUserId, hasPermission } from "@/lib/auth/authorization";

function mockUser(partial: Partial<UserRecord> & Pick<UserRecord, "id">): UserRecord {
    return {
        id: partial.id,
        email: partial.email ?? "a@b.c",
        name: partial.name ?? "User",
        passwordHash: partial.passwordHash ?? "x",
        emailVerified: partial.emailVerified ?? "2020-01-01T00:00:00.000Z",
        createdAt: partial.createdAt ?? "2020-01-01T00:00:00.000Z",
        roleIds: partial.roleIds,
    };
}

function mockRole(partial: Partial<RoleRecord> & Pick<RoleRecord, "id" | "slug" | "name">): RoleRecord {
    return {
        id: partial.id,
        slug: partial.slug,
        name: partial.name,
        description: partial.description ?? "",
        isSystem: partial.isSystem ?? false,
        enabled: partial.enabled ?? true,
        permissionCodes: partial.permissionCodes ?? [],
    };
}

describe("getAuthContextForUserId", () => {
    beforeEach(() => {
        vi.mocked(findUserById).mockReset();
        vi.mocked(findRolesByIds).mockReset();
    });

    it("returns null when user is missing", async () => {
        vi.mocked(findUserById).mockResolvedValue(null);
        await expect(getAuthContextForUserId("507f1f77bcf86cd799439011")).resolves.toBeNull();
        expect(findRolesByIds).not.toHaveBeenCalled();
    });

    it("returns empty permissions when user has no roleIds", async () => {
        vi.mocked(findUserById).mockResolvedValue(mockUser({ id: "u1", roleIds: [] }));
        vi.mocked(findRolesByIds).mockResolvedValue([]);
        const ctx = await getAuthContextForUserId("u1");
        expect(ctx?.permissions.size).toBe(0);
        expect(ctx?.roles).toEqual([]);
    });

    it("ignores disabled roles for permissions but lists them on the context", async () => {
        vi.mocked(findUserById).mockResolvedValue(mockUser({ id: "u1", roleIds: ["r1", "r2"] }));
        vi.mocked(findRolesByIds).mockResolvedValue([
            mockRole({
                id: "r1",
                slug: "on",
                name: "On",
                enabled: true,
                permissionCodes: ["dashboard:read", "roles:read"],
            }),
            mockRole({
                id: "r2",
                slug: "off",
                name: "Off",
                enabled: false,
                permissionCodes: ["roles:delete"],
            }),
        ]);
        const ctx = await getAuthContextForUserId("u1");
        expect(ctx?.permissions.has("dashboard:read")).toBe(true);
        expect(ctx?.permissions.has("roles:read")).toBe(true);
        expect(ctx?.permissions.has("roles:delete")).toBe(false);
        expect(ctx?.roles).toHaveLength(2);
        expect(ctx?.roles.find((r) => r.slug === "off")?.enabled).toBe(false);
    });

    it("dedupes overlapping permission codes from multiple enabled roles", async () => {
        vi.mocked(findUserById).mockResolvedValue(mockUser({ id: "u1", roleIds: ["r1", "r2"] }));
        vi.mocked(findRolesByIds).mockResolvedValue([
            mockRole({ id: "r1", slug: "a", name: "A", permissionCodes: ["dashboard:read", "roles:read"] }),
            mockRole({ id: "r2", slug: "b", name: "B", permissionCodes: ["dashboard:read", "users:read"] }),
        ]);
        const ctx = await getAuthContextForUserId("u1");
        expect(ctx?.permissions.size).toBe(3);
        expect(ctx?.permissions.has("dashboard:read")).toBe(true);
    });

    it("loads roles when roleIds undefined on user (treated as empty)", async () => {
        vi.mocked(findUserById).mockResolvedValue(mockUser({ id: "u1", roleIds: undefined }));
        vi.mocked(findRolesByIds).mockResolvedValue([]);
        const ctx = await getAuthContextForUserId("u1");
        expect(findRolesByIds).toHaveBeenCalledWith([]);
        expect(ctx?.permissions.size).toBe(0);
    });
});

describe("hasPermission", () => {
    it("returns false for null context", () => {
        expect(hasPermission(null, "dashboard:read")).toBe(false);
    });

    it("returns true when code exists on context", () => {
        const ctx = {
            userId: "u1",
            permissions: new Set(["dashboard:read"]),
            roles: [],
        };
        expect(hasPermission(ctx, "dashboard:read")).toBe(true);
        expect(hasPermission(ctx, "roles:read")).toBe(false);
    });
});
