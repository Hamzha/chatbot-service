import {
    appendWidgetMessage,
    listLastBotWidgetMessages,
    listWidgetMessagesForSession,
} from "@/lib/db/widgetMessageRepo";
import {
    createEscalation,
    findOpenEscalationForSession,
} from "@/lib/db/escalationRepo";
import { AUTO_ESCALATION_SYSTEM_PROMPT } from "@/lib/chatbot/escalationConstants";

const LOW_CONFIDENCE_STREAK = 2;

export type MaybeAutoEscalateArgs = {
    chatbot: {
        id: string;
        userId: string;
        autoEscalationEnabled: boolean;
    };
    widgetSessionId: string;
    currentBotMessageNumContexts: number;
};

export type MaybeAutoEscalateResult =
    | { created: false; reason: "disabled" | "no-session-id" | "duplicate" | "streak-not-met" | "no-bot-message" }
    | { created: true; escalationId: string };

export async function maybeAutoEscalate(
    args: MaybeAutoEscalateArgs,
): Promise<MaybeAutoEscalateResult> {
    if (!args.chatbot.autoEscalationEnabled) {
        return { created: false, reason: "disabled" };
    }
    if (!args.widgetSessionId.trim()) {
        return { created: false, reason: "no-session-id" };
    }
    if (args.currentBotMessageNumContexts !== 0) {
        return { created: false, reason: "streak-not-met" };
    }

    const existing = await findOpenEscalationForSession(args.widgetSessionId);
    if (existing) {
        return { created: false, reason: "duplicate" };
    }

    const recent = await listLastBotWidgetMessages(args.widgetSessionId, LOW_CONFIDENCE_STREAK);
    if (recent.length < LOW_CONFIDENCE_STREAK) {
        return { created: false, reason: "streak-not-met" };
    }
    const allLowConfidence = recent.every((m) => m.metadata.numContexts === 0);
    if (!allLowConfidence) {
        return { created: false, reason: "streak-not-met" };
    }

    const transcript = await listWidgetMessagesForSession(args.widgetSessionId, 20);
    const transcriptSnapshot = transcript
        .filter((m) => m.role === "user" || m.role === "bot")
        .map((m) => ({
            role: m.role as "user" | "bot",
            content: m.content,
            createdAt: m.createdAt,
        }));

    const record = await createEscalation({
        botOwnerId: args.chatbot.userId,
        chatbotId: args.chatbot.id,
        widgetSessionId: args.widgetSessionId,
        contact: { name: "", email: "" },
        reason: "low_confidence",
        message: "",
        transcriptSnapshot,
    });

    try {
        await appendWidgetMessage({
            botId: args.chatbot.id,
            widgetSessionId: args.widgetSessionId,
            role: "system",
            content: AUTO_ESCALATION_SYSTEM_PROMPT,
        });
    } catch (err) {
        console.error("[autoEscalation] failed to append system prompt", err);
    }

    return { created: true, escalationId: record.id };
}
