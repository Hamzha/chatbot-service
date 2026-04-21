import { requirePagePermission } from "@/lib/auth/requirePagePermission";
import { UsersAdminClient } from "@/components/dashboard/UsersAdminClient";

export default async function AdminUsersPage() {
    await requirePagePermission("users:read");
    return <UsersAdminClient />;
}
