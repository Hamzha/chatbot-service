"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FormButton as Button } from "@repo/ui/form-button";
import { FormError } from "@repo/ui/form-error";
import { Input } from "@repo/ui/input";
import { PasswordInput } from "@repo/ui/password-input";
import { useAuth } from "@repo/auth/hooks/useAuth";
import { validateEmail, validateLoginPassword } from "@/components/auth/validation";

type LoginFormProps = {
    infoMessage?: string | null;
};

export function LoginForm({ infoMessage = null }: LoginFormProps) {
    const router = useRouter();
    const { login } = useAuth();

    const [email, setEmail] = useState("test@example.com");
    const [password, setPassword] = useState("test@examplpe");
    const [emailError, setEmailError] = useState<string | undefined>(undefined);
    const [passwordError, setPasswordError] = useState<string | undefined>(undefined);
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    function validateForm() {
        const nextEmailError = validateEmail(email);
        const nextPasswordError = validateLoginPassword(password);

        setEmailError(nextEmailError);
        setPasswordError(nextPasswordError);

        return !nextEmailError && !nextPasswordError;
    }

    async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError(null);

        if (!validateForm()) {
            return;
        }

        setIsSubmitting(true);

        const result = await login({ email, password });
        setIsSubmitting(false);

        if (!result.ok) {
            setError(result.error || "Unable to sign in.");
            return;
        }

        router.push("/dashboard");
        router.refresh();
    }

    return (
        <form className="space-y-5" onSubmit={onSubmit}>
            <Input
                id="login-email"
                label="Email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(event) => {
                    setEmail(event.target.value);
                    if (emailError) {
                        setEmailError(validateEmail(event.target.value));
                    }
                }}
                onBlur={() => setEmailError(validateEmail(email))}
                aria-invalid={Boolean(emailError)}
                autoFocus
                className={`glass-input h-11 rounded-xl text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:ring-brand-500 ${emailError ? "border-red-400 focus:border-red-500 focus:ring-red-500" : ""
                    }`}
                required
            />
            {emailError ? <p className="-mt-3 text-xs text-red-700">{emailError}</p> : null}
            <PasswordInput
                id="login-password"
                label="Password"
                name="password"
                autoComplete="current-password"
                placeholder="Your password"
                value={password}
                onChange={(event) => {
                    setPassword(event.target.value);
                    if (passwordError) {
                        setPasswordError(validateLoginPassword(event.target.value));
                    }
                }}
                onBlur={() => setPasswordError(validateLoginPassword(password))}
                aria-invalid={Boolean(passwordError)}
                className={`glass-input h-11 rounded-xl text-slate-900 placeholder:text-slate-400 ${passwordError ? "border-red-400" : ""}`}
                required
            />
            {passwordError ? <p className="-mt-3 text-xs text-red-700">{passwordError}</p> : null}
            {infoMessage ? (
                <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    {infoMessage}
                </p>
            ) : null}
            <FormError message={error} />
            <Button
                type="submit"
                isLoading={isSubmitting}
                className="h-11 rounded-xl bg-brand-700 text-sm font-semibold tracking-wide text-white shadow-lg shadow-brand-700/20 hover:bg-brand-800"
            >
                Log in
            </Button>
        </form>
    );
}
