import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth/requireApiPermission";
import { withApiLogging } from "@/lib/api/withApiLogging";
import { requireRateLimitByUser } from "@/lib/rateLimit/requireRateLimit";
import { listUsersForAdmin } from "@/lib/db/userRepo";
import { listChatSessions } from "@/lib/db/chatSessionRepo";
import { listChatbotDocuments, type ChatbotDocumentRecord } from "@/lib/db/chatbotDocumentRepo";

type OverviewDoc = {
    id: string;
    source: string;
    ragSourceKey: string;
    kind: ChatbotDocumentRecord["kind"];
    chunks: number;
    pages: number;
    createdAt: string;
    updatedAt: string;
};

type OverviewChatbot = {
    id: string;
    name: string;
    primaryColor: string;
    widgetPublicId: string;
    createdAt: string;
    updatedAt: string;
    documents: Array<OverviewDoc & { inLibrary: boolean }>;
    /** ragSourceKeys referenced by the session that no longer match a library doc */
    missingDocKeys: string[];
};

type OverviewUser = {
    id: string;
    email: string;
    name: string;
    createdAt: string;
    emailVerified: boolean;
    roles: { id: string; slug: string; name: string; enabled: boolean }[];
    chatbots: OverviewChatbot[];
    documents: Array<OverviewDoc & { attachedTo: { id: string; name: string }[] }>;
    counts: { chatbots: number; documents: number; totalChunks: number };
};

function toOverviewDoc(d: ChatbotDocumentRecord): OverviewDoc {
    return {
        id: d.id,
        source: d.source,
        ragSourceKey: d.ragSourceKey,
        kind: d.kind,
        chunks: d.chunks,
        pages: d.pages?.length ?? 0,
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
    };
}

async function getOverview() {
    const gate = await requireApiPermission("admin_overview:read");
    if (gate instanceof NextResponse) return gate;
    const limited = await requireRateLimitByUser(gate.ctx.userId, "admin:overview:read", {
        limit: 30,
        windowSec: 60,
    });
    if (limited) return limited;

    const users = await listUsersForAdmin();

    const overview: OverviewUser[] = await Promise.all(
        users.map(async (u) => {
            const [sessions, docs] = await Promise.all([
                listChatSessions(u.id),
                listChatbotDocuments(u.id),
            ]);

            const docByRagKey = new Map<string, ChatbotDocumentRecord>();
            for (const d of docs) {
                docByRagKey.set(d.ragSourceKey, d);
            }

            const docAttachments = new Map<string, { id: string; name: string }[]>();

            const chatbots: OverviewChatbot[] = sessions.map((s) => {
                const attached: OverviewChatbot["documents"] = [];
                const missingDocKeys: string[] = [];
                for (const key of s.selectedRagKeys) {
                    const doc = docByRagKey.get(key);
                    if (doc) {
                        attached.push({ ...toOverviewDoc(doc), inLibrary: true });
                        const list = docAttachments.get(doc.id) ?? [];
                        list.push({ id: s.id, name: s.name });
                        docAttachments.set(doc.id, list);
                    } else {
                        missingDocKeys.push(key);
                    }
                }
                return {
                    id: s.id,
                    name: s.name,
                    primaryColor: s.primaryColor,
                    widgetPublicId: s.widgetPublicId,
                    createdAt: s.createdAt,
                    updatedAt: s.updatedAt,
                    documents: attached,
                    missingDocKeys,
                };
            });

            const documents = docs.map((d) => ({
                ...toOverviewDoc(d),
                attachedTo: docAttachments.get(d.id) ?? [],
            }));

            const totalChunks = docs.reduce((sum, d) => sum + (d.chunks || 0), 0);

            return {
                id: u.id,
                email: u.email,
                name: u.name,
                createdAt: u.createdAt,
                emailVerified: u.emailVerified,
                roles: u.roles,
                chatbots,
                documents,
                counts: {
                    chatbots: chatbots.length,
                    documents: docs.length,
                    totalChunks,
                },
            };
        }),
    );

    return NextResponse.json({ users: overview });
}

export const GET = withApiLogging(getOverview);
