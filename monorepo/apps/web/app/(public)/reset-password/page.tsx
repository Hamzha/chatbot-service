"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { AuthCard } from "@repo/auth/components/AuthCard";
import { FormButton as Button } from "@repo/ui/form-button";
import { FormError } from "@repo/ui/form-error";
import { PasswordInput } from "@repo/ui/password-input";

function ResetPasswordContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const token = useMemo(() => searchParams.get("token") || "", [searchParams]);

    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError(null);
        setSuccess(null);

        if (!token) {
            setError("Missing reset token.");
            return;
        }

        if (password !== confirmPassword) {
            setError("Passwords do not match.");
            return;
        }

        setIsSubmitting(true);

        try {
            const response = await fetch("/api/auth/reset-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token, password }),
            });

            const data = (await response.json()) as { message?: string; error?: string };

            if (!response.ok) {
                setError(data.error || "Unable to reset password.");
                return;
            }

            setSuccess(data.message || "Password reset successful.");

            setTimeout(() => {
                router.push("/login");
            }, 1200);
        } catch {
            setError("Unable to reset password.");
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <main className="flex min-h-screen items-center justify-center px-4 py-10">
            <div className="glass-strong w-full max-w-md rounded-3xl p-8">
            <AuthCard title="Reset password" subtitle="Choose a new password for your account.">
                <form className="space-y-4" onSubmit={onSubmit}>
                    <PasswordInput
                        id="reset-password"
                        label="New password"
                        name="password"
                        autoComplete="new-password"
                        placeholder="At least 8 characters"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        required
                    />
                    <PasswordInput
                        id="reset-password-confirm"
                        label="Confirm new password"
                        name="confirm-password"
                        autoComplete="new-password"
                        placeholder="Re-enter your new password"
                        value={confirmPassword}
                        onChange={(event) => setConfirmPassword(event.target.value)}
                        required
                    />

                    <FormError message={error} />

                    {success ? (
                        <p className="glass rounded-xl border-emerald-300/60 px-3 py-2 text-sm text-emerald-800">
                            {success}
                        </p>
                    ) : null}

                    <Button type="submit" isLoading={isSubmitting}>
                        Reset password
                    </Button>
                </form>

                <p className="mt-4 text-sm text-slate-600">
                    Back to{" "}
                    <Link href="/login" className="font-medium text-brand-700 hover:text-brand-900">
                        login
                    </Link>
                </p>
            </AuthCard>
            </div>
        </main>
    );
}

export default function ResetPasswordPage() {
    return (
        <Suspense fallback={<main className="flex min-h-screen items-center justify-center text-slate-600">Loading...</main>}>
            <ResetPasswordContent />
        </Suspense>
    );
}
