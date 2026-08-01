import Link from "next/link";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth/AuthShell";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";

export const metadata = {
    title: "Reset password",
    description: "Choose a new password for your AI Chatbot Platform account.",
};

function LoadingFallback() {
    return (
        <p role="status" aria-live="polite" className="text-sm text-slate-700">
            Loading…
        </p>
    );
}

export default function ResetPasswordPage() {
    return (
        <AuthShell
            compact
            badge="Set New Password"
            title="Reset password"
            subtitle="Choose a strong new password for your account. We recommend at least 12 characters."
            footer={
                <p>
                    Back to{" "}
                    <Link href="/login" className="font-semibold text-brand-700 transition hover:text-brand-900">
                        log in
                    </Link>
                    .
                </p>
            }
        >
            <Suspense fallback={<LoadingFallback />}>
                <ResetPasswordForm />
            </Suspense>
        </AuthShell>
    );
}
