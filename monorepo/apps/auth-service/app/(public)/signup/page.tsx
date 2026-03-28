import Link from "next/link";
import { AuthCard } from "@repo/auth/components/AuthCard";
import { SignupForm } from "@/components/auth/SignupForm";

export default function SignupPage() {
    return (
        <main className="flex min-h-screen items-center justify-center bg-zinc-100 px-4 py-10">
            <AuthCard title="Create account" subtitle="Start with a secure session cookie flow.">
                <SignupForm />
                <p className="mt-4 text-sm text-zinc-600">
                    Already have an account?{" "}
                    <Link href="/login" className="font-medium text-sky-700 hover:text-sky-800">
                        Log in
                    </Link>
                </p>
            </AuthCard>
        </main>
    );
}
