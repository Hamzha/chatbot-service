"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FormError } from "@repo/ui/form-error";
import { useAuth } from "@repo/auth/hooks/useAuth";
import { validateEmail, validateLoginPassword } from "@/components/auth/validation";
import {
    AuthInfoMessage,
    AuthPasswordField,
    AuthSubmitButton,
    AuthTextField,
    FieldError,
} from "@/components/auth/ThemedFormControls";

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
            <AuthTextField
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
                error={emailError}
                required
            />
            <FieldError message={emailError} />
            <AuthPasswordField
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
                error={passwordError}
                required
            />
            <FieldError message={passwordError} />
            <AuthInfoMessage message={infoMessage} />
            <FormError message={error} />
            <AuthSubmitButton
                type="submit"
                isLoading={isSubmitting}
            >
                Log in
            </AuthSubmitButton>
        </form>
    );
}
