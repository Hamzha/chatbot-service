import Link from "next/link";
import { AuthShell } from "@/components/auth/AuthShell";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";

export const metadata = {
    title: "Forgot password",
    description: "Request a password reset link for your AI Chatbot Platform account.",
};

export default function ForgotPasswordPage() {
    return (
        <AuthShell
            compact
            badge="Account Recovery"
            title="Forgot password"
            subtitle="Enter your account email and we will send a secure link to reset your password."
            footer={
                <p>
                    Remember your password?{" "}
                    <Link href="/login" className="font-semibold text-brand-700 transition hover:text-brand-900">
                        Back to log in
                    </Link>
                    .
                </p>
            }
        >
            <ForgotPasswordForm />
        </AuthShell>
    );
}
