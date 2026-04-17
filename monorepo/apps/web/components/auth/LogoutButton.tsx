"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@repo/auth/hooks/useAuth";

export function LogoutButton() {
    const router = useRouter();
    const { logout } = useAuth();
    const [busy, setBusy] = useState(false);

    async function handleLogout() {
        setBusy(true);
        try {
            await logout();
            router.push("/login");
            router.refresh();
        } finally {
            setBusy(false);
        }
    }

    return (
        <button
            type="button"
            onClick={() => void handleLogout()}
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-slate-800 bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-slate-800 hover:border-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
        >
            <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
            </svg>
            {busy ? "Signing out…" : "Log out"}
        </button>
    );
}
