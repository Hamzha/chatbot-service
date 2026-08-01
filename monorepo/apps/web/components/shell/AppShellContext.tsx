"use client";

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from "react";
import { usePathname } from "next/navigation";

type AppShellContextValue = {
    /** True when the off-canvas sidebar drawer is open on mobile. */
    isSidebarOpen: boolean;
    openSidebar: () => void;
    closeSidebar: () => void;
    toggleSidebar: () => void;
    /** True when viewport is below the `lg` (1024px) breakpoint. */
    isMobile: boolean;
};

const AppShellContext = createContext<AppShellContextValue | null>(null);

/** Tailwind's `lg` breakpoint. Keep in sync with tailwind.config. */
const DESKTOP_QUERY = "(min-width: 1024px)";

export function AppShellProvider({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const [isSidebarOpen, setSidebarOpen] = useState(false);
    // Start as `false` so SSR + first client render agree (mobile drawer is closed by default).
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        if (typeof window === "undefined") return;
        const mql = window.matchMedia(DESKTOP_QUERY);
        const sync = () => setIsMobile(!mql.matches);
        sync();
        if (mql.addEventListener) {
            mql.addEventListener("change", sync);
            return () => mql.removeEventListener("change", sync);
        }
        mql.addListener(sync);
        return () => mql.removeListener(sync);
    }, []);

    const openSidebar = useCallback(() => setSidebarOpen(true), []);
    const closeSidebar = useCallback(() => setSidebarOpen(false), []);
    const toggleSidebar = useCallback(() => setSidebarOpen((v) => !v), []);

    // Auto-close on route change (keeps the drawer from sticking around after a nav link click).
    useEffect(() => {
        setSidebarOpen(false);
    }, [pathname]);

    // If the user resizes from mobile → desktop, ensure the drawer state doesn't leak.
    useEffect(() => {
        if (!isMobile) setSidebarOpen(false);
    }, [isMobile]);

    // Escape closes the drawer.
    useEffect(() => {
        if (!isSidebarOpen) return;
        const onKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") setSidebarOpen(false);
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [isSidebarOpen]);

    // Lock body scroll while the mobile drawer is open so the page behind doesn't scroll.
    useEffect(() => {
        if (typeof document === "undefined") return;
        const shouldLock = isSidebarOpen && isMobile;
        if (!shouldLock) return;
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = prevOverflow;
        };
    }, [isSidebarOpen, isMobile]);

    const value = useMemo<AppShellContextValue>(
        () => ({ isSidebarOpen, openSidebar, closeSidebar, toggleSidebar, isMobile }),
        [isSidebarOpen, openSidebar, closeSidebar, toggleSidebar, isMobile],
    );

    return <AppShellContext.Provider value={value}>{children}</AppShellContext.Provider>;
}

export function useAppShell(): AppShellContextValue {
    const ctx = useContext(AppShellContext);
    if (!ctx) {
        throw new Error("useAppShell must be used within an <AppShellProvider>.");
    }
    return ctx;
}
