import { requirePagePermission } from "@/lib/auth/requirePagePermission";
import { CustomizeClient } from "./CustomizeClient";

export default async function CustomizePage() {
    await requirePagePermission("chatbot_sessions:update");
    return <CustomizeClient />;
}
