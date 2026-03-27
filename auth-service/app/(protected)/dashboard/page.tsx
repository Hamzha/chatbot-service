import { redirect } from "next/navigation";
import { getCurrentUserFromToken } from "@/lib/auth/authService";
import { getSessionCookie } from "@/lib/auth/cookies";
import { LogoutButton } from "@/components/auth/LogoutButton";
export default async function DashboardPage() {
    const token = await getSessionCookie();
    const user = token ? await getCurrentUserFromToken(token) : null;

    if (!user) {
        redirect("/login");
    }

    return (
        <main className="flex min-h-screen items-center justify-center bg-zinc-100 px-4 py-10">
            <section className="w-full max-w-xl rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
                <h1 className="text-2xl font-semibold text-zinc-900">Dashboard</h1>
                <p className="mt-2 text-zinc-700">You are logged in as {user.email}</p>
                <p className="mt-1 text-zinc-500">Welcome, {user.name}.</p>
                <div className="mt-6">
                    <LogoutButton />
                </div>
            </section>
        </main>
    );
}
