"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
    planId: string;
    planSlug: string;
    label: string;
    highlighted?: boolean;
    loggedIn: boolean;
};

export function PricingCheckoutButton({
    planId,
    planSlug,
    label,
    highlighted,
    loggedIn,
}: Props) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function onClick() {
        setError(null);
        if (!loggedIn) {
            router.push(`/signup?plan=${encodeURIComponent(planSlug)}`);
            return;
        }

        setLoading(true);
        try {
            const res = await fetch("/api/billing/checkout", {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ planId }),
            });
            const data = (await res.json()) as { url?: string; error?: string };
            if (!res.ok || !data.url) {
                throw new Error(data.error || "Could not start checkout.");
            }
            window.location.href = data.url;
        } catch (err) {
            setError(err instanceof Error ? err.message : "Checkout failed.");
            setLoading(false);
        }
    }

    return (
        <div className="mt-6">
            <button
                type="button"
                onClick={onClick}
                disabled={loading}
                className={
                    highlighted
                        ? "inline-flex w-full items-center justify-center rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-brand-700/30 transition hover:bg-brand-800 disabled:opacity-60"
                        : "inline-flex w-full items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-60"
                }
            >
                {loading ? "Redirecting…" : label}
            </button>
            {error ? <p className="mt-2 text-xs text-rose-600">{error}</p> : null}
        </div>
    );
}
