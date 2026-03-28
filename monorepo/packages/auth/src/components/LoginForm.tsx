"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../hooks/useAuth";

type LoginFormProps = {
    infoMessage?: string | null;
    redirectTo?: string;
    basePath?: string;
    renderInput: (props: { id: string; label: string; name: string; type: string; autoComplete: string; placeholder: string; value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; required: boolean }) => React.ReactNode;
    renderPasswordInput: (props: { id: string; label: string; name: string; autoComplete: string; placeholder: string; value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; required: boolean }) => React.ReactNode;
    renderButton: (props: { type: "submit"; isLoading: boolean; children: React.ReactNode }) => React.ReactNode;
    renderError: (props: { message: string | null }) => React.ReactNode;
};

export function LoginForm({
    infoMessage = null,
    redirectTo = "/dashboard",
    basePath = "/api/auth",
    renderInput,
    renderPasswordInput,
    renderButton,
    renderError,
}: LoginFormProps) {
    const router = useRouter();
    const { login } = useAuth({ basePath });

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError(null);
        setIsSubmitting(true);

        const result = await login({ email, password });
        setIsSubmitting(false);

        if (!result.ok) {
            setError(result.error || "Unable to sign in.");
            return;
        }

        router.push(redirectTo);
        router.refresh();
    }

    return (
        <form className="space-y-4" onSubmit={onSubmit}>
            {renderInput({
                id: "login-email",
                label: "Email",
                name: "email",
                type: "email",
                autoComplete: "email",
                placeholder: "you@example.com",
                value: email,
                onChange: (e) => setEmail(e.target.value),
                required: true,
            })}
            {renderPasswordInput({
                id: "login-password",
                label: "Password",
                name: "password",
                autoComplete: "current-password",
                placeholder: "Your password",
                value: password,
                onChange: (e) => setPassword(e.target.value),
                required: true,
            })}
            {infoMessage ? (
                <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    {infoMessage}
                </p>
            ) : null}
            {renderError({ message: error })}
            {renderButton({ type: "submit", isLoading: isSubmitting, children: "Log in" })}
        </form>
    );
}
