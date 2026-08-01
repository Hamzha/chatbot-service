"use client";

import { useState } from "react";

export function ManageBillingButton() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function openPortal() {
        setError(null);
        setLoading(true);
        try {
            const res = await fetch("/api/billing/portal", {
                method: "POST",
                credentials: "include",
            });
            const data = (await res.json()) as { url?: string; error?: string };
            if (!res.ok || !data.url) {
                throw new Error(data.error || "Could not open billing portal.");
            }
            window.location.href = data.url;
        } catch (err) {
            setError(err instanceof Error ? err.message : "Billing portal failed.");
            setLoading(false);
        }
    }

    return (
        <div>
            <button
                type="button"
                onClick={openPortal}
                disabled={loading}
                className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-60"
            >
                {loading ? "Opening…" : "Manage billing"}
            </button>
            {error ? <p className="mt-2 text-xs text-rose-600">{error}</p> : null}
        </div>
    );
}
