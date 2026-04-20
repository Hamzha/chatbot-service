"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { SafeUser } from "@repo/auth/types";
import { FormButton as Button } from "@repo/ui/form-button";
import { FormError } from "@repo/ui/form-error";
import { Input } from "@repo/ui/input";
import { toast } from "@/lib/ui/toast";

type RoleChip = { id: string; slug: string; name: string; enabled?: boolean };

export function ProfileClient({
    initialUser,
    initialRoles,
    initialPermissions,
}: {
    initialUser: SafeUser;
    initialRoles: RoleChip[];
    initialPermissions: string[];
}) {
    const router = useRouter();
    const [user, setUser] = useState(initialUser);
    const [roles] = useState(initialRoles);
    const [permissions] = useState(initialPermissions);
    const [name, setName] = useState(user.name);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    const created = new Date(user.createdAt);
    const createdLabel = Number.isNaN(created.getTime()) ? user.createdAt : created.toLocaleDateString();

    async function onSave(e: React.FormEvent) {
        e.preventDefault();
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
                setSaving(false);
                return;
            }
            setUser(data.user);
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
        <div className="space-y-6">
            <section className="glass-strong rounded-2xl p-6 space-y-4">
                <h2 className="text-sm font-semibold text-slate-900">Account details</h2>
                <dl className="grid gap-3 text-sm sm:grid-cols-2">
                    <div>
                        <dt className="text-slate-500">Email</dt>
                        <dd className="mt-0.5 font-medium text-slate-900 break-all">{user.email}</dd>
                    </div>
                    <div>
                        <dt className="text-slate-500">Member since</dt>
                        <dd className="mt-0.5 font-medium text-slate-900">{createdLabel}</dd>
                    </div>
                </dl>
            </section>

            <section className="glass-strong rounded-2xl p-6 space-y-3">
                <h2 className="text-sm font-semibold text-slate-900">Roles</h2>
                {roles.length === 0 ? (
                    <p className="text-sm text-slate-600">No roles assigned yet. They are applied automatically after your next login.</p>
                ) : (
                    <ul className="flex flex-wrap gap-2">
                        {roles.map((r) => {
                            const off = r.enabled === false;
                            return (
                                <li
                                    key={r.id}
                                    className={`rounded-full border px-3 py-1 text-xs font-medium ${off
                                        ? "border-slate-200 bg-slate-100 text-slate-600"
                                        : "border-brand-200 bg-brand-50 text-brand-900"
                                        }`}
                                >
                                    {r.name}
                                    <span className={off ? "text-slate-500" : "text-brand-600"}> · {r.slug}</span>
                                    {off ? <span className="text-slate-500"> (disabled)</span> : null}
                                </li>
                            );
                        })}
                    </ul>
                )}
                {roles.some((r) => r.enabled === false) ? (
                    <p className="text-xs text-slate-500">
                        Roles marked disabled are still listed on your account but do not grant access until an admin turns them back on.
                    </p>
                ) : null}
            </section>

            {permissions.length > 0 ? (
                <section className="glass-strong rounded-2xl p-6 space-y-3">
                    <h2 className="text-sm font-semibold text-slate-900">Effective permissions</h2>
                    <p className="text-xs text-slate-500">
                        Union of all permissions from your roles ({permissions.length} codes). Admins manage roles from the dashboard.
                    </p>
                    <ul className="max-h-48 overflow-y-auto rounded-xl border border-slate-100 bg-white/60 p-3 text-xs font-mono text-slate-700 space-y-1">
                        {permissions.map((code) => (
                            <li key={code}>{code}</li>
                        ))}
                    </ul>
                </section>
            ) : null}

            <section className="glass-strong rounded-2xl p-6 space-y-4">
                <h2 className="text-sm font-semibold text-slate-900">Display name</h2>
                <form onSubmit={onSave} className="space-y-4">
                    <Input
                        id="profile-name"
                        label="Name"
                        name="name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="glass-input h-11 rounded-xl text-slate-900"
                        autoComplete="name"
                        required
                        minLength={2}
                        maxLength={60}
                    />
                    <FormError message={error} />
                    {success ? (
                        <p className="text-sm text-emerald-700" role="status">
                            {success}
                        </p>
                    ) : null}
                    <Button
                        type="submit"
                        isLoading={saving}
                        className="h-11 rounded-xl bg-brand-700 text-sm font-semibold text-white hover:bg-brand-800"
                    >
                        Save name
                    </Button>
                </form>
            </section>

            <section className="glass-strong rounded-2xl p-6 space-y-2">
                <h2 className="text-sm font-semibold text-slate-900">Password</h2>
                <p className="text-sm text-slate-600">
                    For security, password changes use email verification. Request a reset link for your account email.
                </p>
                <Link
                    href="/forgot-password"
                    className="inline-flex text-sm font-semibold text-brand-700 hover:text-brand-900"
                >
                    Forgot password / reset link
                </Link>
            </section>
        </div>
    );
}
