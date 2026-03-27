import Link from "next/link";
import { AuthCard } from "@/components/auth/AuthCard";
import { LoginForm } from "@/components/auth/LoginForm";

type LoginPageProps = {
    searchParams: Promise<{ message?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
    const params = await searchParams;
    const infoMessage = params.message === "verify-email" ? "Please verify your email before logging in." : null;

    return (
        <main className="flex min-h-screen items-center justify-center bg-zinc-100 px-4 py-10">
            <AuthCard title="Welcome back" subtitle="Log in to continue to your dashboard.">
                <LoginForm infoMessage={infoMessage} />
                <p className="mt-3 text-sm text-zinc-600">
                    <Link href="/forgot-password" className="font-medium text-sky-700 hover:text-sky-800">
                        Forgot your password?
                    </Link>
                </p>
                <p className="mt-4 text-sm text-zinc-600">
                    Do not have an account?{" "}
                    <Link href="/signup" className="font-medium text-sky-700 hover:text-sky-800">
                        Sign up
                    </Link>
                </p>
            </AuthCard>
        </main>
    );
}
