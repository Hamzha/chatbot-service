import { describe, expect, it } from "vitest";
import {
    PERMISSION_CATALOG,
    allCatalogCodes,
    isValidPermissionCode,
    permissionCode,
} from "@/lib/auth/permissionCatalog";

describe("permissionCatalog", () => {
    it("builds stable codes as module:action", () => {
        expect(permissionCode("roles", "read")).toBe("roles:read");
    });

    it("has no duplicate permission codes", () => {
        const codes = allCatalogCodes();
        const unique = new Set(codes);
        expect(unique.size).toBe(codes.length);
    });

    it("marks every catalog entry as a valid code", () => {
        for (const def of PERMISSION_CATALOG) {
            const code = permissionCode(def.module, def.action);
            expect(isValidPermissionCode(code)).toBe(true);
        }
    });

    it("rejects unknown codes", () => {
        expect(isValidPermissionCode("fake:module")).toBe(false);
        expect(isValidPermissionCode("")).toBe(false);
    });

    it("includes required modules for dashboard, users, roles, chatbot, scraper", () => {
        const codes = new Set(allCatalogCodes());
        expect(codes.has("dashboard:read")).toBe(true);
        expect(codes.has("users:read")).toBe(true);
        expect(codes.has("roles:update")).toBe(true);
        expect(codes.has("chatbot_documents:create")).toBe(true);
        expect(codes.has("chatbot_query:create")).toBe(true);
        expect(codes.has("scraper:read")).toBe(true);
    });

    it("has exactly one dashboard permission (read)", () => {
        const dash = PERMISSION_CATALOG.filter((p) => p.module === "dashboard");
        expect(dash).toHaveLength(1);
        expect(dash[0].action).toBe("read");
    });
});
