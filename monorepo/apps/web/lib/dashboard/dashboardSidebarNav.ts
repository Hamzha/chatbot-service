/**
 * Primary dashboard nav entries (permission-gated in `Sidebar.tsx`).
 * Ids are stable for RBAC tests and `rbacEnforcementCatalog`.
 */
export const DASHBOARD_SIDEBAR_NAV = [
    {
        id: "nav.dashboard.overview",
        label: "Overview",
        href: "/dashboard",
        permission: "dashboard:read",
    },
    {
        id: "nav.dashboard.scraper",
        label: "Web Scraper",
        href: "/dashboard/scraper",
        permission: "scraper:read",
    },
    {
        id: "nav.dashboard.upload-document",
        label: "Upload Document",
        href: "/dashboard/upload-document",
        permission: "chatbot_documents:create",
    },
    {
        id: "nav.dashboard.chatbot",
        label: "Chats",
        href: "/dashboard/chatbot",
        permission: "chatbot_sessions:read",
    },
    {
        id: "nav.dashboard.get-script",
        label: "Get Script",
        href: "/dashboard/get-script",
        permission: "chatbot_sessions:read",
    },
    {
        id: "nav.dashboard.admin.roles",
        label: "Roles & permissions",
        href: "/dashboard/admin/roles",
        permission: "roles:read",
    },
    {
        id: "nav.dashboard.admin.users",
        label: "Users & roles",
        href: "/dashboard/admin/users",
        permission: "users:read",
    },
] as const;
