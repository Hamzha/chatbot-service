import { requirePagePermission } from "@/lib/auth/requirePagePermission";
import { PlansAdminClient } from "@/components/dashboard/PlansAdminClient";

export default async function AdminPlansPage() {
    await requirePagePermission("plans:read");
    return <PlansAdminClient />;
}
