import { requirePagePermission } from "@/lib/auth/requirePagePermission";
import { RolesAdminClient } from "@/components/dashboard/RolesAdminClient";

export default async function AdminRolesPage() {
    await requirePagePermission("roles:read");
    return <RolesAdminClient />;
}
