import type { ReactNode } from "react";

type PageContainerProps = {
    children: ReactNode;
    /** Max content width. Defaults to `7xl` (80rem). */
    size?: "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl" | "5xl" | "6xl" | "7xl";
    /** Extra classes merged at the end (for rare per-page tweaks). */
    className?: string;
};

const MAX_WIDTH: Record<NonNullable<PageContainerProps["size"]>, string> = {
    md: "max-w-3xl",
    lg: "max-w-4xl",
    xl: "max-w-5xl",
    "2xl": "max-w-5xl",
    "3xl": "max-w-5xl",
    "4xl": "max-w-6xl",
    "5xl": "max-w-6xl",
    "6xl": "max-w-6xl",
    "7xl": "max-w-7xl",
};

/**
 * Consistent page outer container for dashboard pages:
 * - Centred, fluid max width.
 * - Vertical spacing that scales down on mobile.
 * - Plays nicely with `<AppShell>` which already adds horizontal padding.
 */
export function PageContainer({ children, size = "7xl", className = "" }: PageContainerProps) {
    return (
        <div className={`mx-auto w-full ${MAX_WIDTH[size]} space-y-5 sm:space-y-6 ${className}`.trim()}>
            {children}
        </div>
    );
}
