"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FormButton as Button } from "@repo/ui/form-button";
import { FormError } from "@repo/ui/form-error";
import { Input } from "@repo/ui/input";
import { PasswordInput } from "@repo/ui/password-input";
import { useAuth } from "@repo/auth/hooks/useAuth";
import { validateEmail, validateName, validateSignupPassword } from "@/components/auth/validation";

export function SignupForm() {
    const router = useRouter();
    const { signup } = useAuth();

    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [nameError, setNameError] = useState<string | undefined>(undefined);
    const [emailError, setEmailError] = useState<string | undefined>(undefined);
    const [passwordError, setPasswordError] = useState<string | undefined>(undefined);
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    function validateForm() {
        const nextNameError = validateName(name);
        const nextEmailError = validateEmail(email);
        const nextPasswordError = validateSignupPassword(password);

        setNameError(nextNameError);
        setEmailError(nextEmailError);
        setPasswordError(nextPasswordError);

        return !nextNameError && !nextEmailError && !nextPasswordError;
    }

    async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError(null);

        if (!validateForm()) {
            return;
        }

        setIsSubmitting(true);

        const result = await signup({ name, email, password });
        setIsSubmitting(false);

        if (!result.ok) {
            setError(result.error || "Unable to sign up.");
            return;
        }

        router.push("/login?message=verify-email");
        router.refresh();
    }

    return (
        <form className="space-y-5" onSubmit={onSubmit}>
            <Input
                id="signup-name"
                label="Name"
                name="name"
                type="text"
                autoComplete="name"
                placeholder="Your name"
                value={name}
                onChange={(event) => {
                    setName(event.target.value);
                    if (nameError) {
                        setNameError(validateName(event.target.value));
                    }
                }}
                onBlur={() => setNameError(validateName(name))}
                aria-invalid={Boolean(nameError)}
                className="glass-input h-11 rounded-xl text-base text-slate-900 placeholder:text-slate-500 focus:border-brand-500 focus:ring-brand-500 sm:text-sm"
                required
            />
            {nameError ? <p className="-mt-3 text-xs text-red-700">{nameError}</p> : null}
            <Input
                id="signup-email"
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
                className={`glass-input h-11 rounded-xl text-base text-slate-900 placeholder:text-slate-500 focus:border-brand-500 focus:ring-brand-500 sm:text-sm ${emailError ? "border-red-400 focus:border-red-500 focus:ring-red-500" : ""
                    }`}
                required
            />
            {emailError ? <p className="-mt-3 text-xs text-red-700">{emailError}</p> : null}
            <PasswordInput
                id="signup-password"
                label="Password"
                name="password"
                autoComplete="new-password"
                placeholder="At least 8 characters"
                value={password}
                onChange={(event) => {
                    setPassword(event.target.value);
                    if (passwordError) {
                        setPasswordError(validateSignupPassword(event.target.value));
                    }
                }}
                onBlur={() => setPasswordError(validateSignupPassword(password))}
                aria-invalid={Boolean(passwordError)}
                className={`glass-input h-11 rounded-xl text-base text-slate-900 placeholder:text-slate-500 sm:text-sm ${passwordError ? "border-red-400" : ""}`}
                required
            />
            {passwordError ? <p className="-mt-3 text-xs text-red-700">{passwordError}</p> : null}
            <p className="-mt-2 text-xs leading-5 text-slate-600">
                Use at least 8 characters and avoid reusing passwords from other apps.
            </p>
            <FormError message={error} />
            <Button
                type="submit"
                isLoading={isSubmitting}
                className="h-11 rounded-xl bg-brand-700 text-sm font-semibold tracking-wide text-white shadow-lg shadow-brand-700/20 hover:bg-brand-800"
            >
                Create account
            </Button>
        </form>
    );
}
