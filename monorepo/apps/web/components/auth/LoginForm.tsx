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
    /** Two quick-login buttons; only when `ALLOW_DEMO_LOGIN=true` (see demoUsers defaults). */
    demoLoginEnabled?: boolean;
};

export function LoginForm({ infoMessage = null, demoLoginEnabled = false }: LoginFormProps) {
    const router = useRouter();
    const { login } = useAuth();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
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

    const [demoLoading, setDemoLoading] = useState<"admin" | "user" | null>(null);

    async function quickLogin(preset: "admin" | "user") {
        setError(null);
        if (!demoLoginEnabled) return;
        setDemoLoading(preset);
        try {
            const res = await fetch("/api/auth/demo-login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ preset }),
            });
            const data = (await res.json()) as { user?: { email: string }; error?: string };
            if (!res.ok || !data.user) {
                setError(data.error ?? "Demo login failed.");
                setDemoLoading(null);
                return;
            }
            router.push("/dashboard");
            router.refresh();
        } catch {
            setError("Demo login failed.");
            setDemoLoading(null);
        }
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
                className={`glass-input h-11 rounded-xl text-base text-slate-900 placeholder:text-slate-500 focus:border-brand-500 focus:ring-brand-500 sm:text-sm ${emailError ? "border-red-400 focus:border-red-500 focus:ring-red-500" : ""
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
                className={`glass-input h-11 rounded-xl text-base text-slate-900 placeholder:text-slate-500 sm:text-sm ${passwordError ? "border-red-400" : ""}`}
                required
            />
            {passwordError ? <p className="-mt-3 text-xs text-red-700">{passwordError}</p> : null}
            {infoMessage ? (
                <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    {infoMessage}
                </p>
            ) : null}
            {demoLoginEnabled ? (
                <div className="flex flex-col gap-2 sm:flex-row">
                    <button
                        type="button"
                        disabled={Boolean(demoLoading)}
                        onClick={() => void quickLogin("user")}
                        className="flex-1 rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm font-medium text-slate-800 hover:bg-white disabled:opacity-60"
                    >
                        {demoLoading === "user" ? "Signing in…" : "Login as test user"}
                    </button>
                    <button
                        type="button"
                        disabled={Boolean(demoLoading)}
                        onClick={() => void quickLogin("admin")}
                        className="flex-1 rounded-xl border border-brand-200 bg-white/80 px-3 py-2 text-sm font-medium text-brand-900 hover:bg-brand-50/80 disabled:opacity-60"
                    >
                        {demoLoading === "admin" ? "Signing in…" : "Login as admin"}
                    </button>
                </div>
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
