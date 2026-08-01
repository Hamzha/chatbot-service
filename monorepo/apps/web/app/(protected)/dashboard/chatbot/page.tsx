import { requirePagePermission } from "@/lib/auth/requirePagePermission";
import { ChatbotListClient } from "./ChatbotListClient";

export default async function ChatbotPage() {
    await requirePagePermission("chatbot_sessions:read");
    return <ChatbotListClient />;
}
