import type { ReactNode } from "react";
import { AppShellProvider } from "./AppShellContext";
import { MobileTopBar } from "./MobileTopBar";
import { SidebarDrawer } from "./SidebarDrawer";
import { SiteFooter } from "./SiteFooter";
import { Sidebar } from "@/components/dashboard/Sidebar";

type AppShellProps = {
    userName: string;
    userEmail: string;
    permissions: string[];
    children: ReactNode;
};

/**
 * Responsive dashboard chrome used by `app/(protected)/dashboard/layout.tsx`.
 *
 * Layout at each breakpoint:
 * - `lg+` (>= 1024px): permanent 15rem sidebar on the left, content fills the rest.
 * - `< lg`: a sticky compact top bar + off-canvas drawer; content is full-width.
 *
 * All shared state (drawer open/close, isMobile) lives in `AppShellContext`.
 */
export function AppShell({ userName, userEmail, permissions, children }: AppShellProps) {
    return (
        <AppShellProvider>
            <div className="relative flex min-h-screen w-full">
                <SidebarDrawer>
                    <Sidebar userName={userName} userEmail={userEmail} permissions={permissions} />
                </SidebarDrawer>

                <div className="flex min-w-0 flex-1 flex-col">
                    <MobileTopBar userName={userName} />
                    <main className="min-w-0 flex-1 px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
                        {children}
                    </main>
                    <div className="px-4 pb-6 pt-2 sm:px-6 sm:pb-8 lg:px-8">
                        <SiteFooter width="7xl" />
                    </div>
                </div>
            </div>
        </AppShellProvider>
    );
}
