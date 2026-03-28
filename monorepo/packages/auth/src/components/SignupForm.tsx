"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../hooks/useAuth";

type SignupFormProps = {
    redirectTo?: string;
    basePath?: string;
    renderInput: (props: { id: string; label: string; name: string; type: string; autoComplete: string; placeholder: string; value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; required: boolean }) => React.ReactNode;
    renderPasswordInput: (props: { id: string; label: string; name: string; autoComplete: string; placeholder: string; value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; required: boolean }) => React.ReactNode;
    renderButton: (props: { type: "submit"; isLoading: boolean; children: React.ReactNode }) => React.ReactNode;
    renderError: (props: { message: string | null }) => React.ReactNode;
};

export function SignupForm({
    redirectTo = "/login?message=verify-email",
    basePath = "/api/auth",
    renderInput,
    renderPasswordInput,
    renderButton,
    renderError,
}: SignupFormProps) {
    const router = useRouter();
    const { signup } = useAuth({ basePath });

    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError(null);
        setIsSubmitting(true);

        const result = await signup({ name, email, password });
        setIsSubmitting(false);

        if (!result.ok) {
            setError(result.error || "Unable to sign up.");
            return;
        }

        router.push(redirectTo);
        router.refresh();
    }

    return (
        <form className="space-y-4" onSubmit={onSubmit}>
            {renderInput({
                id: "signup-name",
                label: "Name",
                name: "name",
                type: "text",
                autoComplete: "name",
                placeholder: "Your name",
                value: name,
                onChange: (e) => setName(e.target.value),
                required: true,
            })}
            {renderInput({
                id: "signup-email",
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
                id: "signup-password",
                label: "Password",
                name: "password",
                autoComplete: "new-password",
                placeholder: "At least 8 characters",
                value: password,
                onChange: (e) => setPassword(e.target.value),
                required: true,
            })}
            {renderError({ message: error })}
            {renderButton({ type: "submit", isLoading: isSubmitting, children: "Create account" })}
        </form>
    );
}
