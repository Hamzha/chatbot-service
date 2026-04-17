"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import type { ReactNode } from "react";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { DASHBOARD_SIDEBAR_NAV } from "@/lib/dashboard/dashboardSidebarNav";

const NAV_ICONS: Record<(typeof DASHBOARD_SIDEBAR_NAV)[number]["id"], ReactNode> = {
    "nav.dashboard.overview": (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1"
            />
        </svg>
    ),
    "nav.dashboard.scraper": (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
            />
        </svg>
    ),
    "nav.dashboard.upload-document": (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
        </svg>
    ),
    "nav.dashboard.chatbot": (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-4l-4 4v-4z"
            />
        </svg>
    ),
    "nav.dashboard.admin.roles": (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 11c1.657 0 3-1.567 3-3.5S13.657 4 12 4 9 5.567 9 7.5 10.343 11 12 11zm0 2c-2.21 0-4.21.584-5.657 1.536C4.79 15.582 4 16.81 4 18.09V19h16v-.91c0-1.28-.79-2.508-2.343-3.554C16.21 13.584 14.21 13 12 13z"
            />
        </svg>
    ),
    "nav.dashboard.admin.users": (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
            />
        </svg>
    ),
};

const navItems = DASHBOARD_SIDEBAR_NAV.map((row) => ({
    ...row,
    icon: NAV_ICONS[row.id],
}));

export function Sidebar({
    userName,
    userEmail,
    permissions,
}: {
    userName: string;
    userEmail: string;
    permissions: string[];
}) {
    const pathname = usePathname();
    const permSet = useMemo(() => new Set(permissions), [permissions]);
    const visibleNav = useMemo(
        () => navItems.filter((item) => permSet.has(item.permission)),
        [permSet],
    );

    return (
        <aside className="glass-strong fixed left-4 top-4 bottom-4 w-60 flex flex-col rounded-2xl overflow-hidden">
            <div className="p-6 border-b border-white/30">
                <h1 className="text-lg font-semibold text-slate-900">AI Chatbot</h1>
                <p className="text-sm text-slate-500 mt-1">Dashboard</p>
            </div>

            <nav className="flex-1 p-4 space-y-1">
                {visibleNav.map((item) => {
                    const isActive =
                        item.href === "/dashboard"
                            ? pathname === "/dashboard"
                            : pathname.startsWith(item.href);

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`flex items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-sm font-medium transition-colors duration-150 ${isActive
                                ? "bg-white/70 border-brand-300/60 text-brand-800 shadow-sm"
                                : "text-slate-600 hover:bg-white/40 hover:text-slate-900"
                                }`}
                        >
                            {item.icon}
                            {item.label}
                        </Link>
                    );
                })}
            </nav>

            <div className="p-4 border-t border-white/30 space-y-3">
                <div>
                    <p className="text-sm font-medium text-slate-900 truncate">{userName}</p>
                    <p className="text-xs text-slate-500 truncate">{userEmail}</p>
                </div>
                <Link
                    href="/dashboard/profile"
                    className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${pathname.startsWith("/dashboard/profile")
                        ? "bg-white/70 border border-brand-300/60 text-brand-800 shadow-sm"
                        : "text-slate-600 hover:bg-white/40 hover:text-slate-900"
                        }`}
                >
                    <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                        />
                    </svg>
                    My profile
                </Link>
                <LogoutButton />
            </div>
        </aside>
    );
}
