/**
 * Canonical permission codes: `{module}:{action}`.
 * Synced to Mongo; admin UI loads from DB (joined with this list for validation).
 */
export type PermissionDefinition = {
    module: string;
    action: string;
    description: string;
};

const crud = (module: string, descriptions: Record<string, string>): PermissionDefinition[] =>
    (["create", "read", "update", "delete"] as const).map((action) => ({
        module,
        action,
        description: descriptions[action] ?? `${action} ${module}`,
    }));

export const PERMISSION_CATALOG: PermissionDefinition[] = [
    { module: "dashboard", action: "read", description: "Access the dashboard shell and overview" },
    ...crud("users", {
        create: "Create users",
        read: "View users",
        update: "Edit users",
        delete: "Delete users",
    }),
    ...crud("roles", {
        create: "Create roles",
        read: "View roles and permission matrix",
        update: "Edit roles and their permissions",
        delete: "Delete roles",
    }),
    ...crud("chatbot_documents", {
        create: "Upload / ingest documents",
        read: "List documents",
        update: "Update document metadata",
        delete: "Delete documents and vectors",
    }),
    ...crud("chatbot_sessions", {
        create: "Create chat sessions",
        read: "Open chat sessions",
        update: "Update session settings",
        delete: "Delete chat sessions",
    }),
    ...crud("chatbot_messages", {
        create: "Save chat messages",
        read: "Load chat history",
        update: "Edit messages (reserved)",
        delete: "Clear chat history",
    }),
    { module: "chatbot_query", action: "create", description: "Run RAG queries" },
    { module: "chatbot_jobs", action: "read", description: "Poll ingestion/query job status" },
    { module: "chatbot_sources", action: "read", description: "List vector sources (legacy API)" },
    { module: "chatbot_sources", action: "delete", description: "Delete vectors by source (legacy API)" },
    ...crud("scraper", {
        create: "Run scraper jobs",
        read: "View scraper UI",
        update: "Update scraper settings (reserved)",
        delete: "Delete scraper resources (reserved)",
    }),
];

export function permissionCode(module: string, action: string): string {
    return `${module}:${action}`;
}

export function allCatalogCodes(): string[] {
    return PERMISSION_CATALOG.map((p) => permissionCode(p.module, p.action));
}

export function isValidPermissionCode(code: string): boolean {
    return allCatalogCodes().includes(code);
}
