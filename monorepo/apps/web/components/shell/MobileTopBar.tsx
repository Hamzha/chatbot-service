"use client";

import Link from "next/link";
import { useAppShell } from "./AppShellContext";

type MobileTopBarProps = {
    userName: string;
};

/**
 * Compact header that is only rendered on screens below `lg`.
 * Provides:
 *  - hamburger button to open the sidebar drawer
 *  - brand lockup (tap → dashboard)
 *  - profile link (small avatar-y chip)
 *
 * On `lg+` this component is visually hidden; the permanent sidebar takes over.
 */
export function MobileTopBar({ userName }: MobileTopBarProps) {
    const { toggleSidebar, isSidebarOpen } = useAppShell();
    const firstInitial = userName.trim().charAt(0).toUpperCase() || "U";

    return (
        <header
            className="glass-strong sticky top-0 z-30 flex h-14 items-center justify-between gap-2 border-b border-white/30 px-3 sm:h-16 sm:px-4 lg:hidden"
            aria-label="Mobile top bar"
        >
            <button
                type="button"
                onClick={toggleSidebar}
                aria-expanded={isSidebarOpen}
                aria-controls="app-sidebar-drawer"
                aria-label={isSidebarOpen ? "Close navigation menu" : "Open navigation menu"}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-slate-700 transition hover:bg-white/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700"
            >
                <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-5 w-5"
                    aria-hidden="true"
                >
                    {isSidebarOpen ? (
                        <>
                            <path d="M6 6l12 12" />
                            <path d="M6 18L18 6" />
                        </>
                    ) : (
                        <>
                            <path d="M4 7h16" />
                            <path d="M4 12h16" />
                            <path d="M4 17h16" />
                        </>
                    )}
                </svg>
            </button>

            <Link
                href="/dashboard"
                className="flex min-w-0 items-center gap-2 rounded-xl px-2 py-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700"
            >
                <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-brand-700 text-sm font-bold text-white shadow-md shadow-brand-700/30"
                    aria-hidden="true"
                >
                    AI
                </span>
                <span className="truncate text-sm font-semibold tracking-tight text-slate-900">
                    Chatbot
                </span>
            </Link>

            <Link
                href="/dashboard/profile"
                aria-label="Open profile"
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-sm font-semibold text-white shadow-md transition hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700"
            >
                <span aria-hidden="true">{firstInitial}</span>
            </Link>
        </header>
    );
}
