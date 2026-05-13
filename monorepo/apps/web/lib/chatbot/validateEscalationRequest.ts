import { getChatSessionById, type ChatSessionRecord } from "@/lib/db/chatSessionRepo";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_MESSAGE = 500;
const MAX_TRANSCRIPT_ENTRIES = 20;
const MAX_TRANSCRIPT_CONTENT = 4000;

export type EscalationReason = "user_request" | "low_confidence" | "manual";

export type WidgetEscalationInput = Record<string, unknown>;

type ValidatedTranscriptEntry = {
    role: "user" | "bot";
    content: string;
    createdAt: string;
};

type ValidationSuccess = {
    valid: true;
    botId: string;
    widgetSessionId: string;
    contact: { name: string; email: string };
    message: string;
    reason: EscalationReason;
    transcript: ValidatedTranscriptEntry[];
    chatbot: ChatSessionRecord;
};

type ValidationFailure = {
    valid: false;
    error: string;
    status: number;
};

export type ValidationResult = ValidationSuccess | ValidationFailure;

function isString(v: unknown): v is string {
    return typeof v === "string";
}

function isReason(v: unknown): v is EscalationReason {
    return v === "user_request" || v === "low_confidence" || v === "manual";
}

function normalizeTranscript(raw: unknown): ValidatedTranscriptEntry[] | { error: string } {
    if (raw == null) return [];
    if (!Array.isArray(raw)) return { error: "transcript must be an array" };
    const sliced = raw.slice(-MAX_TRANSCRIPT_ENTRIES);
    const out: ValidatedTranscriptEntry[] = [];
    for (const entry of sliced) {
        if (!entry || typeof entry !== "object") {
            return { error: "transcript entries must be objects" };
        }
        const e = entry as Record<string, unknown>;
        const role = e.role;
        const content = e.content;
        const createdAt = e.createdAt;
        if (role !== "user" && role !== "bot") {
            return { error: "transcript role must be 'user' or 'bot'" };
        }
        if (!isString(content) || !content.trim()) {
            return { error: "transcript content must be a non-empty string" };
        }
        const trimmedContent = content.slice(0, MAX_TRANSCRIPT_CONTENT);
        let ts: string;
        if (isString(createdAt) && createdAt) {
            const d = new Date(createdAt);
            ts = Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
        } else {
            ts = new Date().toISOString();
        }
        out.push({ role, content: trimmedContent, createdAt: ts });
    }
    return out;
}

export async function validateEscalationRequest(body: unknown): Promise<ValidationResult> {
    if (!body || typeof body !== "object") {
        return { valid: false, error: "Invalid request body", status: 400 };
    }
    const { botId, widgetSessionId, contact, message, reason, transcript } = body as WidgetEscalationInput;

    if (!isString(botId) || !botId.trim()) {
        return { valid: false, error: "Missing or invalid botId", status: 400 };
    }
    if (!isString(widgetSessionId) || !widgetSessionId.trim()) {
        return { valid: false, error: "Missing or invalid widgetSessionId", status: 400 };
    }
    if (widgetSessionId.length > 128) {
        return { valid: false, error: "widgetSessionId too long", status: 400 };
    }
    if (!contact || typeof contact !== "object") {
        return { valid: false, error: "Missing contact details", status: 400 };
    }
    const c = contact as Record<string, unknown>;
    if (!isString(c.name) || !c.name.trim() || c.name.length > 100) {
        return { valid: false, error: "Name is required (1-100 chars)", status: 400 };
    }
    if (!isString(c.email) || !EMAIL_REGEX.test(c.email.trim())) {
        return { valid: false, error: "Valid email is required", status: 400 };
    }
    if (c.email.length > 254) {
        return { valid: false, error: "Email too long", status: 400 };
    }
    if (message !== undefined && !isString(message)) {
        return { valid: false, error: "message must be a string", status: 400 };
    }
    if (isString(message) && message.length > MAX_MESSAGE) {
        return { valid: false, error: `Message too long (max ${MAX_MESSAGE} chars)`, status: 400 };
    }
    const reasonValue: EscalationReason = isReason(reason) ? reason : "user_request";

    const transcriptResult = normalizeTranscript(transcript);
    if (!Array.isArray(transcriptResult)) {
        return { valid: false, error: transcriptResult.error, status: 400 };
    }

    const chatbot = await getChatSessionById(botId.trim());
    if (!chatbot) {
        return { valid: false, error: "Invalid botId", status: 404 };
    }

    return {
        valid: true,
        botId: botId.trim(),
        widgetSessionId: widgetSessionId.trim(),
        contact: { name: c.name.trim(), email: c.email.trim().toLowerCase() },
        message: isString(message) ? message.trim() : "",
        reason: reasonValue,
        transcript: transcriptResult,
        chatbot,
    };
}
