/**
 * Every permission checked by API routes or server pages for RBAC.
 * Sidebar nav gates are derived from `DASHBOARD_SIDEBAR_NAV` so UI and tests stay aligned.
 * When you add a new gated API route or page, add a row to `RBAC_CORE_ENFORCEMENT_POINTS`.
 * Representative handler tests: `app/api/rbacRouteHandlers.http.test.ts`.
 */
import { DASHBOARD_SIDEBAR_NAV } from "@/lib/dashboard/dashboardSidebarNav";

export type RbacEnforcementSurface = "api" | "page" | "nav";

export type RbacEnforcementPoint = {
    /** Stable id for tests and failure messages */
    id: string;
    /** Permission code (must exist in permission catalog) */
    permission: string;
    surfaces: readonly RbacEnforcementSurface[];
    /** Human-readable scope */
    feature: string;
};

export const RBAC_CORE_ENFORCEMENT_POINTS = [
    {
        id: "api.admin.users.collection.GET",
        permission: "users:read",
        surfaces: ["api"],
        feature: "Admin — list users",
    },
    {
        id: "api.admin.users.item.GET",
        permission: "users:read",
        surfaces: ["api"],
        feature: "Admin — get user",
    },
    {
        id: "api.admin.users.item.PATCH",
        permission: "users:update",
        surfaces: ["api"],
        feature: "Admin — update user",
    },
    {
        id: "api.admin.roles.collection.GET",
        permission: "roles:read",
        surfaces: ["api"],
        feature: "Admin — list roles",
    },
    {
        id: "api.admin.roles.collection.POST",
        permission: "roles:create",
        surfaces: ["api"],
        feature: "Admin — create role",
    },
    {
        id: "api.admin.roles.item.GET",
        permission: "roles:read",
        surfaces: ["api"],
        feature: "Admin — get role",
    },
    {
        id: "api.admin.roles.item.PATCH",
        permission: "roles:update",
        surfaces: ["api"],
        feature: "Admin — update role",
    },
    {
        id: "api.admin.roles.item.DELETE",
        permission: "roles:delete",
        surfaces: ["api"],
        feature: "Admin — delete role",
    },
    {
        id: "api.admin.permissions.GET",
        permission: "roles:read",
        surfaces: ["api"],
        feature: "Admin — list permission definitions",
    },
    {
        id: "api.chatbot.ingest.POST",
        permission: "chatbot_documents:create",
        surfaces: ["api"],
        feature: "Chatbot — ingest document",
    },
    {
        id: "api.chatbot.documents.collection.GET",
        permission: "chatbot_documents:read",
        surfaces: ["api"],
        feature: "Chatbot — list documents",
    },
    {
        id: "api.chatbot.documents.collection.PATCH",
        permission: "chatbot_documents:update",
        surfaces: ["api"],
        feature: "Chatbot — update documents (batch)",
    },
    {
        id: "api.chatbot.documents.item.DELETE",
        permission: "chatbot_documents:delete",
        surfaces: ["api"],
        feature: "Chatbot — delete document",
    },
    {
        id: "api.chatbot.sessions.collection.GET",
        permission: "chatbot_sessions:read",
        surfaces: ["api"],
        feature: "Chatbot — list sessions",
    },
    {
        id: "api.chatbot.sessions.collection.POST",
        permission: "chatbot_sessions:create",
        surfaces: ["api"],
        feature: "Chatbot — create session",
    },
    {
        id: "api.chatbot.sessions.item.GET",
        permission: "chatbot_sessions:read",
        surfaces: ["api"],
        feature: "Chatbot — get session",
    },
    {
        id: "api.chatbot.sessions.item.PATCH",
        permission: "chatbot_sessions:update",
        surfaces: ["api"],
        feature: "Chatbot — update session",
    },
    {
        id: "api.chatbot.sessions.item.DELETE",
        permission: "chatbot_sessions:delete",
        surfaces: ["api"],
        feature: "Chatbot — delete session",
    },
    {
        id: "api.chatbot.messages.GET",
        permission: "chatbot_messages:read",
        surfaces: ["api"],
        feature: "Chatbot — list messages",
    },
    {
        id: "api.chatbot.messages.POST",
        permission: "chatbot_messages:create",
        surfaces: ["api"],
        feature: "Chatbot — append message",
    },
    {
        id: "api.chatbot.messages.DELETE",
        permission: "chatbot_messages:delete",
        surfaces: ["api"],
        feature: "Chatbot — clear / delete messages",
    },
    {
        id: "api.chatbot.query.POST",
        permission: "chatbot_query:create",
        surfaces: ["api"],
        feature: "Chatbot — RAG query",
    },
    {
        id: "api.chatbot.jobs.item.GET",
        permission: "chatbot_jobs:read",
        surfaces: ["api"],
        feature: "Chatbot — job status",
    },
    {
        id: "api.chatbot.sources.collection.GET",
        permission: "chatbot_sources:read",
        surfaces: ["api"],
        feature: "Chatbot — list sources (legacy)",
    },
    {
        id: "api.chatbot.sources.item.DELETE",
        permission: "chatbot_sources:delete",
        surfaces: ["api"],
        feature: "Chatbot — delete source (legacy)",
    },
    {
        id: "api.scraper.scrape.POST",
        permission: "scraper:create",
        surfaces: ["api"],
        feature: "Scraper — run scrape",
    },
    {
        id: "api.scraper.crawl.POST",
        permission: "scraper:create",
        surfaces: ["api"],
        feature: "Scraper — run crawl",
    },
    {
        id: "page.dashboard.admin.users",
        permission: "users:read",
        surfaces: ["page"],
        feature: "UI — Users & roles admin page",
    },
    {
        id: "page.dashboard.admin.roles",
        permission: "roles:read",
        surfaces: ["page"],
        feature: "UI — Roles & permissions admin page",
    },
] as const satisfies readonly RbacEnforcementPoint[];

const RBAC_NAV_ENFORCEMENT_POINTS: RbacEnforcementPoint[] = DASHBOARD_SIDEBAR_NAV.map((row) => ({
    id: row.id,
    permission: row.permission,
    surfaces: ["nav"],
    feature: `Sidebar — ${row.label}`,
}));

export const RBAC_ENFORCEMENT_POINTS: readonly RbacEnforcementPoint[] = [
    ...RBAC_CORE_ENFORCEMENT_POINTS,
    ...RBAC_NAV_ENFORCEMENT_POINTS,
];

export type RbacEnforcementId =
    | (typeof RBAC_CORE_ENFORCEMENT_POINTS)[number]["id"]
    | (typeof DASHBOARD_SIDEBAR_NAV)[number]["id"];
