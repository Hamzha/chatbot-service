"use client";

import { useState } from "react";
import { FormButton as Button } from "@repo/ui/form-button";
import { FormError } from "@repo/ui/form-error";
import { Input } from "@repo/ui/input";
import { toast } from "@/lib/ui/toast";

export function ForgotPasswordForm() {
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
                const msg = data.error || "Unable to process request.";
                setError(msg);
                toast.error(msg);
                return;
            }

            const successMsg = data.message || "If an account exists, a reset link has been sent.";
            setMessage(successMsg);
            toast.success("Reset email sent");
        } catch {
            setError("Unable to process request.");
            toast.error("Unable to process request.");
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
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
                className="glass-input h-11 rounded-xl text-base text-slate-900 placeholder:text-slate-500 sm:text-sm"
                required
            />

            <FormError message={error} />

            {message ? (
                <p
                    role="status"
                    className="glass rounded-xl border-emerald-300/60 px-3 py-2 text-sm text-emerald-800"
                >
                    {message}
                </p>
            ) : null}

            <Button
                type="submit"
                isLoading={isSubmitting}
                className="h-11 rounded-xl bg-brand-700 text-sm font-semibold tracking-wide text-white shadow-lg shadow-brand-700/20 hover:bg-brand-800"
            >
                Send reset link
            </Button>
        </form>
    );
}
