"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FormError } from "@repo/ui/form-error";
import { useAuth } from "@repo/auth/hooks/useAuth";
import { validateEmail, validateName, validateSignupPassword } from "@/components/auth/validation";
import {
    AuthPasswordField,
    AuthPasswordHint,
    AuthSubmitButton,
    AuthTextField,
    FieldError,
} from "@/components/auth/ThemedFormControls";
import { signupFormThemeClasses } from "@/lib/theme/components/signup-form.theme";

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
        <form className={signupFormThemeClasses.form} onSubmit={onSubmit}>
            <AuthTextField
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
                error={nameError}
                required
            />
            <FieldError message={nameError} />
            <AuthTextField
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
                error={emailError}
                required
            />
            <FieldError message={emailError} />
            <AuthPasswordField
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
                error={passwordError}
                required
            />
            <FieldError message={passwordError} />
            <AuthPasswordHint>
                Use at least 8 characters and avoid reusing passwords from other apps.
            </AuthPasswordHint>
            <FormError message={error} />
            <AuthSubmitButton
                type="submit"
                isLoading={isSubmitting}
            >
                Create account
            </AuthSubmitButton>
        </form>
    );
}
