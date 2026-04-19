import { describe, expect, it } from "vitest";
import { allCatalogCodes, isValidPermissionCode } from "@/lib/auth/permissionCatalog";
import {
    defaultAdminCodes,
    defaultClientCodes,
    defaultMediatorCodes,
    defaultUserCodes,
} from "@/lib/db/roleRepo";

describe("roleRepo default permission sets", () => {
    const catalog = new Set(allCatalogCodes());

    it("defaultAdminCodes includes every catalog code", () => {
        const admin = defaultAdminCodes();
        expect(admin.length).toBe(catalog.size);
        for (const code of admin) {
            expect(catalog.has(code)).toBe(true);
            expect(isValidPermissionCode(code)).toBe(true);
        }
    });

    it("defaultClientCodes is a non-empty subset of the catalog (app features, not role admin)", () => {
        const client = defaultClientCodes();
        expect(client.length).toBeGreaterThan(0);
        for (const code of client) {
            expect(catalog.has(code)).toBe(true);
        }
        expect(client).toContain("dashboard:read");
        expect(client).toContain("chatbot_documents:read");
        expect(client).not.toContain("roles:read");
        expect(client).not.toContain("users:read");
    });

    it("defaultUserCodes matches defaultClientCodes (signup default `user` role)", () => {
        expect(defaultUserCodes()).toEqual(defaultClientCodes());
    });

    it("defaultMediatorCodes is a subset of the catalog and narrower than client", () => {
        const med = defaultMediatorCodes();
        const client = new Set(defaultClientCodes());
        expect(med.length).toBeGreaterThan(0);
        for (const code of med) {
            expect(catalog.has(code)).toBe(true);
        }
        expect(med.some((c) => !client.has(c))).toBe(false);
        expect(client.size).toBeGreaterThan(med.length);
    });
});
