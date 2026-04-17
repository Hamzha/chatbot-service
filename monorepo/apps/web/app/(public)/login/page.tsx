import Link from "next/link";
import { LoginForm } from "@/components/auth/LoginForm";
import { AuthShell } from "@/components/auth/AuthShell";
import { getDemoLoginEnv } from "@/lib/db/demoUsers";

type LoginPageProps = {
    searchParams: Promise<{ message?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
    const params = await searchParams;
    const infoMessage = params.message === "verify-email" ? "Please verify your email before logging in." : null;
    const demo = getDemoLoginEnv();

    return (
        <AuthShell
            badge="Secure Access"
            title="Welcome back"
            subtitle="Sign in to continue managing your chatbot workflows, documents, and dashboard insights."
            sideTitle="One login for your full AI operations workspace"
            sideDescription="Use a secure session to access ingestion jobs, vector search results, and team-managed chatbot configurations."
            sidePoints={[
                "Protected dashboard routes with session cookies",
                "Fast access to chatbot analytics and ingestion jobs",
                "Secure reset and verification email flow",
            ]}
            footer={
                <p>
                    Do not have an account?{" "}
                    <Link href="/signup" className="font-semibold text-brand-700 transition hover:text-brand-900">
                        Create one now
                    </Link>
                    .
                </p>
            }
        >
            <LoginForm infoMessage={infoMessage} demoLoginEnabled={demo.enabled} />
            <p className="-mt-1 text-right text-sm text-slate-600">
                <Link href="/forgot-password" className="font-semibold text-brand-700 transition hover:text-brand-900">
                    Forgot your password?
                </Link>
            </p>
        </AuthShell>
    );
}
