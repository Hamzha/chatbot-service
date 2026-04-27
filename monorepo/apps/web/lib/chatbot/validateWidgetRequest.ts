import { getChatSessionByWidgetId } from "@/lib/db/chatSessionRepo";

const MAX_MESSAGE_LENGTH = 500;

interface WidgetRequestInput {
  botId: unknown;
  message: unknown;
}

interface ValidationSuccess {
  valid: true;
  widgetId: string;
  message: string;
}

interface ValidationFailure {
  valid: false;
  error: string;
  status: number;
}

export type ValidationResult = ValidationSuccess | ValidationFailure;

export async function validateWidgetRequest(
  body: WidgetRequestInput
): Promise<ValidationResult> {
  const { botId, message } = body;

  if (typeof botId !== "string" || !botId.trim()) {
    return { valid: false, error: "Missing or invalid botId", status: 400 };
  }

  if (typeof message !== "string" || !message.trim()) {
    return { valid: false, error: "Missing or invalid message", status: 400 };
  }

  if (message.length > MAX_MESSAGE_LENGTH) {
    return {
      valid: false,
      error: `Message too long (max ${MAX_MESSAGE_LENGTH} characters)`,
      status: 400,
    };
  }

  const chatbot = await getChatSessionByWidgetId(botId.trim());
  if (!chatbot) {
    return { valid: false, error: "Invalid botId", status: 404 };
  }

  return { valid: true, widgetId: botId.trim(), message: message.trim() };
}
