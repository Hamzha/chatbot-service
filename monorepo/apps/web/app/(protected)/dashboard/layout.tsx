import { redirect } from "next/navigation";
import { getCurrentUserFromToken } from "@/lib/auth/authService";
import { getAuthContextForUserId } from "@/lib/auth/authorization";
import { getSessionCookie } from "@repo/auth/lib/cookies";
import { Sidebar } from "@/components/dashboard/Sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const token = await getSessionCookie();
  const user = token ? await getCurrentUserFromToken(token) : null;

  if (!user) {
    redirect("/login");
  }

  const ctx = await getAuthContextForUserId(user.id);
  const permissions = ctx ? [...ctx.permissions] : [];

  return (
    <div className="flex min-h-screen">
      <Sidebar userName={user.name} userEmail={user.email} permissions={permissions} />
      <main className="flex-1 ml-[17rem] p-8">{children}</main>
    </div>
  );
}
