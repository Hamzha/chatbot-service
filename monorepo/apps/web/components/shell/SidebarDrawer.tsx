"use client";

import type { ReactNode } from "react";
import { useEffect, useRef } from "react";
import { useAppShell } from "./AppShellContext";

/**
 * Responsive wrapper for the dashboard sidebar.
 *
 * - `lg+`: renders children as a permanent static aside (no drawer, no scrim).
 * - `< lg`: renders children inside an off-canvas drawer controlled by `AppShellContext`.
 *
 * Focus is moved into the drawer when it opens and restored to the previously-
 * focused element when it closes.
 */
export function SidebarDrawer({ children }: { children: ReactNode }) {
    const { isSidebarOpen, closeSidebar, isMobile } = useAppShell();
    const drawerRef = useRef<HTMLDivElement | null>(null);
    const previouslyFocusedRef = useRef<HTMLElement | null>(null);

    // Focus management for mobile drawer open/close.
    useEffect(() => {
        if (!isMobile) return;
        if (isSidebarOpen) {
            previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
            // Move focus into the drawer for keyboard / screen-reader users.
            const first = drawerRef.current?.querySelector<HTMLElement>(
                "a, button, [tabindex]:not([tabindex='-1'])",
            );
            first?.focus();
        } else if (previouslyFocusedRef.current) {
            previouslyFocusedRef.current.focus?.();
            previouslyFocusedRef.current = null;
        }
    }, [isSidebarOpen, isMobile]);

    return (
        <>
            {/* Scrim – only visible on mobile when the drawer is open. */}
            <div
                onClick={closeSidebar}
                aria-hidden="true"
                className={`fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm transition-opacity duration-200 lg:hidden ${
                    isSidebarOpen ? "opacity-100" : "pointer-events-none opacity-0"
                }`}
            />

            {/* Off-canvas drawer (< lg) + permanent aside (lg+). */}
            <aside
                ref={drawerRef}
                id="app-sidebar-drawer"
                aria-label="Primary navigation"
                aria-hidden={isMobile && !isSidebarOpen ? true : undefined}
                className={[
                    // Position – mobile = fixed off-canvas; desktop = sticky aside.
                    "fixed inset-y-0 left-0 z-50 w-[min(80vw,17rem)] transform transition-transform duration-200",
                    "lg:sticky lg:top-0 lg:z-auto lg:h-screen lg:w-60 lg:shrink-0 lg:translate-x-0 lg:py-4 lg:pl-4",
                    "flex h-full flex-col lg:h-screen",
                    isSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
                ].join(" ")}
            >
                {children}
            </aside>
        </>
    );
}
