import { describe, expect, it } from "vitest";
import { allCatalogCodes, isValidPermissionCode } from "@/lib/auth/permissionCatalog";
import { RBAC_ENFORCEMENT_POINTS } from "@/lib/auth/rbacEnforcementCatalog";
import { DASHBOARD_SIDEBAR_NAV } from "@/lib/dashboard/dashboardSidebarNav";
import {
    defaultAdminCodes,
    defaultClientCodes,
    defaultMediatorCodes,
} from "@/lib/db/roleRepo";

/**
 * Frozen product spec for the **client** system role.
 * Must stay in lockstep with `defaultClientCodes()` in `lib/db/roleRepo.ts`.
 * When defaults change intentionally, update both places.
 */
const CLIENT_ROLE_PERMISSION_SPEC = [
    "dashboard:read",
    "chatbot_documents:create",
    "chatbot_documents:read",
    "chatbot_documents:update",
    "chatbot_documents:delete",
    "chatbot_sessions:create",
    "chatbot_sessions:read",
    "chatbot_sessions:update",
    "chatbot_sessions:delete",
    "chatbot_messages:create",
    "chatbot_messages:read",
    "chatbot_messages:update",
    "chatbot_messages:delete",
    "chatbot_query:create",
    "chatbot_jobs:read",
    "chatbot_sources:read",
    "chatbot_sources:delete",
    "scraper:create",
    "scraper:read",
    "scraper:update",
    "scraper:delete",
] as const;

/**
 * Frozen product spec for the **mediator** system role.
 * Must stay in lockstep with `defaultMediatorCodes()` in `lib/db/roleRepo.ts`.
 */
const MEDIATOR_ROLE_PERMISSION_SPEC = [
    "dashboard:read",
    "chatbot_documents:read",
    "chatbot_documents:update",
    "chatbot_sessions:create",
    "chatbot_sessions:read",
    "chatbot_sessions:update",
    "chatbot_messages:read",
    "chatbot_messages:create",
    "chatbot_query:create",
    "chatbot_jobs:read",
    "chatbot_sources:read",
] as const;

function sortedCopy(codes: readonly string[]): string[] {
    return [...codes].sort((a, b) => a.localeCompare(b));
}

describe("RBAC enforcement catalog", () => {
    it("has unique ids", () => {
        const ids = RBAC_ENFORCEMENT_POINTS.map((p) => p.id);
        expect(new Set(ids).size).toBe(ids.length);
    });

    it("every point uses a valid catalog permission", () => {
        for (const p of RBAC_ENFORCEMENT_POINTS) {
            expect(isValidPermissionCode(p.permission), p.id).toBe(true);
        }
    });

    it("nav enforcement points stay aligned with dashboard sidebar config", () => {
        const navPoints = RBAC_ENFORCEMENT_POINTS.filter((p) => p.surfaces.includes("nav"));
        expect(navPoints.map((p) => p.id).sort()).toEqual(DASHBOARD_SIDEBAR_NAV.map((r) => r.id).sort());
        for (const row of DASHBOARD_SIDEBAR_NAV) {
            const ep = navPoints.find((p) => p.id === row.id);
            expect(ep?.permission, row.id).toBe(row.permission);
        }
    });
});

describe("Frozen default roles vs roleRepo", () => {
    it("defaultClientCodes matches CLIENT_ROLE_PERMISSION_SPEC", () => {
        expect(sortedCopy(defaultClientCodes())).toEqual(sortedCopy(CLIENT_ROLE_PERMISSION_SPEC));
    });

    it("defaultMediatorCodes matches MEDIATOR_ROLE_PERMISSION_SPEC", () => {
        expect(sortedCopy(defaultMediatorCodes())).toEqual(sortedCopy(MEDIATOR_ROLE_PERMISSION_SPEC));
    });
});

describe("Role × full permission catalog", () => {
    const catalog = allCatalogCodes();
    const admin = new Set(defaultAdminCodes());
    const client = new Set(CLIENT_ROLE_PERMISSION_SPEC);
    const mediator = new Set(MEDIATOR_ROLE_PERMISSION_SPEC);

    it("admin has every catalog permission", () => {
        expect(admin.size).toBe(catalog.length);
        for (const code of catalog) {
            expect(admin.has(code), code).toBe(true);
        }
    });

    it("client and mediator only grant catalog permissions", () => {
        for (const code of client) {
            expect(isValidPermissionCode(code), code).toBe(true);
        }
        for (const code of mediator) {
            expect(isValidPermissionCode(code), code).toBe(true);
        }
    });

    it("mediator ⊆ client (strict)", () => {
        for (const code of mediator) {
            expect(client.has(code), `mediator has ${code} but client does not`).toBe(true);
        }
        expect(client.size).toBeGreaterThan(mediator.size);
    });

    it("client never grants users:* or roles:*", () => {
        for (const code of client) {
            expect(code.startsWith("users:"), code).toBe(false);
            expect(code.startsWith("roles:"), code).toBe(false);
        }
    });

    it.each(catalog)("catalog %s — role matrix", (code) => {
        expect(admin.has(code)).toBe(true);
        expect(client.has(code)).toBe(CLIENT_ROLE_PERMISSION_SPEC.includes(code as never));
        expect(mediator.has(code)).toBe(MEDIATOR_ROLE_PERMISSION_SPEC.includes(code as never));
    });
});

describe("Feature-by-feature: enforcement × role", () => {
    const admin = new Set(defaultAdminCodes());
    const client = new Set(CLIENT_ROLE_PERMISSION_SPEC);
    const mediator = new Set(MEDIATOR_ROLE_PERMISSION_SPEC);

    const byFeature = new Map<string, typeof RBAC_ENFORCEMENT_POINTS>();
    for (const p of RBAC_ENFORCEMENT_POINTS) {
        const list = byFeature.get(p.feature) ?? [];
        list.push(p);
        byFeature.set(p.feature, list);
    }

    for (const [feature, points] of byFeature) {
        describe(feature, () => {
            for (const p of points) {
                it(`${p.id}: admin allowed`, () => {
                    expect(admin.has(p.permission), p.permission).toBe(true);
                });
                it(`${p.id}: client ${client.has(p.permission) ? "allowed" : "denied"}`, () => {
                    expect(client.has(p.permission)).toBe(
                        CLIENT_ROLE_PERMISSION_SPEC.includes(p.permission as never),
                    );
                });
                it(`${p.id}: mediator ${mediator.has(p.permission) ? "allowed" : "denied"}`, () => {
                    expect(mediator.has(p.permission)).toBe(
                        MEDIATOR_ROLE_PERMISSION_SPEC.includes(p.permission as never),
                    );
                });
            }
        });
    }
});

describe("Expected capability summary (documentation via assertions)", () => {
    const client = new Set(CLIENT_ROLE_PERMISSION_SPEC);
    const mediator = new Set(MEDIATOR_ROLE_PERMISSION_SPEC);

    it("client can use full chatbot + scraper APIs but not admin APIs", () => {
        expect(client.has("chatbot_query:create")).toBe(true);
        expect(client.has("chatbot_documents:delete")).toBe(true);
        expect(client.has("scraper:create")).toBe(true);
        expect(client.has("users:read")).toBe(false);
        expect(client.has("roles:read")).toBe(false);
    });

    it("mediator can operate sessions/messages/query but not upload, delete docs, delete sessions/messages, sources delete, or scraper", () => {
        expect(mediator.has("chatbot_sessions:read")).toBe(true);
        expect(mediator.has("chatbot_messages:create")).toBe(true);
        expect(mediator.has("chatbot_query:create")).toBe(true);
        expect(mediator.has("chatbot_documents:create")).toBe(false);
        expect(mediator.has("chatbot_documents:delete")).toBe(false);
        expect(mediator.has("chatbot_sessions:delete")).toBe(false);
        expect(mediator.has("chatbot_messages:delete")).toBe(false);
        expect(mediator.has("chatbot_sources:delete")).toBe(false);
        expect(mediator.has("scraper:read")).toBe(false);
    });
});
