import { Suspense } from "react";
import { AuthShell } from "@/components/auth/AuthShell";
import { VerifyEmailStatus } from "@/components/auth/VerifyEmailStatus";

export const metadata = {
    title: "Verify email",
    description: "Confirm your AI Chatbot Platform account email.",
};

function LoadingFallback() {
    return (
        <div role="status" aria-live="polite" className="flex flex-col items-center gap-3 py-4 text-center">
            <div
                className="h-10 w-10 animate-spin rounded-full border-4 border-slate-300 border-t-brand-600"
                aria-hidden="true"
            />
            <p className="text-sm text-slate-700">Preparing verification…</p>
        </div>
    );
}

export default function VerifyEmailPage() {
    return (
        <AuthShell
            compact
            badge="Email Verification"
            title="Verify your email"
            subtitle="We are confirming your account email. This only takes a moment."
        >
            <Suspense fallback={<LoadingFallback />}>
                <VerifyEmailStatus />
            </Suspense>
        </AuthShell>
    );
}
