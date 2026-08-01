"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { FormButton as Button } from "@repo/ui/form-button";
import { FormError } from "@repo/ui/form-error";
import { PasswordInput } from "@repo/ui/password-input";
import { toast } from "@/lib/ui/toast";

export function ResetPasswordForm() {
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
            toast.error("Missing reset token.");
            return;
        }

        if (password !== confirmPassword) {
            setError("Passwords do not match.");
            toast.error("Passwords do not match.");
            return;
        }

        setIsSubmitting(true);
        const loadingId = toast.loading("Resetting password…");

        try {
            const response = await fetch("/api/auth/reset-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token, password }),
            });
            const data = (await response.json()) as { message?: string; error?: string };

            if (!response.ok) {
                const msg = data.error || "Unable to reset password.";
                setError(msg);
                toast.error(msg, { id: loadingId });
                return;
            }

            const successMsg = data.message || "Password reset successful.";
            setSuccess(successMsg);
            toast.success("Password reset — please log in", { id: loadingId });

            setTimeout(() => {
                router.push("/login");
            }, 1200);
        } catch {
            setError("Unable to reset password.");
            toast.error("Unable to reset password.", { id: loadingId });
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <form className="space-y-4" onSubmit={onSubmit}>
            <PasswordInput
                id="reset-password"
                label="New password"
                name="password"
                autoComplete="new-password"
                placeholder="At least 8 characters"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="glass-input h-11 rounded-xl text-base text-slate-900 placeholder:text-slate-500 sm:text-sm"
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
                className="glass-input h-11 rounded-xl text-base text-slate-900 placeholder:text-slate-500 sm:text-sm"
                required
            />

            <FormError message={error} />

            {success ? (
                <p
                    role="status"
                    className="glass rounded-xl border-emerald-300/60 px-3 py-2 text-sm text-emerald-800"
                >
                    {success}
                </p>
            ) : null}

            <Button
                type="submit"
                isLoading={isSubmitting}
                className="h-11 rounded-xl bg-brand-700 text-sm font-semibold tracking-wide text-white shadow-lg shadow-brand-700/20 hover:bg-brand-800"
            >
                Reset password
            </Button>
        </form>
    );
}
