"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { FormError } from "@/components/ui/FormError";
import { Input } from "@/components/ui/Input";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { useAuth } from "@/hooks/useAuth";

export function SignupForm() {
    const router = useRouter();
    const { signup } = useAuth();

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

        router.push("/login?message=verify-email");
        router.refresh();
    }

    return (
        <form className="space-y-4" onSubmit={onSubmit}>
            <Input
                id="signup-name"
                label="Name"
                name="name"
                type="text"
                autoComplete="name"
                placeholder="Your name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
            />
            <Input
                id="signup-email"
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
                id="signup-password"
                label="Password"
                name="password"
                autoComplete="new-password"
                placeholder="At least 8 characters"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
            />
            <FormError message={error} />
            <Button type="submit" isLoading={isSubmitting}>
                Create account
            </Button>
        </form>
    );
}
