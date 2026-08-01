import { requirePagePermission } from "@/lib/auth/requirePagePermission";
import { ChatbotSessionClient } from "./ChatbotSessionClient";

export default async function ChatbotSessionPage() {
    await requirePagePermission("chatbot_sessions:read");
    return <ChatbotSessionClient />;
}
