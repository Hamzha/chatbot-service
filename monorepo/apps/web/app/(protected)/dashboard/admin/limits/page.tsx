import { requirePagePermission } from "@/lib/auth/requirePagePermission";
import { LimitsAdminClient } from "@/components/dashboard/LimitsAdminClient";

export default async function AdminLimitsPage() {
    await requirePagePermission("limits:read");
    return <LimitsAdminClient />;
}
