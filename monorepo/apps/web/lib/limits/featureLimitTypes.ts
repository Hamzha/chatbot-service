export const FEATURE_LIMIT_KEYS = [
    "scraperRuns",
    "documentUploads",
    "botsCreated",
    "dashboardChats",
    "widgetChats",
] as const;

export type FeatureLimitKey = (typeof FEATURE_LIMIT_KEYS)[number];

export type FeatureLimitPeriod = "lifetime" | "calendar_month";

/** `null` = unlimited for that feature. */
export type FeatureLimitValues = Record<FeatureLimitKey, number | null>;

export const FEATURE_LIMIT_LABELS: Record<FeatureLimitKey, string> = {
    scraperRuns: "Scraper runs (one-shot + crawl jobs)",
    documentUploads: "Document uploads (PDF ingest)",
    botsCreated: "Chatbots / sessions created",
    dashboardChats: "Dashboard chat messages",
    widgetChats: "Widget chat messages",
};

export const DEFAULT_FEATURE_LIMITS: FeatureLimitValues = {
    scraperRuns: 20,
    documentUploads: 10,
    botsCreated: 3,
    dashboardChats: 100,
    widgetChats: 200,
};
