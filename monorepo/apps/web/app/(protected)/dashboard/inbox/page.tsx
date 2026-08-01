import { requirePagePermission } from "@/lib/auth/requirePagePermission";
import { InboxClient } from "./InboxClient";

export default async function InboxPage() {
    await requirePagePermission("escalations:read");
    return <InboxClient />;
}
