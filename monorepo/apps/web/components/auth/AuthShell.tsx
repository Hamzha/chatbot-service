import type { PropsWithChildren, ReactNode } from "react";

type AuthShellProps = PropsWithChildren<{
    badge: string;
    title: string;
    subtitle: string;
    sideTitle?: string;
    sideDescription?: string;
    sidePoints?: string[];
    footer?: ReactNode;
    /**
     * When `true`, renders a single centred card (no marketing side panel).
     * Used for forgot / reset / verify-email screens.
     */
    compact?: boolean;
}>;

/**
 * Shared responsive shell used by every pre-auth screen.
 *
 * Breakpoints:
 * - `< lg` always shows only the form column (badge + title + body).
 * - `lg+` on non-compact shells adds the dark marketing side panel on the left.
 *
 * The outer `<main>` is a full-height centred flex container with generous mobile-safe
 * padding (`px-4 py-8 sm:px-6 sm:py-10`), preventing cramped edges on 320–360px devices.
 */
export function AuthShell({
    badge,
    title,
    subtitle,
    sideTitle,
    sideDescription,
    sidePoints,
    footer,
    children,
    compact = false,
}: AuthShellProps) {
    const sidePanelEnabled =
        !compact && Boolean(sideTitle && sideDescription && sidePoints && sidePoints.length > 0);

    return (
        <main className="relative flex min-h-screen items-center justify-center overflow-x-hidden px-4 py-8 sm:px-6 sm:py-10">
            <section
                className={[
                    "glass-strong relative mx-auto grid w-full overflow-hidden rounded-3xl",
                    sidePanelEnabled
                        ? "max-w-6xl lg:grid-cols-[1fr_1.05fr]"
                        : "max-w-md",
                ].join(" ")}
            >
                {sidePanelEnabled ? (
                    <aside
                        className="glass-dark relative hidden flex-col justify-between gap-8 p-10 lg:flex"
                        aria-hidden="true"
                    >
                        <div className="space-y-4">
                            <span className="inline-flex items-center rounded-full border border-brand-300/40 bg-brand-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-brand-100 backdrop-blur">
                                {badge}
                            </span>
                            <h2 className="max-w-sm text-3xl font-semibold leading-tight text-white">
                                {sideTitle}
                            </h2>
                            <p className="max-w-md text-sm leading-6 text-slate-200">{sideDescription}</p>
                        </div>

                        <ul className="space-y-3">
                            {sidePoints!.map((point) => (
                                <li key={point} className="flex items-start gap-3 text-sm text-slate-100/90">
                                    <span
                                        className="mt-1 inline-block h-2 w-2 rounded-full bg-brand-300"
                                        aria-hidden="true"
                                    />
                                    <span>{point}</span>
                                </li>
                            ))}
                        </ul>
                    </aside>
                ) : null}

                <div className="flex items-center justify-center p-5 sm:p-8 lg:p-12">
                    <section
                        className={[
                            "glass w-full space-y-5 rounded-2xl p-5 sm:space-y-6 sm:p-7",
                            sidePanelEnabled ? "max-w-md" : "",
                        ].join(" ")}
                    >
                        <div className="space-y-2">
                            <span className="inline-flex items-center rounded-full bg-slate-900/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white backdrop-blur">
                                {badge}
                            </span>
                            <h1 className="text-2xl font-semibold leading-tight tracking-tight text-slate-900 sm:text-3xl">
                                {title}
                            </h1>
                            <p className="text-sm leading-6 text-slate-600">{subtitle}</p>
                        </div>

                        {children}

                        {footer ? (
                            <div className="border-t border-white/30 pt-4 text-sm text-slate-600">
                                {footer}
                            </div>
                        ) : null}
                    </section>
                </div>
            </section>
        </main>
    );
}
