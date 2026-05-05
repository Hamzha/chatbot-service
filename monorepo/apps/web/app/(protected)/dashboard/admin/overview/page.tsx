import { requirePagePermission } from "@/lib/auth/requirePagePermission";
import { AdminOverviewClient } from "@/components/dashboard/AdminOverviewClient";

export default async function AdminOverviewPage() {
    await requirePagePermission("admin_overview:read");
    return <AdminOverviewClient />;
}
