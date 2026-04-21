import { requirePagePermission } from "@/lib/auth/requirePagePermission";
import { GetScriptClient } from "./GetScriptClient";

export default async function GetScriptPage() {
    await requirePagePermission("chatbot_sessions:read");
    return <GetScriptClient />;
}
