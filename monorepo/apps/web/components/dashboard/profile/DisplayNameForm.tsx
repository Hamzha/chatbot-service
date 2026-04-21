"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { SafeUser } from "@repo/auth/types";
import { FormButton as Button } from "@repo/ui/form-button";
import { FormError } from "@repo/ui/form-error";
import { Input } from "@repo/ui/input";
import { toast } from "@/lib/ui/toast";

export function DisplayNameForm({ initialUser }: { initialUser: SafeUser }) {
    const router = useRouter();
    const [name, setName] = useState(initialUser.name);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    async function onSave(event: React.FormEvent) {
        event.preventDefault();
        setError(null);
        setSuccess(null);
        setSaving(true);
        const loadingId = toast.loading("Saving profile…");
        try {
            const res = await fetch("/api/auth/me", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ name }),
            });
            const data = (await res.json()) as { user?: SafeUser; error?: string };
            if (!res.ok || !data.user) {
                const msg = data.error ?? "Could not save.";
                setError(msg);
                toast.error(msg, { id: loadingId });
                return;
            }
            setSuccess("Profile updated.");
            toast.success("Profile updated", { id: loadingId });
            router.refresh();
        } catch {
            setError("Could not save.");
            toast.error("Could not save.", { id: loadingId });
        } finally {
            setSaving(false);
        }
    }

    return (
        <section className="glass-strong space-y-4 rounded-2xl p-5 sm:p-6">
            <h2 className="text-sm font-semibold text-slate-900">Display name</h2>
            <form onSubmit={onSave} className="space-y-4">
                <Input
                    id="profile-name"
                    label="Name"
                    name="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="glass-input h-11 rounded-xl text-base text-slate-900 sm:text-sm"
                    autoComplete="name"
                    required
                    minLength={2}
                    maxLength={60}
                />
                <FormError message={error} />
                {success ? (
                    <p role="status" className="text-sm font-medium text-emerald-800">
                        {success}
                    </p>
                ) : null}
                <Button
                    type="submit"
                    isLoading={saving}
                    className="h-11 w-full rounded-xl bg-brand-700 text-sm font-semibold text-white hover:bg-brand-800 sm:w-auto sm:px-6"
                >
                    Save name
                </Button>
            </form>
        </section>
    );
}
