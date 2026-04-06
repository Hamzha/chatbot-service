import type { PropsWithChildren, ReactNode } from "react";

type AuthShellProps = PropsWithChildren<{
    badge: string;
    title: string;
    subtitle: string;
    sideTitle: string;
    sideDescription: string;
    sidePoints: string[];
    footer?: ReactNode;
}>;

export function AuthShell({
    badge,
    title,
    subtitle,
    sideTitle,
    sideDescription,
    sidePoints,
    footer,
    children,
}: AuthShellProps) {
    return (
        <main className="relative min-h-screen overflow-hidden bg-slate-100 px-4 py-8 sm:px-6 sm:py-10">
            <div className="pointer-events-none absolute -top-24 left-8 h-64 w-64 rounded-full bg-cyan-200/40 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-24 right-10 h-64 w-64 rounded-full bg-amber-200/40 blur-3xl" />

            <section className="relative mx-auto grid w-full max-w-6xl overflow-hidden rounded-3xl border border-slate-200 bg-white/90 shadow-[0_24px_70px_rgba(15,23,42,0.14)] backdrop-blur lg:grid-cols-[1fr_1.05fr]">
                <aside className="relative hidden border-r border-slate-200 bg-linear-to-br from-slate-900 via-slate-800 to-cyan-900 p-10 text-slate-100 lg:flex lg:flex-col lg:justify-between">
                    <div className="space-y-4">
                        <span className="inline-flex items-center rounded-full border border-cyan-300/40 bg-cyan-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-100">
                            {badge}
                        </span>
                        <h2 className="max-w-sm text-3xl font-semibold leading-tight text-white">{sideTitle}</h2>
                        <p className="max-w-md text-sm leading-6 text-slate-200">{sideDescription}</p>
                    </div>

                    <ul className="space-y-3">
                        {sidePoints.map((point) => (
                            <li key={point} className="flex items-start gap-3 text-sm text-slate-100/90">
                                <span className="mt-1 inline-block h-2 w-2 rounded-full bg-cyan-200" aria-hidden="true" />
                                <span>{point}</span>
                            </li>
                        ))}
                    </ul>
                </aside>

                <div className="flex items-center justify-center p-5 sm:p-8 lg:p-12">
                    <section className="w-full max-w-md space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
                        <div className="space-y-2">
                            <span className="inline-flex items-center rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-white">
                                {badge}
                            </span>
                            <h1 className="text-3xl font-semibold leading-tight text-slate-900">{title}</h1>
                            <p className="text-sm leading-6 text-slate-600">{subtitle}</p>
                        </div>

                        {children}

                        {footer ? <div className="border-t border-slate-200 pt-4 text-sm text-slate-600">{footer}</div> : null}
                    </section>
                </div>
            </section>
        </main>
    );
}