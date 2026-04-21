import { requirePagePermission } from "@/lib/auth/requirePagePermission";
import { NewChatbotClient } from "./NewChatbotClient";

export default async function NewChatbotPage() {
    await requirePagePermission("chatbot_sessions:create");
    return <NewChatbotClient />;
}
