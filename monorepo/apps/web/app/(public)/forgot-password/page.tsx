"use client";

import Link from "next/link";
import { useState } from "react";
import { AuthCard } from "@repo/auth/components/AuthCard";
import { FormError } from "@repo/ui/form-error";
import {
    AuthInfoMessage,
    AuthSubmitButton,
    AuthTextField,
} from "@/components/auth/ThemedFormControls";
import { ThemedStrongCard } from "@/components/theme/ThemedPrimitives";

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError(null);
        setMessage(null);
        setIsSubmitting(true);

        try {
            const response = await fetch("/api/auth/forgot-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email }),
            });

            const data = (await response.json()) as { message?: string; error?: string };

            if (!response.ok) {
                setError(data.error || "Unable to process request.");
                return;
            }

            setMessage(data.message || "If an account exists, a reset link has been sent.");
        } catch {
            setError("Unable to process request.");
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <main className="flex min-h-screen items-center justify-center px-4 py-10">
            <ThemedStrongCard className="w-full max-w-md rounded-3xl p-8">
                <AuthCard title="Forgot password" subtitle="Enter your email to get a secure reset link.">
                    <form className="space-y-4" onSubmit={onSubmit}>
                        <AuthTextField
                            id="forgot-password-email"
                            label="Email"
                            name="email"
                            type="email"
                            autoComplete="email"
                            placeholder="you@example.com"
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                            required
                        />

                        <FormError message={error} />

                        <AuthInfoMessage message={message} />

                        <AuthSubmitButton type="submit" isLoading={isSubmitting}>
                            Send reset link
                        </AuthSubmitButton>
                    </form>

                    <p className="mt-4 text-sm text-slate-600">
                        Remember your password?{" "}
                        <Link href="/login" className="font-medium text-brand-700 hover:text-brand-900">
                            Back to login
                        </Link>
                    </p>
                </AuthCard>
            </ThemedStrongCard>
        </main>
    );
}
