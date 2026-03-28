"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { FormError } from "@/components/ui/FormError";
import { Input } from "@/components/ui/Input";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { useAuth } from "@/hooks/useAuth";

type LoginFormProps = {
    infoMessage?: string | null;
};

export function LoginForm({ infoMessage = null }: LoginFormProps) {
    const router = useRouter();
    const { login } = useAuth();

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

        router.push("/dashboard");
        router.refresh();
    }

    return (
        <form className="space-y-4" onSubmit={onSubmit}>
            <Input
                id="login-email"
                label="Email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
            />
            <PasswordInput
                id="login-password"
                label="Password"
                name="password"
                autoComplete="current-password"
                placeholder="Your password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
            />
            {infoMessage ? (
                <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    {infoMessage}
                </p>
            ) : null}
            <FormError message={error} />
            <Button type="submit" isLoading={isSubmitting}>
                Log in
            </Button>
        </form>
    );
}
