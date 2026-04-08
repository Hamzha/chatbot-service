"use client";

import Link from "next/link";
import { useState } from "react";
import { AuthCard } from "@repo/auth/components/AuthCard";
import { FormButton as Button } from "@repo/ui/form-button";
import { FormError } from "@repo/ui/form-error";
import { Input } from "@repo/ui/input";

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
            <div className="glass-strong w-full max-w-md rounded-3xl p-8">
            <AuthCard title="Forgot password" subtitle="Enter your email to get a secure reset link.">
                <form className="space-y-4" onSubmit={onSubmit}>
                    <Input
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

                    {message ? (
                        <p className="glass rounded-xl border-emerald-300/60 px-3 py-2 text-sm text-emerald-800">
                            {message}
                        </p>
                    ) : null}

                    <Button type="submit" isLoading={isSubmitting}>
                        Send reset link
                    </Button>
                </form>

                <p className="mt-4 text-sm text-slate-600">
                    Remember your password?{" "}
                    <Link href="/login" className="font-medium text-brand-700 hover:text-brand-900">
                        Back to login
                    </Link>
                </p>
            </AuthCard>
            </div>
        </main>
    );
}
